import type { HierarchyNode } from '@intellizen/shared'
import type { ZenScriptServices } from '../module'
import type { ZenScriptPackageManager } from './package-manager'
import { type AstNode, type AstNodeDescription, type AstNodeDescriptionProvider, type NameProvider, stream } from 'langium'
import { type ClassDeclaration, type ImportDeclaration, isClassDeclaration, isFunctionDeclaration } from '../generated/ast'
import { createSyntheticAstNodeDescription } from '../reference/synthetic'
import { isStatic } from '../utils/ast'

export interface DescriptionIndex {
  getDescription: (astNode: AstNode) => AstNodeDescription
  getPackageDescription: (pkgNode: HierarchyNode<AstNode>) => AstNodeDescription
  getThisDescription: (classDecl: ClassDeclaration) => AstNodeDescription
  createDynamicDescription: (astNode: AstNode, name: string) => AstNodeDescription
  createImportedDescription: (importDecl: ImportDeclaration) => AstNodeDescription[]
}

export class ZenScriptDescriptionIndex implements DescriptionIndex {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly nameProvider: NameProvider

  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly pkgDescriptions: WeakMap<HierarchyNode<AstNode>, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>

  private readonly packageManager: ZenScriptPackageManager

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.nameProvider = services.references.NameProvider
    this.astDescriptions = new WeakMap()
    this.pkgDescriptions = new WeakMap()
    this.thisDescriptions = new WeakMap()
    this.packageManager = services.workspace.PackageManager
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

  createImportedDescription(importDecl: ImportDeclaration): AstNodeDescription[] {
    const ref = importDecl.path.at(-1)?.ref
    if (!ref) {
      return [this.getDescription(importDecl)]
    }
    const alias = importDecl.alias

    // handle import overloading
    if (isFunctionDeclaration(ref)) {
      // Find function with same name in the same package
      const parentRef = importDecl.path.at(-2)?.ref
      if (!parentRef) {
        return []
      }

      if (isClassDeclaration(parentRef)) {
        const result = stream(parentRef.members)
          .filter(it => isFunctionDeclaration(it))
          .filter(it => it.name === ref.name)
          .filter(it => isStatic(it))
          .map(it => this.getDescription(it))
          .map(it => alias ? this.aliasDescription(it, alias) : it)
          .toArray()
        return result
      }
    }

    const targetDesc = importDecl.path.at(-1)?.$nodeDescription || this.descriptions.createDescription(importDecl, this.nameProvider.getName(importDecl))
    return [alias ? this.aliasDescription(targetDesc, alias) : targetDesc]
  }

  private aliasDescription(desc: AstNodeDescription, alias: string): AstNodeDescription {
    const { node, selectionSegment, type, documentUri, path } = desc
    return {
      node,
      name: alias,
      get nameSegment() {
        return desc.nameSegment
      },
      selectionSegment,
      type,
      documentUri,
      path,
    }
  }
}
