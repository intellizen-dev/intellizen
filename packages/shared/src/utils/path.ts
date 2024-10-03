import type { Dirent } from 'node:fs'
import fs from 'node:fs'
import { resolve } from 'node:path'

export async function findInside(folder: string, predicate: (dirent: Dirent) => boolean): Promise<string | undefined> {
  const entries = await fs.promises.readdir(folder, { withFileTypes: true })
  while (entries.length !== 0) {
    const dirent = entries.shift()!
    const direntPath = resolve(dirent.parentPath, dirent.name)
    if (predicate(dirent)) {
      return direntPath
    }
    if (dirent.isDirectory()) {
      entries.push(...await fs.promises.readdir(direntPath, { withFileTypes: true }))
    }
  }
  return undefined
}

export function findInsideSync(folder: string, predicate: (dirent: Dirent) => boolean): string | undefined {
  const entries = fs.readdirSync(folder, { withFileTypes: true })
  while (entries.length !== 0) {
    const dirent = entries.shift()!
    const direntPath = resolve(dirent.parentPath, dirent.name)
    if (predicate(dirent)) {
      return direntPath
    }
    if (dirent.isDirectory()) {
      entries.push(...fs.readdirSync(direntPath, { withFileTypes: true }))
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
