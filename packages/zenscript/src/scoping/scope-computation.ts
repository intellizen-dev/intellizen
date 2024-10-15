import type { AstNode, AstNodeDescription, LangiumDocument, PrecomputedScopes } from 'langium'
import { DefaultScopeComputation } from 'langium'
import type { ClassDeclaration, Script, ValueParameter } from '../generated/ast'
import { isClassDeclaration, isValueParameter } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { isGlobal } from '../utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<Script>): void {
    if (isGlobal(node)) {
      exports.push(this.descriptions.createDescription(node, undefined, document))
    }
  }

  protected override processNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
    if (isClassDeclaration(node)) {
      this.processClass(node, document, scopes)
    }
    else if (isValueParameter(node)) {
      this.processValueParameter(node, document, scopes)
    }
    super.processNode(node, document, scopes)
  }

  private processClass(node: ClassDeclaration, document: LangiumDocument, scopes: PrecomputedScopes): void {
    const name = this.nameProvider.getName(node)
    if (!name) {
      return
    }

    const desc = this.descriptions.createDescription(node, node.name, document)
    node.members.forEach(it => scopes.add(it, desc))
    scopes.add(node.$container, desc)
  }

  private processValueParameter(node: ValueParameter, document: LangiumDocument, scopes: PrecomputedScopes): void {
    const name = this.nameProvider.getName(node)
    if (!name) {
      return
    }

    const desc = this.descriptions.createDescription(node, name, document)
    scopes.add(node.$container, desc)
  }
}
