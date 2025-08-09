import type { FileSystemProvider, WorkspaceFolder } from 'langium'
import type { ZenScriptSharedServices } from '../module'
import type { WorkspaceConfig } from '../resource'
import { Resolver } from '@stoplight/json-ref-resolver'
import { URI, UriUtils } from 'langium'
import { IntelliZenJsonSchema, StringConstants } from '../resource'
import { ConfigError, DirectoryNotFoundError } from '../utils/error'
import { existsDirectory, findInside, isDirectory, isFile } from '../utils/fs'

declare module 'langium' {
  interface WorkspaceFolder {
    config: WorkspaceConfig
  }
}

export interface ConfigurationManager {
  initialize: (folders: WorkspaceFolder[]) => Promise<void>
  onLoaded: (listener: LoadedListener) => void
}

export type LoadedListener = (folders: WorkspaceFolder[]) => Promise<void>

export class ZenScriptConfigurationManager implements ConfigurationManager {
  private readonly fsProvider: FileSystemProvider
  private readonly loadedListeners: LoadedListener[]

  constructor(services: ZenScriptSharedServices) {
    this.fsProvider = services.workspace.FileSystemProvider
    this.loadedListeners = []
  }

  async initialize(folders: WorkspaceFolder[]) {
    await Promise.all(folders.map(folder => this.loadConfig(folder)))
    await Promise.all(this.loadedListeners.map(listener => listener(folders)))
  }

  onLoaded(listener: LoadedListener) {
    this.loadedListeners.push(listener)
  }

  private async loadConfig(folder: WorkspaceFolder) {
    const folderUri = URI.parse(folder.uri)
    const configUri = await this.findConfig(folder)
    const config: WorkspaceConfig = { srcRoots: [], extra: {} }
    if (configUri) {
      try {
        await this.load(config, configUri)
      }
      catch (cause) {
        console.error(new ConfigError(folder, { cause }))
      }
    }
    else {
      console.error(new ConfigError(folder, { cause: new Error(`Config file "${StringConstants.File.intellizen}" not found.`) }))
    }
    await this.makeSureSrcRootsIsNotEmpty(config, folderUri)
    folder.config = config
  }

  private async load(config: WorkspaceConfig, configUri: URI) {
    const content = await this.fsProvider.readFile(configUri)
    const json = JSON.parse(content)
    const resolved = await new Resolver().resolve(json)
    const schema = IntelliZenJsonSchema.parse(resolved.result)

    for (const srcRoot of schema.srcRoots) {
      const srcRootUri = UriUtils.resolvePath(configUri, '..', srcRoot)
      if (await existsDirectory(this.fsProvider, srcRootUri)) {
        config.srcRoots.push(srcRootUri)
      }
      else {
        console.error(new DirectoryNotFoundError(srcRootUri))
      }
    }

    await this.processExtraFile(config)
  }

  private async processExtraFile(config: WorkspaceConfig) {
    const nodes = (await Promise.all(config.srcRoots.map(srcRoot => this.fsProvider.readDirectory(srcRoot)))).flat()
    config.extra.brackets = nodes.find(it => isFile(it, StringConstants.File.brackets))?.uri
    config.extra.preprocessors = nodes.find(it => isFile(it, StringConstants.File.preprocessors))?.uri
  }

  private async makeSureSrcRootsIsNotEmpty(config: WorkspaceConfig, workspaceUri: URI) {
    if (config.srcRoots.length > 0) {
      return
    }

    if (StringConstants.Folder.scripts === UriUtils.basename(workspaceUri)) {
      config.srcRoots = [workspaceUri]
      return
    }

    const scriptsUri = await findInside(this.fsProvider, workspaceUri, node => isDirectory(node, StringConstants.Folder.scripts))
    if (scriptsUri) {
      config.srcRoots = [scriptsUri]
      return
    }

    config.srcRoots = [workspaceUri]
  }

  private async findConfig(folder: WorkspaceFolder): Promise<URI | undefined> {
    const folderUri = URI.parse(folder.uri)
    return findInside(this.fsProvider, folderUri, node => isFile(node, StringConstants.File.intellizen))
  }
}
