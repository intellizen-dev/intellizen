import type { AstNode, Stream } from 'langium'
import type { ClassDeclaration, OperatorFunctionDeclaration, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { ZenScriptSyntheticAstType } from './synthetic'
import { EMPTY_STREAM, stream } from 'langium'
import { isClassDeclaration, isConstructorDeclaration, isFunctionDeclaration, isMemberAccess, isOperatorFunctionDeclaration, isReferenceExpression, isScript, isVariableDeclaration } from '../generated/ast'
import { ClassType, isAnyType, isClassType, isFunctionType, type Type, type ZenScriptType } from '../typing/type-description'
import { isStatic, streamClassChain, streamDeclaredMembers } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { isSyntheticAstNode } from './synthetic'

export interface MemberProvider {
  streamMembers: (source: AstNode | Type | undefined) => Stream<AstNode>
  streamOperators: (source: AstNode | Type | undefined) => Stream<OperatorFunctionDeclaration>
}

type SourceMap = ZenScriptAstType & ZenScriptType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => Stream<AstNode> }

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
  }

  public streamMembers(source: AstNode | Type | undefined): Stream<AstNode> {
    return this.rules(source?.$type)?.call(this, source) ?? EMPTY_STREAM
  }

  public streamOperators(source: AstNode | Type | undefined): Stream<OperatorFunctionDeclaration> {
    return this.streamMembers(source).filter(isOperatorFunctionDeclaration)
  }

  private readonly rules = defineRules<RuleMap>({
    SyntheticHierarchyNode: (source) => {
      const declarations = stream(source.children.values())
        .filter(it => it.isDataNode())
        .flatMap(it => it.data)
      const packages = stream(source.children.values())
        .filter(it => it.isInternalNode())
      return stream(declarations, packages)
    },

    Script: (source) => {
      return stream<AstNode>(
        source.classes,
        source.functions,
        source.statements.filter(isVariableDeclaration).filter(isStatic),
      )
    },

    ImportDeclaration: (source) => {
      return this.streamMembers(source.path.at(-1)?.ref)
    },

    ClassDeclaration: (source) => {
      return streamDeclaredMembers(source).filter(isStatic)
    },

    VariableDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    LoopParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    ValueParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    MemberAccess: (source) => {
      const target = source.target.ref
      if (!target) {
        return EMPTY_STREAM
      }

      if (isSyntheticAstNode(target) || isScript(target) || isClassDeclaration(target)) {
        return this.streamMembers(target)
      }

      const receiverType = this.typeComputer.inferType(source.receiver)
      if (!receiverType) {
        // may be static declaration
        return this.streamMembers(target)
      }

      let type = this.typeComputer.inferType(source)
      if (isClassType(receiverType)) {
        type = type?.substituteTypeParameters(receiverType.substitutions)
      }
      return this.streamMembers(type)
    },

    ParenthesizedExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    PrefixExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    InfixExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    IndexingExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    ReferenceExpression: (source) => {
      if (source.target.$refText === 'this' && isClassDeclaration(source.target.ref)) {
        return this.streamMembers(new ClassType(source.target.ref, new Map()))
      }
      return this.streamMembers(source.target.ref)
    },

    CallExpression: (source) => {
      const receiver = source.receiver
      if (isReferenceExpression(receiver) || isMemberAccess(receiver)) {
        const target = receiver.target.ref
        if (isConstructorDeclaration(target)) {
          const owner = target.$container as ClassDeclaration
          return this.streamMembers(new ClassType(owner, new Map()))
        }

        if (isFunctionDeclaration(target)) {
          const returnType = this.typeComputer.inferType(target.returnTypeRef)
          return this.streamMembers(returnType)
        }
      }

      const receiverType = this.typeComputer.inferType(source.receiver)
      if (isFunctionType(receiverType)) {
        return this.streamMembers(receiverType.returnType)
      }
      if (isAnyType(receiverType)) {
        return this.streamMembers(receiverType)
      }
      return EMPTY_STREAM
    },

    BracketExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    FieldDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    StringLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    StringTemplate: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    IntegerLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    FloatingLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    BooleanLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type)
    },

    ClassType: (source) => {
      return streamClassChain(source.declaration)
        .flatMap(it => it.members)
        .filter(it => !isStatic(it))
    },
  })
}
