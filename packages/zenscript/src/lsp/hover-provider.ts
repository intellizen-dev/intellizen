import { AstNodeHoverProvider } from 'langium/lsp'
import type { AstNode, MaybePromise } from 'langium'
import type { Hover } from 'vscode-languageserver'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'

export class ZenScriptHoverProvider extends AstNodeHoverProvider {
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
    const type = this.typeComputer.inferType(node)
    const hover: Hover = {
      contents: String(type),
    }
    return hover
  }
}
