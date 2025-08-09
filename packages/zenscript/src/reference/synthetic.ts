import type { AstNode, AstNodeDescription } from 'langium'
import type { NamespaceNode } from '../utils/namespace-tree'
import { URI } from 'langium'

export interface ZenScriptSyntheticAstType {
  SyntheticAstNode: SyntheticAstNode
}

export type SyntheticAstNodeContent = NamespaceNode<AstNode> | { $type: 'Unknown' } | { $type: 'StringLiteral' }

/**
 * Wrap a given content as an AstNode.
 * This is used to create synthetic nodes for the purpose of linking.
 *
 * @param content The content to wrap
 * @returns The wrapped content as an AstNode.
 */
export class SyntheticAstNode implements AstNode {
  readonly $type = 'SyntheticAstNode'
  readonly content: SyntheticAstNodeContent
  constructor(content: SyntheticAstNodeContent) {
    this.content = content
  }
}

export function createSyntheticAstNodeDescription(name: string, content: SyntheticAstNodeContent): AstNodeDescription {
  return {
    name,
    type: 'SyntheticAstNode',
    node: new SyntheticAstNode(content),
    documentUri: URI.from({ scheme: 'synthetic', path: name }),
    path: '',
  }
}

export function isSyntheticAstNode(node: AstNode): node is SyntheticAstNode {
  return node.$type === 'SyntheticAstNode'
}
