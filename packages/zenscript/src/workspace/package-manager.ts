import type { AstNode, IndexManager } from 'langium'
import { DocumentState } from 'langium'
import type { HierarchyNode } from '@intellizen/shared'
import { HierarchyTree } from '@intellizen/shared'
import type { ZenScriptServices } from '../module'

export interface PackageManager {
  getAstNode: (path: string) => AstNode | undefined
  getHierarchyNode: (path: string) => HierarchyNode<AstNode> | undefined
}

export class ZenScriptPackageManager implements PackageManager {
  private readonly indexManager: IndexManager
  private readonly packageTree: HierarchyTree<AstNode>

  constructor(services: ZenScriptServices) {
    this.indexManager = services.shared.workspace.IndexManager
    this.packageTree = new HierarchyTree()

    // Update data once documents are indexed
    services.shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.IndexedContent, () => {
      this.indexManager.allElements().forEach(it => this.packageTree.setValue(it.name, it.node))
    })
  }

  getAstNode(path: string): AstNode | undefined {
    return this.packageTree.getValue(path)
  }

  getHierarchyNode(path: string): HierarchyNode<AstNode> | undefined {
    return this.packageTree.getNode(path)
  }
}
