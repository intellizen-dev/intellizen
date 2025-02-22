import type { LangiumSharedServices } from 'langium/lsp'
import type { Connection } from 'vscode-languageserver'
import { DocumentState } from 'langium'
import { addCallHierarchyHandler, addCodeActionHandler, addCodeLensHandler, addConfigurationChangeHandler, addDiagnosticsHandler, addDocumentHighlightsHandler, addDocumentLinkHandler, addDocumentSymbolHandler, addDocumentUpdateHandler, addExecuteCommandHandler, addFileOperationHandler, addFindReferencesHandler, addFoldingRangeHandler, addFormattingHandler, addGoToDeclarationHandler, addGotoDefinitionHandler, addGoToImplementationHandler, addGoToTypeDefinitionHandler, addHoverHandler, addInlayHintHandler, addRenameHandler, addSemanticTokenHandler, addSignatureHelpHandler, addTypeHierarchyHandler, addWorkspaceSymbolHandler, createRequestHandler } from 'langium/lsp'

/**
 * Start the ZenScript language server with the given services.
 */
export function startZenScriptLanguageServer(services: LangiumSharedServices): void {
  const connection = services.lsp.Connection
  if (!connection) {
    throw new Error('Starting a language server requires the languageServer.Connection service to be set.')
  }

  addDocumentUpdateHandler(connection, services)
  addFileOperationHandler(connection, services)
  addDiagnosticsHandler(connection, services)
  addZenScriptCompletionHandler(connection, services)
  addFindReferencesHandler(connection, services)
  addDocumentSymbolHandler(connection, services)
  addGotoDefinitionHandler(connection, services)
  addGoToTypeDefinitionHandler(connection, services)
  addGoToImplementationHandler(connection, services)
  addDocumentHighlightsHandler(connection, services)
  addFoldingRangeHandler(connection, services)
  addFormattingHandler(connection, services)
  addCodeActionHandler(connection, services)
  addRenameHandler(connection, services)
  addHoverHandler(connection, services)
  addInlayHintHandler(connection, services)
  addSemanticTokenHandler(connection, services)
  addExecuteCommandHandler(connection, services)
  addSignatureHelpHandler(connection, services)
  addCallHierarchyHandler(connection, services)
  addTypeHierarchyHandler(connection, services)
  addCodeLensHandler(connection, services)
  addDocumentLinkHandler(connection, services)
  addConfigurationChangeHandler(connection, services)
  addGoToDeclarationHandler(connection, services)
  addWorkspaceSymbolHandler(connection, services)

  connection.onInitialize((params) => {
    return services.lsp.LanguageServer.initialize(params)
  })
  connection.onInitialized((params) => {
    services.lsp.LanguageServer.initialized(params)
  })

  // Make the text document manager listen on the connection for open, change and close text document events.
  const documents = services.workspace.TextDocuments
  documents.listen(connection)

  // Start listening for incoming messages from the client.
  connection.listen()
}

export function addZenScriptCompletionHandler(connection: Connection, services: LangiumSharedServices): void {
  connection.onCompletion(createRequestHandler(
    (services, document, params, cancelToken) => {
      return services.lsp?.CompletionProvider?.getCompletion(document, params, cancelToken)
    },
    services,
    DocumentState.ComputedScopes,
  ))
}
