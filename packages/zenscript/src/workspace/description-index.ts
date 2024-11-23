import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider, LangiumDocument, LangiumDocuments, NameProvider } from 'langium'
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
  private readonly documents: LangiumDocuments

  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.nameProvider = services.references.NameProvider
    this.astDescriptions = new WeakMap()
    this.thisDescriptions = new WeakMap()
    this.documents = services.shared.workspace.LangiumDocuments
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
    const existing = this.astDescriptions.get(astNode)
    const document = existing?.documentUri ? this.documents.getDocument(existing.documentUri) : undefined
    return this.descriptions.createDescription(astNode, name, document)
  }

  createImportedDescription(importDecl: ImportDeclaration): AstNodeDescription {
    const importRef = importDecl.path.at(-1)
    const ref = importRef?.ref
    if (!importRef || !ref) {
      return this.getDescription(importDecl)
    }
    if (!importDecl.alias) {
      return importRef.$nodeDescription!
    }
    const document = this.documents.getDocument(importRef.$nodeDescription!.documentUri)
    return this.descriptions.createDescription(ref, this.nameProvider.getName(importDecl), document)
  }
}
