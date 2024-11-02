import { type AstNode, AstUtils, type NameProvider } from 'langium'
import type { InlayHintAcceptor } from 'langium/lsp'
import { AbstractInlayHintProvider } from 'langium/lsp'
import type { Location, MarkupContent } from 'vscode-languageserver'
import { InlayHintKind } from 'vscode-languageserver'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { ZenScriptAstType } from '../generated/ast'
import { isClassType } from '../typing/type-description'

type SourceMap = ZenScriptAstType
type SourceKey = keyof SourceMap
type Produce<K extends SourceKey, S extends SourceMap[K]> = (source: S, acceptor: InlayHintAcceptor) => void
type Rule = <K extends SourceKey, S extends SourceMap[K]>(match: K, produce: Produce<K, S>) => void
type RuleMap = Map<SourceKey, Produce<SourceKey, any>>

export class ZenScriptInlayHintProvider extends AbstractInlayHintProvider {
  private readonly typeComputer: TypeComputer
  private readonly nameProvider: NameProvider
  private readonly rules: RuleMap

  constructor(services: ZenScriptServices) {
    super()
    this.nameProvider = services.references.NameProvider
    this.typeComputer = services.typing.TypeComputer
    this.rules = this.initRules()
  }

  computeInlayHint(astNode: AstNode, acceptor: InlayHintAcceptor): void {
    const $type = astNode.$type as SourceKey
    this.rules.get($type)?.call(this, astNode, acceptor)
  }

  private initRules(): RuleMap {
    const rules: RuleMap = new Map()
    const rule: Rule = (match, produce) => {
      if (rules.has(match)) {
        throw new Error(`Rule "${match}" is already defined.`)
      }
      rules.set(match, produce)
    }

    rule('VariableDeclaration', (source, acceptor) => {
      if (source.typeRef) {
        return
      }

      const nameNode = this.nameProvider.getNameNode(source)
      if (!nameNode) {
        return
      }

      const type = this.typeComputer.inferType(source)
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

      acceptor({
        position: nameNode.range.end,
        label: [
          { value: ': ' },
          { value: type.toString(), location, tooltip },
        ],
        kind: InlayHintKind.Type,
      })
    })

    rule('ForVariableDeclaration', (source, acceptor) => {
      const nameNode = this.nameProvider.getNameNode(source)
      if (!nameNode) {
        return
      }

      const type = this.typeComputer.inferType(source)
      if (!type) {
        return
      }

      acceptor({
        position: nameNode.range.end,
        label: `: ${type.toString()}`,
        kind: InlayHintKind.Type,
      })
    })

    return rules
  }
}
