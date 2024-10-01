import type { AstNode, LangiumDocument, LangiumDocumentFactory, WorkspaceFolder } from 'langium'
import { DefaultWorkspaceManager, URI } from 'langium'
import type { ZenScriptServices } from '../module'

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
    await super.loadAdditionalDocuments(folders, collector)
    // Load our library using the `builtin` URI schema
    collector(this.documentFactory.fromString('hello from builtin', URI.parse('builtin:///library.hello')))
  }
}
