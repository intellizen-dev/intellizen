import fs from 'node:fs'
import path from 'node:path'
import type { WorkspaceFolder } from 'langium'
import { URI, UriUtils } from 'langium'
import { findInside, isDirectory, isFile } from '@intellizen/shared'
import type { IntelliZenConfig } from './configurations'
import { IntelliZenSchema, StringConstants } from './configurations'

declare module 'langium' {
  interface WorkspaceFolder {
    isLoadedConfig: boolean
    configUri?: URI
    srcRoots: URI[]
    extra?: {
      brackets?: URI
      preprocessors?: URI
    }
  }
}

export interface ConfigurationManager {
  initialize: (folders: WorkspaceFolder[]) => Promise<void>
}

export class ZenScriptConfigurationManager implements ConfigurationManager {
  async initialize(folders: WorkspaceFolder[]) {
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

    let config: IntelliZenConfig
    try {
      const json = await fs.promises.readFile(configUri.fsPath)
      config = IntelliZenSchema.parse(JSON.parse(json.toString()))
    }
    catch (cause) {
      console.error(new ConfigError(workspaceFolder, { cause }))
      return
    }

    for (const srcRoot of config.rootDirs) {
      const scriptsPath = path.resolve(configUri.fsPath, '..', srcRoot)
      if (fs.existsSync(scriptsPath) && fs.statSync(scriptsPath).isDirectory()) {
        workspaceFolder.srcRoots = [...workspaceFolder.srcRoots, URI.file(scriptsPath)]
      }
      else {
        console.error(new ConfigError(workspaceFolder, { cause: new Error(`Path "${scriptsPath}" does not exist or is not a directory.`) }))
      }
    }
  }

  private async finalize(workspaceFolder: WorkspaceFolder) {
    if (!workspaceFolder.srcRoots || workspaceFolder.srcRoots.length === 0) {
      // Oops, this means something went wrong. Falling back to find the 'scripts' folder.
      const workspaceUri = URI.parse(workspaceFolder.uri)
      if (StringConstants.Folder.scripts === UriUtils.basename(workspaceUri)) {
        workspaceFolder.srcRoots = [workspaceUri]
      }
      else {
        const scriptsPath = await findInside(workspaceUri.fsPath, dirent => isDirectory(dirent, StringConstants.Folder.scripts))
        if (scriptsPath) {
          workspaceFolder.srcRoots = [URI.file(scriptsPath)]
        }
        else {
          // Sad, the 'scripts' folder is not found either, fallback to use the workspace uri.
          workspaceFolder.srcRoots = [workspaceUri]
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
