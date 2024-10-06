import { resolve as resolvePath } from 'node:path'
import type { FileSystemProvider, WorkspaceFolder } from 'langium'
import { URI, UriUtils } from 'langium'
import { existsDirectory, existsFile, findInside, isDirectory, isFile } from '../utils/fs'
import type { ZenScriptSharedServices } from '../module'
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
  private readonly fileSystemProvider: FileSystemProvider

  constructor(services: ZenScriptSharedServices) {
    this.fileSystemProvider = services.workspace.FileSystemProvider
  }

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
    await this.makeSureSrcRootsIsNotEmpty(parsedConfig, workspaceUri)
    workspaceFolder.config = parsedConfig
  }

  private async load(parsedConfig: ParsedConfig, configUri: URI) {
    const content = await this.fileSystemProvider.readFile(configUri)
    const config = IntelliZenSchema.parse(JSON.parse(content))

    for (const srcRoot of config.srcRoots) {
      const srcRootPath = resolvePath(configUri.fsPath, '..', srcRoot)
      if (existsDirectory(srcRootPath)) {
        parsedConfig.srcRoots.push(URI.file(srcRootPath))
      }
      else {
        console.error(new DirectoryNotFoundError(srcRootPath))
      }
    }

    const brackets = config.extra?.brackets
    const preprocessors = config.extra?.preprocessors

    await Promise.all([
      this.processExtraFile(brackets, 'brackets', parsedConfig, configUri),
      this.processExtraFile(preprocessors, 'preprocessors', parsedConfig, configUri),
    ])
  }

  private async processExtraFile(
    filePath: string | undefined,
    key: keyof ParsedConfig['extra'],
    parsedConfig: ParsedConfig,
    configUri: URI,
  ) {
    if (filePath) {
      const resolvedPath = resolvePath(configUri.fsPath, '..', filePath)
      if (existsFile(resolvedPath)) {
        parsedConfig.extra[key] = URI.file(resolvedPath)
      }
      else {
        console.error(new EntryError(`extra.${key}`, { cause: new FileNotFoundError(filePath) }))
      }
    }
  }

  private async makeSureSrcRootsIsNotEmpty(parsedConfig: ParsedConfig, workspaceUri: URI) {
    if (parsedConfig.srcRoots.length > 0) {
      // looks fine, do nothing.
      return
    }

    if (StringConstants.Folder.scripts === UriUtils.basename(workspaceUri)) {
      parsedConfig.srcRoots = [workspaceUri]
      return
    }

    const scriptsUri = await findInside(this.fileSystemProvider, workspaceUri, node => isDirectory(node, StringConstants.Folder.scripts))
    if (scriptsUri) {
      parsedConfig.srcRoots = [scriptsUri]
      return
    }

    parsedConfig.srcRoots = [workspaceUri]
  }

  private async findConfig(workspaceFolder: WorkspaceFolder): Promise<URI | undefined> {
    const workspaceUri = URI.parse(workspaceFolder.uri)
    return findInside(this.fileSystemProvider, workspaceUri, node => isFile(node, StringConstants.Config.intellizen))
  }
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
