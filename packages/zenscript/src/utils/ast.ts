import type { AstNode, AstNodeDescription } from 'langium'
import type { BracketExpression, ClassDeclaration, ImportDeclaration } from '../generated/ast'
import { AstUtils, isAstNodeDescription } from 'langium'
import { isBracketExpression, isClassDeclaration, isFunctionDeclaration, isImportDeclaration, isScript } from '../generated/ast'
import { isZs } from './document'

export function isToplevel(node: AstNode | undefined): boolean {
  return isScript(node?.$container)
}

export function getClassChain(clazz?: ClassDeclaration): ClassDeclaration[] {
  if (!clazz) {
    return []
  }
  if (!clazz.superTypes) {
    return [clazz]
  }

  const set = new Set<ClassDeclaration>()
  set.add(clazz)
  clazz.superTypes
    .map(it => it.path.at(-1)?.ref)
    .filter(it => isClassDeclaration(it))
    .flatMap(it => getClassChain(it))
    .forEach(it => set.add(it))
  return Array.from(set)
}

export function isStatic(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'static'
}

export function isGlobal(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'global'
}

export function isConst(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'val'
}

export function isImportable(node: AstNode | undefined) {
  if (isScript(node)) {
    return isZs(AstUtils.getDocument(node))
  }
  else if (isToplevel(node) && isFunctionDeclaration(node)) {
    return true
  }
  else {
    return isStatic(node) || isClassDeclaration(node)
  }
}

export function getPathAsString(importDecl: ImportDeclaration, index?: number): string
export function getPathAsString(bracket: BracketExpression): string
export function getPathAsString(astNode: ImportDeclaration | BracketExpression, index?: number): string {
  if (isImportDeclaration(astNode)) {
    let names = astNode.path.map(it => it.$refText)
    if (index !== undefined) {
      names = names.slice(0, index + 1)
    }
    return names.join('.')
  }
  else if (isBracketExpression(astNode)) {
    return astNode.path.map(it => it?.$cstNode?.text).join(':')
  }
  else {
    throw new Error(`Illegal argument: ${astNode}`)
  }
}

export function toAstNode(item: AstNode | AstNodeDescription): AstNode | undefined {
  return isAstNodeDescription(item) ? item.node : item
}
