import type { FileSystemProvider, URI } from 'langium'
import type { WorkspaceFolder } from 'vscode-languageserver'
import type { ZenScriptSharedServices } from '../module'
import { z } from 'zod'
import { NamespaceTree } from '../utils/namespace-tree'

export interface BracketMirror {
  type: string
  regex: RegExp
  entries: Map<string, BracketEntry>
}

export interface BracketEntry {
  name?: string
  properties: Record<string, string[]>
}

export interface BracketManager {
  findEntry: (id: string) => BracketEntry | undefined
  findType: (id: string) => string | undefined
}

export const BracketsJsonSchema = z.object({
  type: z.string(),
  regex: z.string(),
  entries: z.object({
    _id: z.string(),
    _name: z.string().optional(),
  }).catchall(z.string().array()).array(),
}).array()

export class ZenScriptBracketManager implements BracketManager {
  public readonly mirrors: BracketMirror[] = []
  public readonly entries: NamespaceTree<BracketEntry> = new NamespaceTree(':')

  private readonly fsProvider: FileSystemProvider

  constructor(services: ZenScriptSharedServices) {
    this.fsProvider = services.workspace.FileSystemProvider
    services.workspace.ConfigurationManager.onLoaded(async (folders) => {
      await this.initializeMirrors(folders)
      await this.initializeEntries()
    })
  }

  findEntry(id: string) {
    id = this.normalize(id)
    return this.mirrors.find(mirror => mirror.entries.has(id))?.entries.get(id)
  }

  findType(id: string) {
    id = this.normalize(id)
    return this.mirrors.find(mirror => mirror.regex.test(id))?.type
      ?? this.mirrors.find(mirror => mirror.entries.has(id))?.type
  }

  private normalize(id: string) {
    return id.replace(/^item:/, '').replace(/:[0*]$/, '')
  }

  private async initializeMirrors(folders: WorkspaceFolder[]) {
    await Promise.all(folders.map(folder => this.loadMirrorsFromUri(folder.config.extra.brackets)))
  }

  private async loadMirrorsFromUri(bracketsUri: URI | undefined) {
    if (!bracketsUri) {
      return
    }

    try {
      const content = await this.fsProvider.readFile(bracketsUri)
      const rawJson = JSON.parse(content)
      const bracketsJson = BracketsJsonSchema.parse(rawJson)

      for (const mirror of bracketsJson) {
        const entries: Map<string, BracketEntry> = new Map()
        for (const { _id: id, _name: name, ...properties } of mirror.entries) {
          entries.set(id, { name, properties })
        }
        this.mirrors.push({
          type: mirror.type,
          regex: new RegExp(mirror.regex),
          entries,
        })
      }
    }
    catch (error) {
      console.error('Failed to load brackets from URI:', bracketsUri, error)
    }
  }

  private async initializeEntries() {
    for (const mirror of this.mirrors) {
      const isItemType = mirror.type === 'crafttweaker.item.IItemStack'
      for (const [id, entry] of mirror.entries) {
        this.entries.insert(id, entry)
        if (isItemType) {
          this.entries.insert(`item:${id}`, entry)
        }
      }
    }
  }
}
