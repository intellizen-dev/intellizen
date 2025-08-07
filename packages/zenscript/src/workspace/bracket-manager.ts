import type { FileSystemProvider, URI } from 'langium'
import type { WorkspaceFolder } from 'vscode-languageserver'
import type { ZenScriptSharedServices } from '../module'
import type { BracketEntry, BracketMirror } from '../resource'
import { BracketsJsonSchema } from '../resource'
import { existsFileUri } from '../utils/fs'
import { NamespaceTree } from '../utils/namespace-tree'

export interface BracketManager {
  resolve: (id: string) => BracketEntry | undefined
  type: (id: string) => string | undefined
}

export function isItemType(type: string): boolean {
  return type === 'crafttweaker.item.IItemStack'
}

export function appendItemPrefix(id: string): string {
  return `item:${id}`
}

export class ZenScriptBracketManager implements BracketManager {
  private readonly fileSystemProvider: FileSystemProvider
  readonly mirrors: BracketMirror[]
  readonly entryTree: NamespaceTree<BracketEntry>

  constructor(services: ZenScriptSharedServices) {
    this.fileSystemProvider = services.workspace.FileSystemProvider
    this.mirrors = []
    this.entryTree = new NamespaceTree(':')
    services.workspace.ConfigurationManager.onLoaded(async (folders) => {
      await this.initializeMirrors(folders)
      await this.initializeEntryTree()
    })
  }

  private async initializeMirrors(folders: WorkspaceFolder[]) {
    await Promise.all(folders.map(folder => this.loadBrackets(folder.config.extra.brackets)))
  }

  private async initializeEntryTree() {
    this.mirrors.forEach((mirror) => {
      if (isItemType(mirror.type)) {
        mirror.entries.forEach((entry, id) => {
          this.entryTree.insert(appendItemPrefix(id), entry)
        })
      }

      mirror.entries.forEach((entry, id) => {
        this.entryTree.insert(id, entry)
      })
    })
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
