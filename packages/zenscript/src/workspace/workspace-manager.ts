import type { LangiumDocument, URI, WorkspaceFolder } from 'langium'
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
  private readonly configurationManager: ZenScriptConfigurationManager

  constructor(services: ZenScriptSharedServices) {
    super(services)
    this.configurationManager = services.workspace.ConfigurationManager
  }

  async initializeWorkspace(folders: WorkspaceFolder[], cancelToken = CancellationToken.None): Promise<void> {
    await this.configurationManager.initialize(folders)
    const documents = await this.performStartup(folders)
    await interruptAndCheck(cancelToken)
    await this.documentBuilder.build(documents, this.initialBuildOptions, cancelToken)
  }

  protected async performStartup(folders: WorkspaceFolder[]): Promise<LangiumDocument[]> {
    const fileExtensions = this.serviceRegistry.all.flatMap(e => e.LanguageMetaData.fileExtensions)
    const srcRoots = folders.flatMap(folder => folder.config.srcRoots).filter(uri => !!uri)
    const all = await Promise.all(srcRoots.flatMap(srcRoot => this.collect(srcRoot, fileExtensions)))
    this._ready.resolve()
    return all.flat()
  }

  protected async collect(srcRoot: URI, fileExtensions: string[]): Promise<LangiumDocument[]> {
    const documentPromises: Promise<LangiumDocument | undefined>[] = []
    await traverseInside(this.fileSystemProvider, srcRoot, async (node) => {
      if (node.isFile && fileExtensions.includes(UriUtils.extname(node.uri))) {
        documentPromises.push(this.processFile(node.uri, srcRoot))
      }
    })
    const documents = await Promise.all(documentPromises)
    return documents.filter(doc => !!doc)
  }

  private async processFile(uri: URI, srcRoot: URI): Promise<LangiumDocument | undefined> {
    const document = await this.langiumDocuments.getOrCreateDocument(uri)
    // @ts-expect-error cause readonly
    document.srcRootUri = srcRoot
    if (!this.langiumDocuments.hasDocument(document.uri)) {
      this.langiumDocuments.addDocument(document)
    }
    return document
  }
}
