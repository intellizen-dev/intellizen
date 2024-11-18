import type { HierarchyNode } from '@intellizen/shared'
import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import type { ClassDeclaration, ImportDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { createSyntheticAstNodeDescription } from '../reference/synthetic'

export interface DescriptionIndex {
  getDescription: (astNode: AstNode) => AstNodeDescription
  getPackageDescription: (pkgNode: HierarchyNode<AstNode>) => AstNodeDescription
  getThisDescription: (classDecl: ClassDeclaration) => AstNodeDescription
  createDynamicDescription: (astNode: AstNode, name: string) => AstNodeDescription
  createImportedDescription: (importDecl: ImportDeclaration) => AstNodeDescription
}

export class ZenScriptDescriptionIndex implements DescriptionIndex {
  private readonly descriptions: AstNodeDescriptionProvider

  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly pkgDescriptions: WeakMap<HierarchyNode<AstNode>, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.astDescriptions = new WeakMap()
    this.pkgDescriptions = new WeakMap()
    this.thisDescriptions = new WeakMap()
  }

  getDescription(astNode: AstNode): AstNodeDescription {
    if (!this.astDescriptions.has(astNode)) {
      this.astDescriptions.set(astNode, this.descriptions.createDescription(astNode, undefined))
    }
    return this.astDescriptions.get(astNode)!
  }

  getPackageDescription(pkgNode: HierarchyNode<AstNode>): AstNodeDescription {
    if (pkgNode.isDataNode()) {
      throw new Error(`Expected a package node, but received a data node: ${pkgNode}`)
    }
    if (!this.pkgDescriptions.has(pkgNode)) {
      this.pkgDescriptions.set(pkgNode, createSyntheticAstNodeDescription('SyntheticHierarchyNode', pkgNode.name, pkgNode))
    }
    return this.pkgDescriptions.get(pkgNode)!
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
    return this.descriptions.createDescription(ref, undefined)
  }
}
