import type { TextDocument } from 'langium'
import type { LangiumSharedServices } from 'langium/lsp'
import type { TextDocumentChangeEvent } from 'vscode-languageserver'
import { DefaultDocumentUpdateHandler } from 'langium/lsp'

export class ZenScriptDocumentUpdateHandler extends DefaultDocumentUpdateHandler {
  constructor(services: LangiumSharedServices) {
    super(services)
  }

  private documentVersion = new Map<string, number>()

  didChangeContent(change: TextDocumentChangeEvent<TextDocument>): void {
    const { uri, version } = change.document
    const prevVersion = this.documentVersion.get(uri)
    if (prevVersion === undefined || prevVersion < version) {
      this.documentVersion.set(uri, version)
      super.didChangeContent(change)
    }
  }

  didOpenDocument(event: TextDocumentChangeEvent<TextDocument>): void {
    const { uri, version } = event.document
    this.documentVersion.set(uri, version)
  }

  didCloseDocument(event: TextDocumentChangeEvent<TextDocument>): void {
    this.documentVersion.delete(event.document.uri)
  }
}
