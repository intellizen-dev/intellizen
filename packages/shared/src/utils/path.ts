import type { Dirent } from 'node:fs'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

export function findInside(folder: string, predicate: (dirent: Dirent) => boolean): string | undefined {
  const entries = readdirSync(folder, { withFileTypes: true })
  while (entries.length !== 0) {
    const dirent = entries.shift()!
    const direntPath = resolve(dirent.parentPath, dirent.name)
    if (predicate(dirent)) {
      return direntPath
    }
    if (dirent.isDirectory()) {
      entries.push(...readdirSync(direntPath, { withFileTypes: true }))
    }
  }
  return undefined
}

export function isFile(dirent: Dirent, name: string): boolean {
  return dirent.isFile() && dirent.name === name
}

export function isDirectory(dirent: Dirent, name: string): boolean {
  return dirent.isDirectory() && dirent.name === name
}
