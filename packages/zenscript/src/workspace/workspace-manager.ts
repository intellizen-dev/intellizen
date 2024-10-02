import path from 'node:path'
import * as fs from 'node:fs'
import type { AstNode, LangiumDocument, LangiumDocumentFactory, WorkspaceFolder } from 'langium'
import { DefaultWorkspaceManager, URI, UriUtils } from 'langium'
import { findInside, isDirectory, isFile } from '@intellizen/shared'
import type { ZenScriptSharedServices } from '../module'
import type { Config } from './configuration-manager'
import { StringConstants } from './configuration-manager'

declare module 'langium' {
  interface WorkspaceFolder {
    isLoadedConfig: boolean
    scriptsUri?: URI
    dzsScriptsUri?: URI
    configUri?: URI
  }
}

export class ZenScriptWorkspaceManager extends DefaultWorkspaceManager {
  private documentFactory: LangiumDocumentFactory

  constructor(services: ZenScriptSharedServices) {
    super(services)
    this.documentFactory = services.workspace.LangiumDocumentFactory
  }

  protected override async loadAdditionalDocuments(
    folders: WorkspaceFolder[],
    collector: (document: LangiumDocument<AstNode>) => void,
  ): Promise<void> {
    // Load our library using the `builtin` URI schema
    collector(this.documentFactory.fromString('hello from builtin', URI.parse('builtin:///library.hello')))
  }

  protected override getRootFolder(workspaceFolder: WorkspaceFolder): URI {
    if (!workspaceFolder.isLoadedConfig) {
      this.loadConfig(workspaceFolder)
      this.finalizeLoadingConfig(workspaceFolder)
      workspaceFolder.isLoadedConfig = true
    }
    return workspaceFolder.scriptsUri!
  }

  private loadConfig(workspaceFolder: WorkspaceFolder) {
    const configUri = this.findConfig(workspaceFolder)
    if (configUri) {
      workspaceFolder.configUri = configUri
    }
    else {
      console.error(new Error(`Config file ${StringConstants.Config.intellizen} does not found.`))
      return
    }

    let config: Config
    try {
      const json = fs.readFileSync(configUri.fsPath).toString()
      config = JSON.parse(json)
    }
    catch (cause) {
      console.error(new Error(`An error occurred while parsing ${StringConstants.Config.intellizen}: `, { cause }))
      return
    }

    if (config.scripts) {
      const scriptsPath = path.resolve(configUri.fsPath, '..', config.scripts)
      if (fs.existsSync(scriptsPath) || fs.statSync(scriptsPath).isDirectory()) {
        workspaceFolder.scriptsUri = URI.file(scriptsPath)
      }
      else {
        console.error(new Error(`Path ${scriptsPath} does not exist or is not a directory.`))
      }
    }

    if (config.dzs_scripts) {
      const dzsScriptsPath = path.resolve(workspaceFolder.configUri!.fsPath, '..', config.dzs_scripts)
      if (fs.existsSync(dzsScriptsPath) || fs.statSync(dzsScriptsPath).isDirectory()) {
        workspaceFolder.dzsScriptsUri = URI.file(dzsScriptsPath)
      }
      else {
        console.error(new Error(`Path ${dzsScriptsPath} does not exist or is not a directory.`))
      }
    }
  }

  private finalizeLoadingConfig(workspaceFolder: WorkspaceFolder) {
    if (!workspaceFolder.scriptsUri) {
      // Oops, this means something went wrong. Falling back to find the 'scripts' folder.
      const workspaceUri = URI.parse(workspaceFolder.uri)
      if (StringConstants.Folder.scripts === UriUtils.basename(workspaceUri)) {
        workspaceFolder.scriptsUri = workspaceUri
      }
      else {
        const scriptsPath = findInside(workspaceUri.fsPath, dirent => isDirectory(dirent, StringConstants.Folder.scripts))
        if (scriptsPath) {
          workspaceFolder.scriptsUri = URI.file(scriptsPath)
        }
        else {
          // Sad, the 'scripts' folder is not found either, fallback to use the workspace uri.
          workspaceFolder.scriptsUri = workspaceUri
        }
      }
    }
  }

  private findConfig(workspaceFolder: WorkspaceFolder) {
    const workspaceUri = URI.parse(workspaceFolder.uri)
    const configPath = findInside(workspaceUri.fsPath, dirent => isFile(dirent, StringConstants.Config.intellizen))
    if (configPath) {
      return URI.file(configPath)
    }
  }
}
