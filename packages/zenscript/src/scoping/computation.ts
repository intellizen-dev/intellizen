import type { AstNode, AstNodeDescription, LangiumDocument, NameProvider, PrecomputedScopes } from 'langium'
import { AstUtils, DefaultScopeComputation } from 'langium'
import type { ClassDeclaration, Script, ValueParameter } from '../generated/ast'
import { isClassDeclaration, isFunctionDeclaration, isScript, isValueParameter, isVariableDeclaration } from '../generated/ast'
import type { IntelliZenServices } from '../module'
import type { QualifiedNameProvider } from '../name'
import { isToplevel } from '../utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  override readonly nameProvider: NameProvider & QualifiedNameProvider

  constructor(services: IntelliZenServices) {
    super(services)
    this.nameProvider = services.references.NameProvider
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument): void {
    // TODO: workaround, needs rewrite
    if (isScript(node)) {
      const name = this.nameProvider.getQualifiedName(node)
      exports.push(this.descriptions.createDescription(node, name, document))
    }

    // non-toplevel nodes cannot be referenced from other documents
    if (!isToplevel(node)) {
      return
    }

    // script from an unknown package export nothing
    if (!this.nameProvider.getQualifiedName(AstUtils.findRootNode(node))) {
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
    // TODO: workaround, needs rewrite
    if (isScript(node)) {
      this.processScript(node, document, scopes)
    }
    if (isClassDeclaration(node)) {
      this.processClass(node, document, scopes)
    }
    else if (isValueParameter(node)) {
      this.processValueParameter(node, document, scopes)
    }
    super.processNode(node, document, scopes)
  }

  // TODO: workaround, needs rewrite
  private processScript(node: Script, document: LangiumDocument, scopes: PrecomputedScopes): void {
    const name = this.nameProvider.getName(node)
    if (!name) {
      return
    }

    const desc = this.descriptions.createDescription(node, name, document)
    node.classes.forEach(it => scopes.add(it, desc))
    node.functions.filter(it => it.prefix === 'static').forEach(it => scopes.add(it, desc))
    node.statements.filter(it => isVariableDeclaration(it) && it.prefix === 'static').forEach(it => scopes.add(it, desc))
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
