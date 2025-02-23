import type { InlayHintAcceptor } from 'langium/lsp'
import type { InlayHint, InlayHintLabelPart, Location, MarkupContent } from 'vscode-languageserver'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { BracketManager } from '../workspace/bracket-manager'
import { type AstNode, AstUtils, type NameProvider } from 'langium'
import { AbstractInlayHintProvider } from 'langium/lsp'
import { InlayHintKind } from 'vscode-languageserver'
import { isClassType } from '../typing/type-description'
import { getPathAsString } from '../utils/ast'
import { defineRules } from '../utils/rule'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K], acceptor: InlayHintAcceptor) => void }

export class ZenScriptInlayHintProvider extends AbstractInlayHintProvider {
  private readonly typeComputer: TypeComputer
  private readonly nameProvider: NameProvider
  private readonly bracketManager: BracketManager

  constructor(services: ZenScriptServices) {
    super()
    this.nameProvider = services.references.NameProvider
    this.typeComputer = services.typing.TypeComputer
    this.bracketManager = services.shared.workspace.BracketManager
  }

  computeInlayHint(astNode: AstNode, acceptor: InlayHintAcceptor): void {
    this.rules(astNode.$type)?.call(this, astNode, acceptor)
  }

  private acceptTypeHint(astNode: AstNode, acceptor: InlayHintAcceptor): void {
    if ('typeRef' in astNode) {
      return
    }

    const nameNode = this.nameProvider.getNameNode(astNode)
    if (!nameNode) {
      return
    }

    const type = this.typeComputer.inferType(astNode)
    if (!type) {
      return
    }

    let location: Location | undefined
    let tooltip: MarkupContent | undefined
    if (isClassType(type)) {
      location = {
        uri: AstUtils.getDocument(type.declaration).uri.toString(),
        range: this.nameProvider.getNameNode(type.declaration)!.range,
      }
      tooltip = {
        kind: 'markdown',
        value: `\`\`\`zenscript\n${type.declaration.$cstNode!.text}\n\`\`\``,
      }
    }

    const parts: InlayHintLabelPart[] = [
      { value: ': ' },
      { value: type.toString(), location, tooltip },
    ]

    const typeHint: InlayHint = {
      position: nameNode.range.end,
      label: parts,
      kind: InlayHintKind.Type,
    }

    acceptor(typeHint)
  }

  private readonly rules = defineRules<RuleMap>({
    VariableDeclaration: (source, acceptor) => {
      this.acceptTypeHint(source, acceptor)
    },

    LoopParameter: (source, acceptor) => {
      this.acceptTypeHint(source, acceptor)
    },

    ValueParameter: (source, acceptor) => {
      this.acceptTypeHint(source, acceptor)
    },

    BracketExpression: (source, acceptor) => {
      const id = getPathAsString(source)
      const name = this.bracketManager.resolve(id)?.name
      if (name) {
        acceptor({
          position: source.$cstNode!.range.end,
          label: name,
          paddingLeft: true,
        })
      }
    },
  })
}
