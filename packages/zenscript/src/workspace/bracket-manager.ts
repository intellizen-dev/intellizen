import type { FileSystemProvider, Stream, URI } from 'langium'
import type { FuzzyMatcher } from 'langium/lsp'
import type { WorkspaceFolder } from 'vscode-languageserver'
import type { ZenScriptServices } from '../module'
import type { BracketEntry, BracketMirror } from '../resource'
import { stream } from 'langium'
import { BracketsJsonSchema } from '../resource'
import { existsFileUri } from '../utils/fs'

export interface BracketManager {
  initialize: (folders: WorkspaceFolder[]) => Promise<void>
  resolve: (id: string) => BracketEntry | undefined
  type: (id: string) => string | undefined

  completionFor: (pathOrPrefix: string[] | string) => Stream<BracketCompletion>
}

export interface BracketCompletion {
  id: string
  paths: string[]
  name?: string
}

export class ZenScriptBracketManager implements BracketManager {
  private readonly fileSystemProvider: FileSystemProvider
  private readonly mirrors: BracketMirror[]
  protected readonly fuzzyMatcher: FuzzyMatcher

  constructor(services: ZenScriptServices) {
    this.fileSystemProvider = services.shared.workspace.FileSystemProvider
    this.fuzzyMatcher = services.shared.lsp.FuzzyMatcher
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
    if (id.startsWith('item:')) {
      id = id.substring(5)
      return this.mirrors.find(mirror => this.isItem(mirror.type))?.entries.get(id)
    }
    return this.mirrors.find(mirror => mirror.entries.has(id))?.entries.get(id)
  }

  type(id: string) {
    id = this.normalize(id)
    return this.mirrors.find(mirror => mirror.regex.test(id))?.type
      ?? this.mirrors.find(mirror => mirror.entries.has(id))?.type
  }

  completionFor(pathOrPrefix: string[] | string): Stream<BracketCompletion> {
    const isArray = Array.isArray(pathOrPrefix)
    const path = isArray ? pathOrPrefix : pathOrPrefix.split(':')

    if (path.length > 0) {
      const prefix = isArray ? pathOrPrefix.join(':') : pathOrPrefix
      const mirror = this.mirrors.find(mirror => mirror.regex.test(`${prefix}:`))
      if (mirror) {
        return this.completionForMirror(mirror, path)
      }
    }

    return stream(this.mirrors).flatMap((mirror) => {
      return this.completionForMirror(mirror, path)
    })
  }

  private isItem(type: string) {
    return type === 'crafttweaker.item.IItemStack'
  }

  private completionForMirror(mirror: BracketMirror, path: string[]): Stream<BracketCompletion> {
    if (this.isItem(mirror.type) && path[0] === 'item') {
      path = path.slice(1)
    }

    const item = this.isItem(mirror.type)

    return stream(mirror.entries.entries())
      .filter((it) => {
        const sourcePaths = it[0].split(':')
        return sourcePaths.length >= path.length
          && sourcePaths.slice(0, path.length).every(
            (it, i) => this.fuzzyMatcher.match(path[i], it),
          )
      })
      .map((it) => {
        const [id, entry] = it

        return {
          id: item ? `item:${id}` : id,
          paths: item ? ['item', ...id.split(':')] : id.split(':'),
          name: entry.name,
        }
      })
  }

  private normalize(id: string) {
    return id.replace(/:[0*]$/, '')
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
