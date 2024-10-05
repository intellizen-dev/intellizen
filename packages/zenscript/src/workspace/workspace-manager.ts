import type { LangiumDocument, LangiumDocumentFactory, URI, WorkspaceFolder } from 'langium'
import { DefaultWorkspaceManager, UriUtils, interruptAndCheck } from 'langium'
import { CancellationToken } from 'vscode-languageserver'
import type { ZenScriptSharedServices } from '../module'
import { traverseInside } from '../utils/fs'
import type { ZenScriptConfigurationManager } from './configuration-manager'

declare module 'langium' {
  interface LangiumDocument {
    readonly srcRootUri?: URI
  }
}

export class ZenScriptWorkspaceManager extends DefaultWorkspaceManager {
  private readonly documentFactory: LangiumDocumentFactory
  private readonly configManager: ZenScriptConfigurationManager

  constructor(services: ZenScriptSharedServices) {
    super(services)
    this.documentFactory = services.workspace.LangiumDocumentFactory
    this.configManager = services.workspace.ConfigurationManager
  }

  async initializeWorkspace(folders: WorkspaceFolder[], cancelToken = CancellationToken.None): Promise<void> {
    await this.configManager.initialize(folders)
    const documents = await this.performStartup(folders)
    await interruptAndCheck(cancelToken)
    await this.documentBuilder.build(documents, this.initialBuildOptions, cancelToken)
  }

  protected async performStartup(folders: WorkspaceFolder[]): Promise<LangiumDocument[]> {
    const fileExtensions = this.serviceRegistry.all.flatMap(e => e.LanguageMetaData.fileExtensions)
    const documents: LangiumDocument[] = []
    for (const folder of folders) {
      documents.push(...await this.collectWorkspaceFolder(folder, fileExtensions))
    }
    this._ready.resolve()
    return documents
  }

  protected async collectWorkspaceFolder(folder: WorkspaceFolder, fileExtensions: string[]): Promise<LangiumDocument[]> {
    const documents: LangiumDocument[] = []
    for (const srcRoot of folder.srcRoots) {
      documents.push(...await this.collectSrcRoot(srcRoot, fileExtensions))
    }
    return documents
  }

  protected async collectSrcRoot(srcRoot: URI, fileExtensions: string[]): Promise<LangiumDocument[]> {
    const documents: LangiumDocument[] = []
    await traverseInside(this.fileSystemProvider, srcRoot, async (entry) => {
      if (entry.isFile && fileExtensions.includes(UriUtils.extname(entry.uri))) {
        const document = await this.langiumDocuments.getOrCreateDocument(entry.uri)

        // @ts-ignore
        document.srcRootUri = srcRoot

        if (!this.langiumDocuments.hasDocument(document.uri)) {
          this.langiumDocuments.addDocument(document)
        }

        documents.push(document)
      }
    })
    return documents
  }
}
