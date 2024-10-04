import type { FileSystemNode, FileSystemProvider, URI } from 'langium'

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
