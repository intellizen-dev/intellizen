import type { AstNode, FileSystemNode, LangiumDocument, LangiumDocumentFactory, WorkspaceFolder } from 'langium'
import { DefaultWorkspaceManager, URI, UriUtils } from 'langium'
import type { ZenScriptServices } from '../module'

export const ConfigFileName = 'intellizen.json'

export interface Config {
  scripts: string
  dzs_scripts: string
}

declare module 'langium' {
  interface WorkspaceFolder {
    scriptsUri?: URI
    dzsScriptsUri?: URI
    configUri?: URI
  }
}

export class ZenScriptWorkspaceManager extends DefaultWorkspaceManager {
  private documentFactory: LangiumDocumentFactory

  constructor(services: ZenScriptServices) {
    super(services.shared)
    this.documentFactory = services.shared.workspace.LangiumDocumentFactory
  }

  override async loadAdditionalDocuments(
    folders: WorkspaceFolder[],
    collector: (document: LangiumDocument<AstNode>) => void,
  ): Promise<void> {
    // Load our library using the `builtin` URI schema
    collector(this.documentFactory.fromString('hello from builtin', URI.parse('builtin:///library.hello')))
  }

  override getRootFolder(workspaceFolder: WorkspaceFolder): URI {
    if (!workspaceFolder.scriptsUri) {
      this.getConfigUri(workspaceFolder)
        .then(async (configUri) => {
          const content = await this.fileSystemProvider.readFile(configUri)
          const config: Config = JSON.parse(content)
          // TODO
          configUri + config.scripts
        })
    }

    return URI.parse(workspaceFolder.uri)
  }

  async getConfigUri(workspaceFolder: WorkspaceFolder): Promise<URI> {
    if (!workspaceFolder.configUri) {
      const workspaceUri = URI.parse(workspaceFolder.uri)
      await this.findFileInside(workspaceUri, ConfigFileName)
        .then(configUri => workspaceFolder.configUri = configUri)
    }
    return workspaceFolder.configUri!
  }

  async findFileInside(folder: URI, fileName: string): Promise<URI> {
    let fileUri: URI | undefined
    await this.traverseFolderInside(folder, (entry) => {
      if (entry.isFile && fileName === UriUtils.basename(entry.uri)) {
        fileUri = entry.uri
      }
    })
    return fileUri ? Promise.resolve(fileUri) : Promise.reject(new Error(`file ${fileName} not found in ${folder}.`))
  }

  async traverseFolderInside(folder: URI, action: (entry: FileSystemNode) => void) {
    const entries = await this.fileSystemProvider.readDirectory(folder)
    for (const entry of entries) {
      action(entry)
      if (entry.isDirectory) {
        entries.push(...await this.fileSystemProvider.readDirectory(entry.uri))
      }
    }
  }
}
