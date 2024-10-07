import type { WorkspaceFolder } from 'langium'
import { StringConstants } from '../workspace/configurations'

export class ConfigError extends Error {
  constructor(workspaceFolder: WorkspaceFolder, options?: ErrorOptions) {
    super(`An error occurred parsing "${StringConstants.Config.intellizen}" located in the workspace folder "${workspaceFolder.name}".`, options)
  }
}

export class EntryError extends Error {
  constructor(entry: string, options?: ErrorOptions) {
    super(`An error occurred parsing entry "${entry}".`, options)
  }
}

export class FileNotFoundError extends Error {
  constructor(filePath: string, options?: ErrorOptions) {
    super(`File "${filePath}" does not exist.`, options)
  }
}

export class DirectoryNotFoundError extends Error {
  constructor(dirPath: string, options?: ErrorOptions) {
    super(`Directory "${dirPath}" does not exist.`, options)
  }
}
