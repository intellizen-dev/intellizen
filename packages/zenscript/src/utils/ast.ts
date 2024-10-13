import { type AstNode, AstUtils, type ReferenceInfo } from 'langium'
import type { ClassDeclaration, ImportDeclaration } from '../generated/ast'
import { isClassDeclaration, isScript } from '../generated/ast'
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

export function getClassMembers(clazz?: ClassDeclaration) {
  return getClassChain(clazz).flatMap(c => c.members)
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
  else {
    return isStatic(node) || isClassDeclaration(node)
  }
}

export function toQualifiedName(importDecl: ImportDeclaration, context: ReferenceInfo): string {
  let names = importDecl.path.map(it => it.$refText)
  if (context.property === 'refer') {
    names.push(importDecl.path.at(-1)!.$refText)
  }
  else if (context.property === 'path' && context.index !== undefined) {
    names = names.slice(0, context.index + 1)
  }
  return names.join('.')
}

export function getPathAsString(importDecl: ImportDeclaration, context: ReferenceInfo): string {
  if (context.index === undefined) {
    return ''
  }
  let names = importDecl.path.map(it => it.$refText)
  names = names.slice(0, context.index)
  return names.join('.')
}
