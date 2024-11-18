import type { ClassDeclaration, ClassMemberDeclaration, OperatorFunctionDeclaration } from '../generated/ast'
import { stream, type Stream } from 'langium'
import { isClassDeclaration, isOperatorFunctionDeclaration } from '../generated/ast'

export interface ClassHierarchy {
  streamClassChain: (classDecl: ClassDeclaration) => Stream<ClassDeclaration>
  streamDeclaredMembers: (classDecl: ClassDeclaration) => Stream<ClassMemberDeclaration>
  streamDeclaredOperators: (classDecl: ClassDeclaration) => Stream<OperatorFunctionDeclaration>
}

export class ZenScriptClassHierarchy implements ClassHierarchy {
  streamClassChain(classDecl: ClassDeclaration): Stream<ClassDeclaration> {
    const visited = new Set<ClassDeclaration>()
    return stream(function *() {
      const deque = [classDecl]
      while (deque.length) {
        const head = deque.shift()!
        if (!visited.has(head)) {
          visited.add(head)
          yield head
          head.superTypes
            .map(it => it.path.at(-1)?.ref)
            .filter(isClassDeclaration)
            .forEach(it => deque.push(it))
        }
      }
    }())
  }

  streamDeclaredMembers(classDecl: ClassDeclaration): Stream<ClassMemberDeclaration> {
    return stream(classDecl.members)
  }

  streamDeclaredOperators(classDecl: ClassDeclaration): Stream<OperatorFunctionDeclaration> {
    return this.streamDeclaredMembers(classDecl).filter(isOperatorFunctionDeclaration)
  }
}
