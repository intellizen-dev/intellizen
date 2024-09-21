import type { AstNode, ReferenceInfo, Scope } from 'langium'
import { DefaultScopeProvider } from 'langium'
import type { ClassDeclaration, Declaration, Expression, ImportDeclaration, LocalVariable } from '../generated/ast'
import { isClassDeclaration, isDeclaration, isExpression, isImportDeclaration, isLocalVariable, isMemberAccess, isScript } from '../generated/ast'
import type { TypeComputer } from '../typing/infer'
import type { IntelliZenServices } from '../module'
import type { ClassTypeDescription, TypeDescription } from '../typing/description'
import { isClassTypeDesc } from '../typing/description'
import { getClassMembers, isStaticMember } from '../utils/ast'

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private typeComputer: TypeComputer

  constructor(services: IntelliZenServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  override getScope(context: ReferenceInfo): Scope {
    const { container } = context

    if (isMemberAccess(container)) {
      const members = this.member(container.receiver)
      return this.createScopeForNodes(members)
    }

    return super.getScope(context)
  }

  private member(node: AstNode): AstNode[] {
    if (isExpression(node)) {
      return this.memberExpression(node)
    }
    else if (isDeclaration(node)) {
      return this.memberDeclaration(node)
    }
    else {
      return []
    }
  }

  // region Declaration
  private memberDeclaration(node: Declaration): AstNode[] {
    if (isImportDeclaration(node)) {
      return this.memberImportDeclaration(node)
    }
    else if (isClassDeclaration(node)) {
      return this.memberClassDeclaration(node)
    }
    else {
      return []
    }
  }

  private memberImportDeclaration(node: ImportDeclaration): AstNode[] {
    const element = this.indexManager.allElements().find((it) => {
      const qName = this.nameProvider.getQualifiedName(it.node!)
      return node.ref.$refText === qName
    })?.node

    if (!element)
      return []

    const members: AstNode[] = []
    if (isScript(element)) {
      element.classes.forEach(it => members.push(it))
      element.functions.forEach(it => members.push(it))
      element.statements.forEach(it => members.push(it))
    }
    else if (isClassDeclaration(element)) {
      element.members.forEach(it => members.push(it))
    }

    return members
  }

  private memberClassDeclaration(node: ClassDeclaration): AstNode[] {
    return getClassMembers(node).filter(m => isStaticMember(m))
  }
  // endregion

  // region Expression
  private memberExpression(node: Expression): AstNode[] {
    if (isLocalVariable(node)) {
      return this.memberLocalVariable(node)
    }
    else {
      const type = this.typeComputer.inferType(node)
      return this.memberTypeDescription(type)
    }
  }

  private memberLocalVariable(node: LocalVariable): AstNode[] {
    const ref = node.ref.ref
    if (isImportDeclaration(ref)) {
      return this.memberImportDeclaration(ref)
    }
    else if (isClassDeclaration(ref)) {
      return ref.members
    }
    else {
      return []
    }
  }
  // endregion

  // region TypeDescription
  private memberTypeDescription(type: TypeDescription | undefined): AstNode[] {
    if (isClassTypeDesc(type)) {
      return this.memberClassTypeDescription(type)
    }
    else {
      return []
    }
  }

  private memberClassTypeDescription(type: ClassTypeDescription): AstNode[] {
    return getClassMembers(type.ref?.ref).filter(m => !isStaticMember(m))
  }
  // endregion
}
