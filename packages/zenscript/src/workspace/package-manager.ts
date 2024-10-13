import type { AstNode, LangiumDocument } from 'langium'
import { AstUtils, DocumentState, stream } from 'langium'
import type { HierarchyNode } from '@intellizen/shared'
import { HierarchyTree } from '@intellizen/shared'
import type { ZenScriptServices } from '../module'
import type { Script } from '../generated/ast'
import { isClassDeclaration } from '../generated/ast'
import { isStatic } from '../utils/ast'
import { getQualifiedName, isDzs, isZs } from '../utils/document'
import type { ZenScriptNameProvider } from '../name'

export interface PackageManager {
  getAstNode: (path: string) => AstNode | undefined
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
      this.insert(document as LangiumDocument<Script>)
    })

    // remove data once document is changed or deleted
    services.shared.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
      stream(changed, deleted)
        .map(it => services.shared.workspace.LangiumDocuments.getDocument(it))
        .filter(it => !!it)
        .forEach(it => this.remove(it))
    })
  }

  getAstNode(path: string): AstNode | undefined {
    return this.packageTree.getValue(path)
  }

  getHierarchyNode(path: string): HierarchyNode<AstNode> | undefined {
    return this.packageTree.getNode(path)
  }

  private insert(document: LangiumDocument<Script>) {
    const script = document.parseResult.value
    if (isZs(document)) {
      const name = getQualifiedName(document)
      this.packageTree.setValue(name, script)
    }
    AstUtils.streamContents(document.parseResult.value)
      .forEach((toplevel) => {
        const name = this.nameProvider.getQualifiedName(toplevel)
        if (isStatic(toplevel)) {
          this.packageTree.setValue(name, toplevel)
        }
        else if (isClassDeclaration(toplevel)) {
          this.packageTree.setValue(name, toplevel)
          AstUtils.streamContents(toplevel)
            .forEach((classMember) => {
              if (isStatic(classMember)) {
                const name = this.nameProvider.getQualifiedName(classMember)
                this.packageTree.setValue(name, classMember)
              }
            })
        }
      })
  }

  private remove(document: LangiumDocument) {
    if (isZs(document)) {
      const name = getQualifiedName(document as LangiumDocument<Script>)
      if (name) {
        this.packageTree.getNode(name)?.free()
      }
    }
    else if (isDzs(document)) {
      AstUtils.streamContents(document.parseResult.value)
        .filter(it => isClassDeclaration(it))
        .forEach((it) => {
          const name = this.nameProvider.getQualifiedName(it)
          this.packageTree.getNode(name)?.free()
        })
    }
  }
}
