import type { AstNode, LangiumDocument } from 'langium'
import { AstUtils, DocumentState, stream } from 'langium'
import type { HierarchyNode } from '@intellizen/shared'
import { HierarchyTree } from '@intellizen/shared'
import type { ZenScriptServices } from '../module'
import { isClassDeclaration } from '../generated/ast'
import { isImportable, isStatic } from '../utils/ast'
import type { ZenScriptNameProvider } from '../name'

export interface PackageManager {
  getAstNode: (path: string) => AstNode[] | undefined
  getHierarchyNode: (path: string) => HierarchyNode<AstNode> | undefined
}

export class ZenScriptPackageManager implements PackageManager {
  private readonly nameProvider: ZenScriptNameProvider
  private readonly packageTree: HierarchyTree<AstNode>

  constructor(services: ZenScriptServices) {
    this.nameProvider = services.references.NameProvider
    this.packageTree = new HierarchyTree()

    // insert data once document is computed
    services.shared.workspace.DocumentBuilder.onDocumentPhase(DocumentState.ComputedScopes, (document) => {
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

  getAstNode(path: string): AstNode[] | undefined {
    return this.packageTree.retrieve(path)
  }

  getHierarchyNode(path: string): HierarchyNode<AstNode> | undefined {
    return this.packageTree.getNode(path)
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
      .filter(toplevel => isClassDeclaration(toplevel))
      .forEach(classDecl => this.removeNode(classDecl))
  }

  private removeNode(node: AstNode) {
    const name = this.nameProvider.getQualifiedName(node)
    if (name) {
      this.packageTree.getNode(name)?.free()
    }
  }
}
