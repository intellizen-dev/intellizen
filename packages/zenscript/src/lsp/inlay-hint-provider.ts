import type { AstNode, NameProvider } from 'langium'
import type { InlayHintAcceptor } from 'langium/lsp'
import type { InlayHint, InlayHintLabelPart, Location, MarkupContent } from 'vscode-languageserver'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { BracketManager } from '../workspace/bracket-manager'
import { AstUtils } from 'langium'
import { AbstractInlayHintProvider } from 'langium/lsp'
import { InlayHintKind } from 'vscode-languageserver'
import { isClassType } from '../typing/type-description'
import { getPathAsString } from '../utils/ast'
import { defineRules } from '../utils/rule'

type RuleSpec = ZenScriptAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K], acceptor: InlayHintAcceptor) => void }

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
    this.inlayHintRules(astNode.$type)?.call(this, astNode, acceptor)
  }

  private readonly inlayHintRules = defineRules<RuleMap>({
    VariableDeclaration: (element, acceptor) => {
      if (!element.type && element.name) {
        this.acceptTypeHint(element, acceptor)
      }
    },

    LoopParameter: (element, acceptor) => {
      if (element.name) {
        this.acceptTypeHint(element, acceptor)
      }
    },

    ValueParameter: (element, acceptor) => {
      if (!element.type && element.name) {
        this.acceptTypeHint(element, acceptor)
      }
    },

    BracketExpression: (element, acceptor) => {
      const id = getPathAsString(element)
      const name = this.bracketManager.resolveEntry(id)?.name
      if (name) {
        acceptor({
          position: element.$cstNode!.range.end,
          label: name,
          paddingLeft: true,
        })
      }
    },
  })

  private acceptTypeHint(astNode: AstNode, acceptor: InlayHintAcceptor): void {
    const name = this.nameProvider.getNameNode(astNode)
    if (!name) {
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
      position: name.range.end,
      label: parts,
      kind: InlayHintKind.Type,
    }

    acceptor(typeHint)
  }
}
