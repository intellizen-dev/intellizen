import type { AstNode, ReferenceInfo } from 'langium'
import type { ClassDeclaration, ClassMemberDeclaration, ImportDeclaration } from '../generated/ast'
import { isClassDeclaration, isScript } from '../generated/ast'

export function isToplevel(node: AstNode): boolean {
  return isScript(node.$container)
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

export function isStaticMember(member: ClassMemberDeclaration) {
  return member.$type !== 'ConstructorDeclaration' && member.prefix === 'static'
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
