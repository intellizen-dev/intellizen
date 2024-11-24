import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider, NameProvider } from 'langium'
import type { ClassDeclaration, ImportDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { getDocumentUri } from '../utils/ast'

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
      const uri = getDocumentUri(astNode)
      const desc = this.descriptions.createDescriptionWithUri(astNode, uri)
      this.astDescriptions.set(astNode, desc)
    }
    return this.astDescriptions.get(astNode)!
  }

  getThisDescription(classDecl: ClassDeclaration): AstNodeDescription {
    if (!this.thisDescriptions.has(classDecl)) {
      const uri = getDocumentUri(classDecl)
      const desc = this.descriptions.createDescriptionWithUri(classDecl, uri, 'this')
      this.thisDescriptions.set(classDecl, desc)
    }
    return this.thisDescriptions.get(classDecl)!
  }

  createDynamicDescription(astNode: AstNode, name: string): AstNodeDescription {
    const originalUri = this.astDescriptions.get(astNode)?.documentUri
    return this.descriptions.createDescriptionWithUri(astNode, originalUri, name)
  }

  createImportedDescription(importDecl: ImportDeclaration): AstNodeDescription {
    const targetRef = importDecl.path.at(-1)
    if (!targetRef) {
      return this.getDescription(importDecl)
    }

    const target = targetRef.ref
    if (!target) {
      return this.getDescription(importDecl)
    }

    const targetDescription = targetRef.$nodeDescription
    if (!importDecl.alias && targetDescription) {
      return targetDescription
    }

    const targetUri = targetDescription?.documentUri
    const alias = this.nameProvider.getName(importDecl)
    return this.descriptions.createDescriptionWithUri(target, targetUri, alias)
  }
}
