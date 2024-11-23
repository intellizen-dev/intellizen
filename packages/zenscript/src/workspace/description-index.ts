import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider, NameProvider } from 'langium'
import type { ClassDeclaration, ImportDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'

export interface DescriptionIndex {
  getDescription: (astNode: AstNode) => AstNodeDescription
  getThisDescription: (classDecl: ClassDeclaration) => AstNodeDescription
  createDynamicDescription: (astNode: AstNode, name: string) => AstNodeDescription
  createImportedDescription: (importDecl: ImportDeclaration) => AstNodeDescription
}

export class ZenScriptDescriptionIndex implements DescriptionIndex {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly nameProvider: NameProvider

  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.nameProvider = services.references.NameProvider
    this.astDescriptions = new WeakMap()
    this.thisDescriptions = new WeakMap()
  }

  getDescription(astNode: AstNode): AstNodeDescription {
    if (!this.astDescriptions.has(astNode)) {
      this.astDescriptions.set(astNode, this.descriptions.createDescription(astNode, undefined))
    }
    return this.astDescriptions.get(astNode)!
  }

  getThisDescription(classDecl: ClassDeclaration): AstNodeDescription {
    if (!this.thisDescriptions.has(classDecl)) {
      this.thisDescriptions.set(classDecl, this.descriptions.createDescription(classDecl, 'this'))
    }
    return this.thisDescriptions.get(classDecl)!
  }

  createDynamicDescription(astNode: AstNode, name: string): AstNodeDescription {
    return this.descriptions.createDescription(astNode, name)
  }

  createImportedDescription(importDecl: ImportDeclaration): AstNodeDescription {
    const ref = importDecl.path.at(-1)?.ref ?? importDecl
    return this.descriptions.createDescription(ref, this.nameProvider.getName(importDecl))
  }
}
