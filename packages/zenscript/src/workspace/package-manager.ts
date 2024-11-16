import type { HierarchyNode } from '@intellizen/shared'
import type { AstNode, AstNodeDescription, LangiumDocument, NameProvider } from 'langium'
import type { ZenScriptServices } from '../module'
import { HierarchyTree } from '@intellizen/shared'
import { AstUtils, DocumentState, stream } from 'langium'
import { isClassDeclaration } from '../generated/ast'
import { createSyntheticAstNodeDescription } from '../reference/synthetic'
import { isImportable, isStatic } from '../utils/ast'

export interface PackageManager {
  retrieve: (path: string) => ReadonlySet<AstNode>
  find: (path: string) => HierarchyNode<AstNode> | undefined
  syntheticDescriptionOf: (node: HierarchyNode<AstNode>) => AstNodeDescription

  root: HierarchyNode<AstNode>
}

export class ZenScriptPackageManager implements PackageManager {
  private readonly nameProvider: NameProvider
  private readonly packageTree: HierarchyTree<AstNode>

  private readonly packageScopes: WeakMap<HierarchyNode<AstNode>, AstNodeDescription>

  constructor(services: ZenScriptServices) {
    this.nameProvider = services.references.NameProvider
    this.packageTree = new HierarchyTree()
    this.packageScopes = new WeakMap()

    // insert data once document is indexed content
    services.shared.workspace.DocumentBuilder.onDocumentPhase(DocumentState.IndexedContent, (document) => {
      this.insert(document)
    })

    // remove data once document is changed or deleted
    services.shared.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
      stream(changed, deleted)
        .map(it => services.shared.workspace.LangiumDocuments.getDocument(it))
        .filter(it => !!it)
        .forEach(it => this.remove(it))
    })
  }

  retrieve(path: string): ReadonlySet<AstNode> {
    return this.packageTree.retrieve(path)
  }

  find(path: string): HierarchyNode<AstNode> | undefined {
    return this.packageTree.find(path)
  }

  get root(): HierarchyNode<AstNode> {
    return this.packageTree.root
  }

  syntheticDescriptionOf(node: HierarchyNode<AstNode>): AstNodeDescription {
    if (!node.isInternalNode()) {
      throw new Error('Cannot create package description for data node')
    }

    if (this.packageScopes.has(node)) {
      return this.packageScopes.get(node)!
    }

    const ret = createSyntheticAstNodeDescription('SyntheticHierarchyNode', node.name, node)
    this.packageScopes.set(node, ret)
    return ret
  }

  private insert(document: LangiumDocument) {
    const root = document.parseResult.value
    if (isImportable(root)) {
      this.insertNode(root)
    }
    AstUtils.streamContents(root)
      .filter(toplevel => isImportable(toplevel))
      .forEach((toplevel) => {
        this.insertNode(toplevel)
        if (isClassDeclaration(toplevel)) {
          AstUtils.streamContents(toplevel)
            .filter(classMember => isStatic(classMember))
            .forEach((classMember) => {
              this.insertNode(classMember)
            })
        }
      })
  }

  private insertNode(node: AstNode) {
    const name = this.nameProvider.getQualifiedName(node)
    if (name) {
      this.packageTree.insert(name, node)
    }
  }

  private remove(document: LangiumDocument) {
    const root = document.parseResult.value
    if (isImportable(root)) {
      this.removeNode(root)
    }
    AstUtils.streamContents(root)
      .filter(toplevel => isImportable(toplevel))
      .forEach(classDecl => this.removeNode(classDecl))
  }

  private removeNode(node: AstNode) {
    const name = this.nameProvider.getQualifiedName(node)
    if (name) {
      this.packageTree.find(name)?.free()
    }
  }
}
