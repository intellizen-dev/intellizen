import type { AstNode } from 'langium'
import { isScript } from '../generated/ast'

export function isToplevel(node: AstNode): boolean {
  return isScript(node.$container)
}
