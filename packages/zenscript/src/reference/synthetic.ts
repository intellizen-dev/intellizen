import type { HierarchyNode } from '@intellizen/shared'
import type { AstNode, AstNodeDescription } from 'langium'
import { URI } from 'langium'

export interface ZenScriptSyntheticAstType {
  SyntheticHierarchyNode: AstNode & HierarchyNode<AstNode>
}

export function createSyntheticAstNodeDescription<K extends keyof ZenScriptSyntheticAstType>(
  $type: K,
  name: string,
  origin?: ZenScriptSyntheticAstType[K],
): AstNodeDescription {
  return {
    node: createSyntheticAstNode($type, origin),
    type: $type,
    name,
    documentUri: URI.from({ scheme: 'synthetic', path: `/${$type}/${name}` }),
    path: '',
  }
}

export function createSyntheticAstNode($type: string, origin?: any): AstNode {
  return { $type, ...origin }
}

export function isSyntheticAstNode(node: AstNode): boolean {
  return node?.$type?.startsWith('Synthetic')
}
