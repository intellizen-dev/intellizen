import type { AstNode, AstNodeDescription } from 'langium'
import type { ClassDeclaration } from '../generated/ast'

export interface DescriptionCache {

  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>
  getOrCreateDescription: (astNode: AstNode, factory: (astNode: AstNode) => AstNodeDescription) => AstNodeDescription
  getOrCreateThisDescription: (classDecl: ClassDeclaration, factory: (classDecl: ClassDeclaration) => AstNodeDescription) => AstNodeDescription
}

export class ZenScriptDescriptionCache implements DescriptionCache {
  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>

  constructor() {
    this.astDescriptions = new WeakMap()
    this.thisDescriptions = new WeakMap()
  }

  public getOrCreateDescription(astNode: AstNode, factory: (astNode: AstNode) => AstNodeDescription): AstNodeDescription {
    if (!this.astDescriptions.has(astNode)) {
      const desc = factory(astNode)
      this.astDescriptions.set(astNode, desc)
    }
    return this.astDescriptions.get(astNode)!
  }

  public getOrCreateThisDescription(classDecl: ClassDeclaration, factory: (classDecl: ClassDeclaration) => AstNodeDescription): AstNodeDescription {
    if (!this.thisDescriptions.has(classDecl)) {
      const desc = factory(classDecl)
      this.thisDescriptions.set(classDecl, desc)
    }
    return this.thisDescriptions.get(classDecl)!
  }
}
