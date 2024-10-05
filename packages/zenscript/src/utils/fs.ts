import { type FileSystemNode, type FileSystemProvider, type URI, UriUtils } from 'langium'

export type FileSystemAction = (node: FileSystemNode) => Promise<void>

export async function traverseInside(
  fsProvider: FileSystemProvider,
  folder: URI,
  action: FileSystemAction,
) {
  const entries = await fsProvider.readDirectory(folder)
  while (entries.length !== 0) {
    const entry = entries.shift()!
    await action(entry)
    if (entry.isDirectory) {
      entries.push(...await fsProvider.readDirectory(entry.uri))
    }
  }
}

export async function findInside(
  fsProvider: FileSystemProvider,
  folder: URI,
  predicate: (entry: FileSystemNode) => boolean,
): Promise<URI | undefined> {
  const entries = await fsProvider.readDirectory(folder)
  while (entries.length !== 0) {
    const entry = entries.shift()!
    if (predicate(entry)) {
      return entry.uri
    }
    if (entry.isDirectory) {
      entries.push(...await fsProvider.readDirectory(entry.uri))
    }
  }
}

export function isFile(entry: FileSystemNode, name: string): boolean {
  return entry.isFile && UriUtils.basename(entry.uri) === name
}

export function isDirectory(entry: FileSystemNode, name: string): boolean {
  return entry.isDirectory && UriUtils.basename(entry.uri) === name
}
