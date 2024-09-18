import type { AstNode } from 'langium'
import type { ClassDeclaration, ClassMemberDeclaration } from '../generated/ast'
import { isScript } from '../generated/ast'

export function isToplevel(node: AstNode): boolean {
  return isScript(node.$container)
}

export function getClassChain(clazz?: ClassDeclaration): ClassDeclaration[] {
  if (!clazz)
    return []

  const set = new Set<ClassDeclaration>()
  set.add(clazz)
  clazz.superTypes?.flatMap(t => getClassChain(t.ref)).forEach(c => set.add(c))
  return Array.from(set)
}

export function getClassMembers(clazz?: ClassDeclaration) {
  return getClassChain(clazz).flatMap(c => c.members)
}

export function isStaticMember(member: ClassMemberDeclaration) {
  return member.$type !== 'ConstructorDeclaration' && member.prefix === 'static'
}
