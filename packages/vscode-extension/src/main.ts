import type { ExtensionContext } from 'vscode'
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node'
import { join } from 'node:path'
import { env } from 'node:process'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'

let client: LanguageClient

// This function is called when the extension is activated.
export function activate(context: ExtensionContext): void {
  client = startLanguageClient(context)
}

// This function is called when the extension is deactivated.
export function deactivate(): Thenable<void> | undefined {
  if (client) {
    return client.stop()
  }
  return undefined
}

function startLanguageClient(context: ExtensionContext): LanguageClient {
  const serverModule = context.asAbsolutePath(join('..', '..', 'out', 'intellizen-zenscript', 'main.cjs'))
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging.
  // By setting `process.env.DEBUG_BREAK` to a truthy value, the language server will wait until a debugger is attached.
  const debugOptions = { execArgv: ['--nolazy', `--inspect${env.DEBUG_BREAK ? '-brk' : ''}=${env.DEBUG_SOCKET || '6009'}`] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
  }

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'zenscript' },
      { scheme: 'file', language: 'zenscript-declaration' },
    ],
  }

  // Create the language client and start the client.
  const client = new LanguageClient(
    'zenscript',
    'ZenScript',
    serverOptions,
    clientOptions,
  )

  // Start the client. This will also launch the server
  client.start()
  return client
}
