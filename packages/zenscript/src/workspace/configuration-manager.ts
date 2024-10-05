import fs from 'node:fs'
import path from 'node:path'
import type { WorkspaceFolder } from 'langium'
import { URI, UriUtils } from 'langium'
import { findInside, isDirectory, isFile } from '@intellizen/shared'
import type { ParsedConfig } from './configurations'
import { IntelliZenSchema, StringConstants } from './configurations'

declare module 'langium' {
  interface WorkspaceFolder {
    config: ParsedConfig
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
    const workspaceUri = URI.file(workspaceFolder.uri)
    const configUri = await this.findConfig(workspaceFolder)
    const parsedConfig: ParsedConfig = { srcRoots: [], extra: {} }
    if (configUri) {
      try {
        await this.load(parsedConfig, configUri)
      }
      catch (cause) {
        console.error(new ConfigError(workspaceFolder, { cause }))
      }
    }
    else {
      console.error(new ConfigError(workspaceFolder, { cause: new Error(`Config file "${StringConstants.Config.intellizen}" not found.`) }))
    }
    await this.finalize(parsedConfig, workspaceUri)
    workspaceFolder.config = parsedConfig
  }

  private async load(parsedConfig: ParsedConfig, configUri: URI) {
    const buffer = await fs.promises.readFile(configUri.fsPath)
    const config = IntelliZenSchema.parse(JSON.parse(buffer.toString()))

    for (const srcRoot of config.srcRoots) {
      const srcRootPath = path.resolve(configUri.fsPath, '..', srcRoot)
      if (existsDirectory(srcRootPath)) {
        parsedConfig.srcRoots.push(URI.file(srcRootPath))
      }
      else {
        console.error(new DirectoryNotFoundError(srcRootPath))
      }
    }

    const brackets = config.extra?.brackets
    if (brackets) {
      const filePath = path.resolve(configUri.fsPath, '..', brackets)
      if (existsFile(filePath)) {
        parsedConfig.extra.brackets = URI.file(filePath)
      }
      else {
        console.error(new EntryError('extra.brackets', { cause: new FileNotFoundError(brackets) }))
      }
    }

    const preprocessors = config.extra?.preprocessors
    if (preprocessors) {
      const filePath = path.resolve(configUri.fsPath, '..', preprocessors)
      if (existsFile(filePath)) {
        parsedConfig.extra.preprocessors = URI.file(filePath)
      }
      else {
        console.error(new EntryError('extra.preprocessors', { cause: new FileNotFoundError(preprocessors) }))
      }
    }
  }

  private async finalize(parsedConfig: ParsedConfig, workspaceUri: URI) {
    if (parsedConfig.srcRoots.length === 0) {
      // Oops, this means something went wrong. Falling back to find the 'scripts' folder.
      if (StringConstants.Folder.scripts === UriUtils.basename(workspaceUri)) {
        parsedConfig.srcRoots = [workspaceUri]
      }
      else {
        const scriptsPath = await findInside(workspaceUri.fsPath, dirent => isDirectory(dirent, StringConstants.Folder.scripts))
        if (scriptsPath) {
          parsedConfig.srcRoots = [URI.file(scriptsPath)]
        }
        else {
          // Sad, the 'scripts' folder is not found either, fallback to use the workspace uri.
          parsedConfig.srcRoots = [workspaceUri]
        }
      }
    }
  }

  private async findConfig(workspaceFolder: WorkspaceFolder) {
    const workspaceUri = URI.parse(workspaceFolder.uri)
    const configPath = await findInside(workspaceUri.fsPath, dirent => isFile(dirent, StringConstants.Config.intellizen))
    if (configPath) {
      return URI.file(configPath)
    }
  }
}

function existsDirectory(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
}

function existsFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
}

class ConfigError extends Error {
  constructor(workspaceFolder: WorkspaceFolder, options?: ErrorOptions) {
    super(`An error occurred parsing "${StringConstants.Config.intellizen}" located in the workspace folder "${workspaceFolder.name}".`, options)
  }
}

class EntryError extends Error {
  constructor(entry: string, options?: ErrorOptions) {
    super(`An error occurred parsing entry "${entry}".`, options)
  }
}

class FileNotFoundError extends Error {
  constructor(filePath: string, options?: ErrorOptions) {
    super(`File "${filePath}" does not exist.`, options)
  }
}

class DirectoryNotFoundError extends Error {
  constructor(dirPath: string, options?: ErrorOptions) {
    super(`Directory "${dirPath}" does not exist.`, options)
  }
}
