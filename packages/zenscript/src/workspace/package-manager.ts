import type { AstNode, LangiumDocument, NameProvider, ServiceRegistry } from 'langium'
import type { ZenScriptSharedServices } from '../module'
import type { HierarchyNode } from '../utils/hierarchy-tree'
import { AstUtils, DocumentState, stream } from 'langium'
import { isClassDeclaration } from '../generated/ast'
import { isImportable, isStatic } from '../utils/ast'
import { HierarchyTree } from '../utils/hierarchy-tree'

export interface PackageManager {
  retrieve: (path: string) => ReadonlySet<AstNode>
  find: (path: string) => HierarchyNode<AstNode> | undefined
  root: HierarchyNode<AstNode>
}

export class ZenScriptPackageManager implements PackageManager {
  // private readonly nameProvider: NameProvider
  private readonly packageTree: HierarchyTree<AstNode>
  private readonly serviceRegistry: ServiceRegistry

  constructor(services: ZenScriptSharedServices) {
    // this.nameProvider = services.references.NameProvider
    this.packageTree = new HierarchyTree()

    this.serviceRegistry = services.ServiceRegistry

    // insert data once document is indexed content
    services.workspace.DocumentBuilder.onDocumentPhase(DocumentState.IndexedContent, (document) => {
      this.insert(document)
    })

    // remove data once document is changed or deleted
    services.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
      stream(changed, deleted)
        .map(it => services.workspace.LangiumDocuments.getDocument(it))
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

  private insert(document: LangiumDocument) {
    const services = this.serviceRegistry.getServices(document.uri)
    const nameProvider = services.references.NameProvider
    const root = document.parseResult.value
    if (isImportable(root)) {
      this.insertNode(root, nameProvider)
    }
    AstUtils.streamContents(root)
      .filter(toplevel => isImportable(toplevel))
      .forEach((toplevel) => {
        this.insertNode(toplevel, nameProvider)
        if (isClassDeclaration(toplevel)) {
          AstUtils.streamContents(toplevel)
            .filter(classMember => isStatic(classMember))
            .forEach((classMember) => {
              this.insertNode(classMember, nameProvider)
            })
        }
      })
  }

  private insertNode(node: AstNode, nameProvider: NameProvider) {
    // const nameProvider =
    const name = nameProvider.getQualifiedName(node)
    if (name) {
      this.packageTree.insert(name, node)
    }
  }

  private remove(document: LangiumDocument) {
    const services = this.serviceRegistry.getServices(document.uri)
    const nameProvider = services.references.NameProvider
    const root = document.parseResult.value
    if (isImportable(root)) {
      this.removeNode(root, nameProvider)
    }
    AstUtils.streamContents(root)
      .filter(toplevel => isImportable(toplevel))
      .forEach(classDecl => this.removeNode(classDecl, nameProvider))
  }

  private removeNode(node: AstNode, nameProvider: NameProvider) {
    const name = nameProvider.getQualifiedName(node)
    if (name) {
      this.packageTree.find(name)?.free()
    }
  }
}
