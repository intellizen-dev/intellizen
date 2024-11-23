import type { AstNode, AstNodeDescription, Stream } from 'langium'
import type { BracketExpression, ClassDeclaration, ClassMemberDeclaration, FunctionDeclaration, ImportDeclaration, OperatorFunctionDeclaration } from '../generated/ast'
import { AstUtils, isAstNodeDescription, stream } from 'langium'
import { isBracketExpression, isClassDeclaration, isFunctionDeclaration, isImportDeclaration, isOperatorFunctionDeclaration, isScript } from '../generated/ast'
import { isZs } from './document'

export function isToplevel(node: AstNode | undefined): boolean {
  return isScript(node?.$container)
}

export function isStatic(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'static'
}

export function isGlobal(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'global'
}

export function isVal(node: AstNode | undefined) {
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

export function streamClassChain(classDecl: ClassDeclaration): Stream<ClassDeclaration> {
  const visited = new Set<ClassDeclaration>()
  return stream(function* () {
    const deque = [classDecl]
    while (deque.length) {
      const head = deque.shift()!
      if (!visited.has(head)) {
        yield head
        visited.add(head)
        head.superTypes
          .map(it => it.path.at(-1)?.ref)
          .filter(isClassDeclaration)
          .forEach(it => deque.push(it))
      }
    }
  }())
}

export function streamDeclaredMembers(classDecl: ClassDeclaration): Stream<ClassMemberDeclaration> {
  return stream(classDecl.members)
}

export function streamDeclaredFunctions(classDecl: ClassDeclaration): Stream<FunctionDeclaration> {
  return streamDeclaredMembers(classDecl).filter(isFunctionDeclaration)
}

export function streamDeclaredOperators(classDecl: ClassDeclaration): Stream<OperatorFunctionDeclaration> {
  return streamDeclaredMembers(classDecl).filter(isOperatorFunctionDeclaration)
}
