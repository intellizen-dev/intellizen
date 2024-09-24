import type { AstNode, ReferenceInfo } from 'langium'
import { take } from 'lodash-es'
import type { ClassDeclaration, ClassMemberDeclaration, ImportDeclaration } from '../generated/ast'
import { isScript } from '../generated/ast'

export function isToplevel(node: AstNode): boolean {
  return isScript(node.$container)
}

export function getClassChain(clazz?: ClassDeclaration): ClassDeclaration[] {
  if (!clazz)
    return []

  const set = new Set<ClassDeclaration>()
  set.add(clazz)
  clazz.superTypes?.flatMap(t => getClassChain(t.refer.ref)).forEach(c => set.add(c))
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
    names.push(importDecl.refer.$refText)
  }
  else if (context.property === 'path' && context.index !== undefined) {
    names = take(names, context.index + 1)
  }
  return names.join('.')
}
