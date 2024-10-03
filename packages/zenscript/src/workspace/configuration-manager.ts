import fs from 'node:fs'
import path from 'node:path'
import type { WorkspaceFolder } from 'langium'
import { URI, UriUtils } from 'langium'
import { findInside, isDirectory, isFile } from '@intellizen/shared'

declare module 'langium' {
  interface WorkspaceFolder {
    isLoadedConfig: boolean
    scriptsUri?: URI
    dzsScriptsUri?: URI
    configUri?: URI
  }
}

export const StringConstants = Object.freeze({
  Config: {
    intellizen: 'intellizen.json',
  },
  Folder: {
    scripts: 'scripts',
    dzs_scripts: 'dzs_scripts',
  },
})

export interface Config {
  scripts?: string
  dzs_scripts?: string
}

export interface ConfigurationManager {
  initialize: (folders: WorkspaceFolder[]) => Promise<void>
}

export class ZenScriptConfigurationManager implements ConfigurationManager {
  private folders: WorkspaceFolder[] = []

  async initialize(folders: WorkspaceFolder[]) {
    this.folders = folders
    await Promise.all(folders.map(folder => this.loadConfig(folder)))
  }

  private async loadConfig(workspaceFolder: WorkspaceFolder) {
    await this.load(workspaceFolder)
    await this.finalize(workspaceFolder)
    workspaceFolder.isLoadedConfig = true
  }

  private async load(workspaceFolder: WorkspaceFolder) {
    const configUri = await this.findConfig(workspaceFolder)
    if (configUri) {
      workspaceFolder.configUri = configUri
    }
    else {
      console.error(new ConfigError(workspaceFolder, { cause: new Error(`Config file "${StringConstants.Config.intellizen}" not found.`) }))
      return
    }

    let config: Config
    try {
      const json = await fs.promises.readFile(configUri.fsPath)
      config = JSON.parse(json.toString())
    }
    catch (cause) {
      console.error(new ConfigError(workspaceFolder, { cause }))
      return
    }

    if (config.scripts) {
      const scriptsPath = path.resolve(configUri.fsPath, '..', config.scripts)
      const scriptsStat = await fs.promises.stat(scriptsPath)
      if (scriptsStat.isDirectory()) {
        workspaceFolder.scriptsUri = URI.file(scriptsPath)
      }
      else {
        console.error(new ConfigError(workspaceFolder, { cause: new Error(`Path "${scriptsPath}" does not exist or is not a directory.`) }))
      }
    }

    if (config.dzs_scripts) {
      const dzsScriptsPath = path.resolve(workspaceFolder.configUri!.fsPath, '..', config.dzs_scripts)
      const dzsScriptsStat = await fs.promises.stat(dzsScriptsPath)
      if (dzsScriptsStat.isDirectory()) {
        workspaceFolder.dzsScriptsUri = URI.file(dzsScriptsPath)
      }
      else {
        console.error(new ConfigError(workspaceFolder, { cause: new Error(`Path "${dzsScriptsPath}" does not exist or is not a directory.`) }))
      }
    }
  }

  private async finalize(workspaceFolder: WorkspaceFolder) {
    if (!workspaceFolder.scriptsUri) {
      // Oops, this means something went wrong. Falling back to find the 'scripts' folder.
      const workspaceUri = URI.parse(workspaceFolder.uri)
      if (StringConstants.Folder.scripts === UriUtils.basename(workspaceUri)) {
        workspaceFolder.scriptsUri = workspaceUri
      }
      else {
        const scriptsPath = await findInside(workspaceUri.fsPath, dirent => isDirectory(dirent, StringConstants.Folder.scripts))
        if (scriptsPath) {
          workspaceFolder.scriptsUri = URI.file(scriptsPath)
        }
        else {
          // Sad, the 'scripts' folder is not found either, fallback to use the workspace uri.
          workspaceFolder.scriptsUri = workspaceUri
        }
      }
    }
    workspaceFolder.isLoadedConfig = true
  }

  private async findConfig(workspaceFolder: WorkspaceFolder) {
    const workspaceUri = URI.parse(workspaceFolder.uri)
    const configPath = await findInside(workspaceUri.fsPath, dirent => isFile(dirent, StringConstants.Config.intellizen))
    if (configPath) {
      return URI.file(configPath)
    }
  }
}

class ConfigError extends Error {
  constructor(workspaceFolder: WorkspaceFolder, options?: ErrorOptions) {
    super(`An error occurred parsing "${StringConstants.Config.intellizen}" located in the workspace folder "${workspaceFolder.name}".`, options)
  }
}
