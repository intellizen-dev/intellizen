import type { AstNode, LangiumDocument, LangiumDocumentFactory, WorkspaceFolder } from 'langium'
import { DefaultWorkspaceManager, URI } from 'langium'
import { CancellationToken } from 'vscode-languageserver'
import type { ZenScriptSharedServices } from '../module'
import type { ZenScriptConfigurationManager } from './configuration-manager'

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
    await super.initializeWorkspace(folders, cancelToken)
  }

  protected override async loadAdditionalDocuments(
    folders: WorkspaceFolder[],
    collector: (document: LangiumDocument<AstNode>) => void,
  ): Promise<void> {
    // Load our library using the `builtin` URI schema
    collector(this.documentFactory.fromString('hello from builtin', URI.parse('builtin:///library.hello')))
  }

  protected override getRootFolder(workspaceFolder: WorkspaceFolder): URI {
    return workspaceFolder.scriptsUri!
  }
}
