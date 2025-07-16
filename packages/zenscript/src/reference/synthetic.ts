import type { AstNode, AstNodeDescription } from 'langium'
import type { HierarchyNode } from '../utils/hierarchy-tree'
import { URI } from 'langium'

export interface ZenScriptSyntheticAstType {
  SyntheticHierarchyNode: HierarchyNode<AstNode>
  SyntheticUnknown: AstNode
  SyntheticStringLiteral: AstNode
}
export function createStringLiteralAstDescription(name: string): AstNodeDescription {
  return {
    name,
    node: createSyntheticStringLiteral(),
    type: 'SyntheticStringLiteral',
    documentUri: URI.from({ scheme: 'unknown' }),
    path: '',
  }
}

export function createUnknownAstDescription(name: string): AstNodeDescription {
  return {
    name,
    node: createUnknownAst(),
    type: 'SyntheticUnknown',
    documentUri: URI.from({ scheme: 'unknown' }),
    path: '',
  }
}

export function createUnknownAst(): AstNode {
  return {
    $type: 'SyntheticUnknown',
  }
}

export function createSyntheticStringLiteral(): AstNode {
  return {
    $type: 'SyntheticStringLiteral',
  }
}

export function isSyntheticAstNode(node: AstNode): boolean {
  return node?.$type?.startsWith('Synthetic')
}
