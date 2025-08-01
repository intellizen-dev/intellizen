import type { FileSystemNode, FileSystemProvider, URI } from 'langium'
import { existsSync, statSync } from 'node:fs'
import { UriUtils } from 'langium'

export async function traverseInside(
  fsProvider: FileSystemProvider,
  folder: URI,
  action: (node: FileSystemNode) => Promise<void>,
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
  predicate: (node: FileSystemNode) => boolean,
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

export function isFile(node: FileSystemNode, name: string): boolean {
  return node.isFile && UriUtils.basename(node.uri) === name
}

export function isDirectory(node: FileSystemNode, name: string): boolean {
  return node.isDirectory && UriUtils.basename(node.uri) === name
}

export function existsDirectory(dirPath: string): boolean {
  return existsSync(dirPath) && statSync(dirPath).isDirectory()
}

export function existsFile(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isFile()
}

export function existsFileUri(fileUri: URI): boolean {
  return existsSync(fileUri.fsPath) && statSync(fileUri.fsPath).isFile()
}
