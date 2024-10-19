import type { CompletionProviderOptions } from 'langium/lsp'
import { DefaultCompletionProvider } from 'langium/lsp'
import type { ZenScriptServices } from '../module'

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
  }
}
