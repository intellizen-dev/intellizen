import type { ZenScriptServices } from '../module'
import type { DescriptionCreator } from './description-creator'
import { type AstNode, type AstNodeDescription, type NameProvider, stream } from 'langium'
import { type ClassDeclaration, type ImportDeclaration, isClassDeclaration, isFunctionDeclaration } from '../generated/ast'
import { getDocumentUri, isStatic } from '../utils/ast'

export interface DescriptionIndex {
  getDescription: (astNode: AstNode) => AstNodeDescription
  getThisDescription: (classDecl: ClassDeclaration) => AstNodeDescription
  createDynamicDescription: (astNode: AstNode, name: string) => AstNodeDescription
  createImportedDescriptions: (importDecl: ImportDeclaration) => AstNodeDescription[]
}

export class ZenScriptDescriptionIndex implements DescriptionIndex {
  private readonly creator: DescriptionCreator
  private readonly nameProvider: NameProvider

  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>

  constructor(services: ZenScriptServices) {
    this.creator = services.workspace.AstNodeDescriptionProvider
    this.nameProvider = services.references.NameProvider
    this.astDescriptions = new WeakMap()
    this.thisDescriptions = new WeakMap()
  }

  getDescription(astNode: AstNode): AstNodeDescription {
    if (!this.astDescriptions.has(astNode)) {
      const uri = getDocumentUri(astNode)
      const desc = this.creator.createDescriptionWithUri(astNode, uri)
      this.astDescriptions.set(astNode, desc)
    }
    return this.astDescriptions.get(astNode)!
  }

  getThisDescription(classDecl: ClassDeclaration): AstNodeDescription {
    if (!this.thisDescriptions.has(classDecl)) {
      const uri = getDocumentUri(classDecl)
      const desc = this.creator.createDescriptionWithUri(classDecl, uri, 'this')
      this.thisDescriptions.set(classDecl, desc)
    }
    return this.thisDescriptions.get(classDecl)!
  }

  createDynamicDescription(astNode: AstNode, name: string): AstNodeDescription {
    const existing = this.astDescriptions.get(astNode)
    if (existing?.name === name) {
      return existing
    }
    const originalUri = existing?.documentUri
    return this.creator.createDescriptionWithUri(astNode, originalUri, name)
  }

  createImportedDescriptions(importDecl: ImportDeclaration): AstNodeDescription[] {
    const targetRef = importDecl.path.at(-1)
    if (!targetRef) {
      return [this.getDescription(importDecl)]
    }

    const target = targetRef.ref
    if (!target) {
      return [this.getDescription(importDecl)]
    }

    // TODO: Workaround for function overloading, may rework after langium supports multi-target references
    if (isFunctionDeclaration(target)) {
      const classDecl = importDecl.path.at(-2)?.ref
      if (!isClassDeclaration(classDecl)) {
        return []
      }

      return stream(classDecl.members)
        .filter(isFunctionDeclaration)
        .filter(isStatic)
        .filter(it => it.name === target.name)
        .map(it => this.createDynamicDescription(it, it.name))
        .toArray()
    }

    const targetDescription = targetRef.$nodeDescription
    if (!importDecl.alias && targetDescription) {
      return [targetDescription]
    }

    const targetUri = targetDescription?.documentUri
    const alias = this.nameProvider.getName(importDecl)
    return [this.creator.createDescriptionWithUri(target, targetUri, alias)]
  }
}
