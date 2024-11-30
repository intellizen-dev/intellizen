import type { FileSystemProvider, URI } from 'langium'
import type { WorkspaceFolder } from 'vscode-languageserver'
import type { ZenScriptServices } from '../module'
import type { BracketEntry, BracketMirror } from '../resource'
import { BracketsJsonSchema } from '../resource'
import { existsFileUri } from '../utils/fs'

export interface BracketManager {
  initialize: (folders: WorkspaceFolder[]) => Promise<void>
  resolve: (id: string) => BracketEntry | undefined
  type: (id: string) => string | undefined
}

export class ZenScriptBracketManager implements BracketManager {
  private readonly fileSystemProvider: FileSystemProvider
  public readonly mirrors: BracketMirror[]

  constructor(services: ZenScriptServices) {
    this.fileSystemProvider = services.shared.workspace.FileSystemProvider
    this.mirrors = []
    services.shared.workspace.ConfigurationManager.onLoaded(async (folders) => {
      await this.initialize(folders)
    })
  }

  async initialize(folders: WorkspaceFolder[]) {
    await Promise.all(folders.map(folder => this.loadBrackets(folder.config.extra.brackets)))
  }

  resolve(id: string) {
    id = this.normalize(id)
    return this.mirrors.find(mirror => mirror.entries.has(id))?.entries.get(id)
  }

  type(id: string) {
    id = this.normalize(id)
    return this.mirrors.find(mirror => mirror.regex.test(id))?.type
      ?? this.mirrors.find(mirror => mirror.entries.has(id))?.type
  }

  private normalize(id: string) {
    return id.replace(/^item:/, '').replace(/:[0*]$/, '')
  }

  private async loadBrackets(bracketsUri: URI | undefined) {
    if (!bracketsUri || !existsFileUri(bracketsUri)) {
      return
    }

    const content = await this.fileSystemProvider.readFile(bracketsUri)
    const json = JSON.parse(content)
    const schema = BracketsJsonSchema.parse(json)
    schema.forEach((mirror) => {
      const entries = mirror.entries.reduce((map, entry) => {
        const { _id: id, _name: name, ...properties } = entry
        return map.set(id, { name, properties })
      }, new Map<string, BracketEntry>())

      this.mirrors.push({
        type: mirror.type,
        regex: new RegExp(mirror.regex),
        entries,
      })
    })
  }
}
