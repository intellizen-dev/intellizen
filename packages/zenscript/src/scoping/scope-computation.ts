import type { AstNode, AstNodeDescription, LangiumDocument, PrecomputedScopes } from 'langium'
import { DefaultScopeComputation } from 'langium'
import type { ClassDeclaration, Script, ValueParameter } from '../generated/ast'
import { isClassDeclaration, isFunctionDeclaration, isScript, isValueParameter, isVariableDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { isToplevel } from '../utils/ast'
import { getQualifiedName, isZs } from '../utils/document'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<Script>): void {
    // TODO: workaround, needs rewrite
    if (isScript(node) && isZs(document)) {
      const name = this.nameProvider.getQualifiedName(node)
      exports.push(this.descriptions.createDescription(node, name, document))
    }

    // non-toplevel nodes cannot be referenced from other documents
    if (!isToplevel(node)) {
      return
    }

    // script from an unknown package export nothing
    if (getQualifiedName(document) === undefined) {
      return
    }

    const name = this.nameProvider.getQualifiedName(node)
    if (isVariableDeclaration(node)) {
      switch (node.prefix) {
        case 'global':
          super.exportNode(node, exports, document)
          break
        case 'static':
          exports.push(this.descriptions.createDescription(node, name, document))
          break
      }
    }
    else if (isFunctionDeclaration(node)) {
      switch (node.prefix) {
        case 'global':
          super.exportNode(node, exports, document)
          break
        case 'static':
          exports.push(this.descriptions.createDescription(node, name, document))
      }
    }
    else if (isClassDeclaration(node)) {
      exports.push(this.descriptions.createDescription(node, name, document))
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
