import type { AstNode } from 'langium'
import type { HierarchyNode } from '../utils/hierarchy-tree'

export interface ZenScriptSyntheticAstType {
  SyntheticHierarchyNode: HierarchyNode<AstNode>
}

export function isSyntheticAstNode(node: AstNode): boolean {
  return node?.$type?.startsWith('Synthetic')
}
