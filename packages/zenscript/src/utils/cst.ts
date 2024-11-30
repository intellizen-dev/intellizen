import type { AstNode, CstNode } from 'langium'
import { CstUtils, isAstNode } from 'langium'

export function firstTokenTypeName(node: AstNode | CstNode | undefined): string | undefined {
  const cstNode = isAstNode(node) ? node.$cstNode : node
  if (!cstNode) {
    return
  }
  return CstUtils.flattenCst(cstNode).head()?.tokenType?.name
}
