import type { AstNode } from 'langium'
import type { ClassDeclaration, ImportDeclaration } from '../generated/ast'
import { AstUtils } from 'langium'
import { isClassDeclaration, isFunctionDeclaration, isScript } from '../generated/ast'
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

export function getPathAsString(importDecl: ImportDeclaration, index?: number): string {
  let names = importDecl.path.map(it => it.$refText)
  if (index !== undefined) {
    names = names.slice(0, index + 1)
  }
  return names.join('.')
}
