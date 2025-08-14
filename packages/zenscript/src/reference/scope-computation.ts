import type { AstNode, AstNodeDescription, LangiumDocument, MultiMap } from 'langium'
import type { Script } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { DefaultScopeComputation } from 'langium'
import { isGlobal } from '../utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  override addExportedSymbol(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<Script>): void {
    if (isGlobal(node)) {
      const name = this.nameProvider.getName(node)
      if (name) {
        exports.push(this.descriptions.getOrCreateDescription(node, document.uri, name))
      }
    }
  }

  override addLocalSymbol(node: AstNode, document: LangiumDocument, symbols: MultiMap<AstNode, AstNodeDescription>): void {
    const container = node.$container
    if (container) {
      const name = this.nameProvider.getName(node)
      if (name) {
        symbols.add(container, this.descriptions.getOrCreateDescription(node, document.uri, name))
      }
    }
  }
}
