import type { AstNode, AstNodeDescription, ReferenceInfo, Scope } from 'langium'
import { AstUtils, DefaultScopeProvider, URI } from 'langium'
import { HierarchyTree } from '@intellizen/shared'
import type { ClassDeclaration, ClassType, Declaration, Expression, ImportDeclaration, LocalVariable, Script, TypeReference } from '../generated/ast'
import { isClassDeclaration, isClassType, isDeclaration, isExpression, isImportDeclaration, isLocalVariable, isScript, isTypeReference, isVariableDeclaration } from '../generated/ast'
import type { TypeComputer } from '../typing/infer'
import type { IntelliZenServices } from '../module'
import type { ClassTypeDescription, TypeDescription } from '../typing/description'
import { isClassTypeDesc } from '../typing/description'
import { getClassChain, getPathAsString, isStaticMember } from '../utils/ast'

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private typeComputer: TypeComputer

  constructor(services: IntelliZenServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  override getScope(context: ReferenceInfo): Scope {
    const { container } = context

    if (isImportDeclaration(container)) {
      return this.scopeImportDeclaration(context)
    }

    // if (isMemberAccess(container)) {
    //   const members = this.member(container.receiver)
    //   return this.createScope(members)
    // }
    // else if (isTypeReference(container)) {
    //   const members = this.memberTypeReference(container)
    //   return this.createScope(members)
    // }

    return super.getScope(context)
  }

  /* TODO: WIP, for testing only */
  private scopeImportDeclaration(context: ReferenceInfo): Scope {
    const packageTree = new HierarchyTree<AstNode>()
    this.indexManager.allElements().forEach(desc => packageTree.setValue(desc.name, desc.node))

    const importDecl = context.container as ImportDeclaration
    const path = getPathAsString(importDecl, context)
    const siblings = packageTree.getNode(path)?.children

    const elements: AstNodeDescription[] = []
    siblings?.forEach((hNode, hName) => {
      if (hNode.value) {
        elements.push(this.descriptions.createDescription(hNode.value, hName))
      }
      else {
        elements.push({
          type: 'package',
          name: hName,
          documentUri: URI.file('file:///path/to/package'),
          path: '',
        })
      }
    })

    return this.createScope(elements)
  }

  private member(node: AstNode | undefined): AstNodeDescription[] {
    if (isExpression(node)) {
      return this.memberExpression(node)
    }
    else if (isDeclaration(node)) {
      return this.memberDeclaration(node)
    }
    else if (isTypeReference(node)) {
      return this.memberTypeReference(node)
    }
    else if (isScript(node)) {
      return this.memberScript(node)
    }
    else {
      return []
    }
  }

  private memberScript(node: Script): AstNodeDescription[] {
    const members: AstNode[] = []
    node.classes.forEach(it => members.push(it))
    node.functions.forEach(it => members.push(it))
    node.statements.filter(it => isVariableDeclaration(it))
      .filter(it => it.prefix === 'static')
      .forEach(it => members.push(it))
    return members.map(it => this.createDescriptionForNode(it))
  }

  // region Declaration
  private memberDeclaration(node: Declaration | undefined): AstNodeDescription[] {
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

  private memberImportDeclaration(node: ImportDeclaration): AstNodeDescription[] {
    const element = this.indexManager.allElements().find((it) => {
      const qName = this.nameProvider.getQualifiedName(it.node!)
      return node.path.at(-1)?.$refText === qName
    })?.node

    if (isScript(element)) {
      return this.memberScript(element)
    }
    else if (isClassDeclaration(element)) {
      return this.memberClassDeclaration(element)
    }
    else {
      return []
    }
  }

  private memberClassDeclaration(node: ClassDeclaration): AstNodeDescription[] {
    return getClassChain(node)
      .flatMap(it => it.members)
      .filter(it => isStaticMember(it))
      .map(it => this.createDescriptionForNode(it))
  }
  // endregion

  // region Expression
  private memberExpression(node: Expression): AstNodeDescription[] {
    if (isLocalVariable(node)) {
      return this.memberLocalVariable(node)
    }
    else {
      const type = this.typeComputer.inferType(node)
      return this.memberTypeDescription(type)
    }
  }

  private memberLocalVariable(node: LocalVariable): AstNodeDescription[] {
    const ref = node.refer.ref
    if (isImportDeclaration(ref)) {
      return this.memberImportDeclaration(ref)
    }
    else if (isClassDeclaration(ref)) {
      return this.memberClassDeclaration(ref)
    }
    else {
      return []
    }
  }
  // endregion

  // region TypeReference
  private memberTypeReference(node: TypeReference | undefined): AstNodeDescription[] {
    if (isClassType(node)) {
      return this.memberClassTypeReference(node)
    }
    else {
      return []
    }
  }

  private memberClassTypeReference(node: ClassType): AstNodeDescription[] {
    const script = AstUtils.findRootNode(node) as Script
    const result: AstNodeDescription[] = []
    script.imports.forEach((importDecl) => {
      const importDeclName = this.nameProvider.getName(importDecl)
      const ref = importDecl.path.at(-1)?.ref
      if (isScript(ref)) {
        const scriptMembers = this.memberScript(ref)
        scriptMembers.forEach((member) => {
          member.name = `${importDeclName}.${member.name}`
        })
        result.push(...scriptMembers)
      }
      else if (ref) {
        result.push(this.createDescriptionForNode(ref, importDeclName))
      }
    })
    return result
  }
  // endregion

  // region TypeDescription
  private memberTypeDescription(type: TypeDescription | undefined): AstNodeDescription[] {
    if (isClassTypeDesc(type)) {
      return this.memberClassTypeDescription(type)
    }
    else {
      return []
    }
  }

  private memberClassTypeDescription(type: ClassTypeDescription): AstNodeDescription[] {
    const ref = type.ref?.ref
    return getClassChain(ref)
      .flatMap(it => it.members)
      .filter(it => !isStaticMember(it))
      .map(it => this.createDescriptionForNode(it))
  }
  // endregion

  private createDescriptionForNode(node: AstNode, name?: string): AstNodeDescription {
    name ??= this.nameProvider.getName(node)
    return this.descriptions.createDescription(node, name)
  }
}
