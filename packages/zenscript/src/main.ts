import { NodeFileSystem } from 'langium/node'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js'
import { startZenScriptLanguageServer } from './language-server'
import { createZenScriptServices } from './module'

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all)

// Inject the shared services and language-specific services
const { shared } = createZenScriptServices({ connection, ...NodeFileSystem })

// Start the language server with the shared services
startZenScriptLanguageServer(shared)
