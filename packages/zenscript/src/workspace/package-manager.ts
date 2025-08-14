import type { AstNode, LangiumDocument, NameProvider } from 'langium'
import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { NamespaceNode } from '../utils/namespace-tree'
import { DocumentState, stream } from 'langium'
import { isClassDeclaration } from '../generated/ast'
import { isStatic } from '../utils/ast'
import { isZs } from '../utils/document'
import { NamespaceTree } from '../utils/namespace-tree'

export interface PackageManager {
  find: (path: string) => ReadonlySet<AstNode>
  findNode: (path: string) => NamespaceNode<AstNode> | undefined
  root: NamespaceNode<AstNode>
}

export class ZenScriptPackageManager implements PackageManager {
  private readonly packages: NamespaceTree<AstNode> = new NamespaceTree('.')
  private readonly nameProvider: () => NameProvider
  private readonly memberProvider: () => MemberProvider

  constructor(services: ZenScriptServices) {
    this.nameProvider = () => services.references.NameProvider
    this.memberProvider = () => services.references.MemberProvider

    // insert data once document is indexed content
    services.shared.workspace.DocumentBuilder.onDocumentPhase(DocumentState.IndexedContent, (document) => {
      this.insert(document)
    })

    // remove data once document is changed or deleted
    services.shared.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
      stream(changed, deleted)
        .map(it => services.shared.workspace.LangiumDocuments.getDocument(it))
        .nonNullable()
        .forEach(it => this.remove(it))
    })
  }

  find(path: string): ReadonlySet<AstNode> {
    return this.packages.find(path)
  }

  findNode(path: string): NamespaceNode<AstNode> | undefined {
    return this.packages.findNode(path)
  }

  get root(): NamespaceNode<AstNode> {
    return this.packages.root
  }

  private insert(document: LangiumDocument) {
    const root = document.parseResult.value
    if (isZs(document)) {
      this.insertNode(root)
    }
    const toplevels = this.memberProvider().streamMembers(root)
    for (const toplevel of toplevels) {
      this.insertNode(toplevel)
      if (isClassDeclaration(toplevel)) {
        for (const staticMember of toplevel.members.filter(isStatic)) {
          this.insertNode(staticMember)
        }
      }
    }
  }

  private insertNode(node: AstNode) {
    const name = this.nameProvider().getQualifiedName(node)
    if (name) {
      this.packages.insert(name, node)
    }
  }

  private remove(document: LangiumDocument) {
    const root = document.parseResult.value
    if (isZs(document)) {
      this.removeNode(root)
    }
    const toplevels = this.memberProvider().streamMembers(root)
    for (const toplevel of toplevels) {
      this.removeNode(toplevel)
      if (isClassDeclaration(toplevel)) {
        for (const staticMember of toplevel.members.filter(isStatic)) {
          this.removeNode(staticMember)
        }
      }
    }
  }

  private removeNode(node: AstNode) {
    const name = this.nameProvider().getQualifiedName(node)
    if (name) {
      this.packages.findNode(name)?.free()
    }
  }
}
