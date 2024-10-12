import { resolve as resolvePath } from 'node:path'
import type { FileSystemProvider, WorkspaceFolder } from 'langium'
import { URI, UriUtils } from 'langium'
import { Resolver } from '@stoplight/json-ref-resolver'
import { existsDirectory, findInside, isDirectory, isFile } from '../utils/fs'
import type { ZenScriptSharedServices } from '../module'
import { ConfigError, DirectoryNotFoundError } from '../utils/error'
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
    const workspaceUri = URI.parse(workspaceFolder.uri)
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
      console.error(new ConfigError(workspaceFolder, { cause: new Error(`Config file "${StringConstants.File.intellizen}" not found.`) }))
    }
    await this.makeSureSrcRootsIsNotEmpty(parsedConfig, workspaceUri)
    workspaceFolder.config = parsedConfig
  }

  private async load(parsedConfig: ParsedConfig, configUri: URI) {
    const content = await this.fileSystemProvider.readFile(configUri)
    const json = JSON.parse(content)
    const resolved = await new Resolver().resolve(json)
    const config = IntelliZenSchema.parse(resolved.result)

    for (const srcRoot of config.srcRoots) {
      const srcRootPath = resolvePath(configUri.fsPath, '..', srcRoot)
      if (existsDirectory(srcRootPath)) {
        parsedConfig.srcRoots.push(URI.file(srcRootPath))
      }
      else {
        console.error(new DirectoryNotFoundError(srcRootPath))
      }
    }

    await this.processExtraFile(parsedConfig)
  }

  private async processExtraFile(parsedConfig: ParsedConfig) {
    const nodes = (await Promise.all(parsedConfig.srcRoots.map(srcRoot => this.fileSystemProvider.readDirectory(srcRoot)))).flat()
    parsedConfig.extra.brackets = nodes.find(it => isFile(it, StringConstants.File.brackets))?.uri
    parsedConfig.extra.preprocessors = nodes.find(it => isFile(it, StringConstants.File.preprocessors))?.uri
  }

  private async makeSureSrcRootsIsNotEmpty(parsedConfig: ParsedConfig, workspaceUri: URI) {
    if (parsedConfig.srcRoots.length > 0) {
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
    return findInside(this.fileSystemProvider, workspaceUri, node => isFile(node, StringConstants.File.intellizen))
  }
}
