import type { CompletionProviderOptions } from 'langium/lsp'
import type { ZenScriptServices } from '../module'
import { DefaultCompletionProvider } from 'langium/lsp'

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
  }
}
