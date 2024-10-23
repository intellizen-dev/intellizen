import { AstNodeHoverProvider } from 'langium/lsp'
import { type AstNode, CstUtils, type LangiumDocument, type MaybePromise } from 'langium'
import type { Hover, HoverParams } from 'vscode-languageserver'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'

export class ZenScriptHoverProvider extends AstNodeHoverProvider {
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  getHoverContent(document: LangiumDocument, params: HoverParams): MaybePromise<Hover | undefined> {
    const rootNode = document.parseResult?.value?.$cstNode
    if (rootNode) {
      const offset = document.textDocument.offsetAt(params.position)
      const cstNode = CstUtils.findLeafNodeAtOffset(rootNode, offset)
      if (cstNode && cstNode.offset + cstNode.length > offset) {
        const targetNode = cstNode.astNode
        if (targetNode) {
          return this.getAstNodeHoverContent(targetNode)
        }
      }
    }
    return undefined
  }

  getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
    const type = this.typeComputer.inferType(node)
    const hover: Hover = {
      contents: {
        kind: 'plaintext',
        value: String(type),
      },
    }
    return hover
  }
}
