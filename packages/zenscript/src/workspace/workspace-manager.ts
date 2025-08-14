import type { LangiumDocument, WorkspaceFolder } from 'langium'
import type { ZenScriptSharedServices } from '../module'
import type { ConfigurationManager } from './configuration-manager'
import { DefaultWorkspaceManager, interruptAndCheck, URI, UriUtils } from 'langium'
import { CancellationToken } from 'vscode-languageserver'
import { builtinsPath } from '../resource'
import { traverseInside } from '../utils/fs'

declare module 'langium' {
  interface LangiumDocument {
    readonly srcRootUri?: URI
  }
}

export class ZenScriptWorkspaceManager extends DefaultWorkspaceManager {
  private readonly configurationManager: ConfigurationManager

  constructor(services: ZenScriptSharedServices) {
    super(services)
    this.configurationManager = services.workspace.ConfigurationManager
  }

  override async initializeWorkspace(folders: WorkspaceFolder[], cancelToken = CancellationToken.None): Promise<void> {
    await this.configurationManager.initialize(folders)
    const documents = await this.performStartup(folders)
    await interruptAndCheck(cancelToken)
    const start = performance.now()
    await this.documentBuilder.build(documents, this.initialBuildOptions, cancelToken)
    console.warn(`[Workspace/Build] Built ${documents.length} documents took ${Math.floor(performance.now() - start)} ms`)
  }

  override async performStartup(folders: WorkspaceFolder[]): Promise<LangiumDocument[]> {
    const fileExtensions = this.serviceRegistry.all.flatMap(e => e.LanguageMetaData.fileExtensions)
    const srcRoots: URI[] = [
      URI.file(builtinsPath),
      ...folders.flatMap(folder => folder.config.srcRoots),
    ]
    const documents: LangiumDocument[] = []
    for (const srcRoot of srcRoots) {
      const srcFiles = await this.collect(srcRoot, fileExtensions)
      const start = performance.now()
      for (const srcFile of srcFiles) {
        documents.push(await this.process(srcFile, srcRoot))
      }
      console.warn(`[Workspace/Startup] Created ${srcFiles.length} documents for srcRoot "${UriUtils.basename(srcRoot)}" took ${Math.floor(performance.now() - start)} ms`)
    }
    this._ready.resolve()
    return documents
  }

  private async collect(srcRoot: URI, fileExtensions: string[]): Promise<URI[]> {
    const srcFiles: URI[] = []
    await traverseInside(this.fileSystemProvider, srcRoot, async (node) => {
      if (node.isFile && fileExtensions.includes(UriUtils.extname(node.uri))) {
        srcFiles.push(node.uri)
      }
    })
    return srcFiles
  }

  private async process(srcFile: URI, srcRoot: URI): Promise<LangiumDocument> {
    const document = await this.langiumDocuments.getOrCreateDocument(srcFile)
    Object.assign(document, { srcRootUri: srcRoot })
    return document
  }
}
