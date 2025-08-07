import type { AstNode, Stream } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { Type, ZenScriptType } from '../typing/type-description'
import type { ZenScriptSyntheticAstType } from './synthetic'
import { AstUtils, EMPTY_STREAM, stream } from 'langium'
import { isClassDeclaration, isConstructorDeclaration, isFunctionDeclaration, isMemberAccess, isReferenceExpression, isScript, isVariableDeclaration } from '../generated/ast'
import { ClassType, isAnyType, isClassType, isFunctionType } from '../typing/type-description'
import { isStatic, streamClassChain, streamDeclaredMembers } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { isSyntheticAstNode } from './synthetic'

export interface MemberProvider {
  streamMembers: (element: AstNode | Type | undefined) => Stream<AstNode>
}

type RuleSpec = ZenScriptAstType & ZenScriptType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K]) => Stream<AstNode> }

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
  }

  public streamMembers(element: AstNode | Type | undefined): Stream<AstNode> {
    return this.memberRules(element?.$type)?.call(this, element) ?? EMPTY_STREAM
  }

  private readonly memberRules = defineRules<RuleMap>({
    SyntheticHierarchyNode: (element) => {
      const declarations = stream(element.children.values())
        .filter(it => it.isDataNode())
        .flatMap(it => it.data)
      const packages = stream(element.children.values())
        .filter(it => it.isInternalNode())
      return stream(declarations, packages)
    },

    Script: (element) => {
      return stream<AstNode>(
        element.classes,
        element.functions,
        element.statements.filter(isVariableDeclaration).filter(isStatic),
      )
    },

    ImportDeclaration: (element) => {
      return this.streamMembers(element.path.at(-1)?.ref)
    },

    ClassDeclaration: (element) => {
      return streamDeclaredMembers(element).filter(isStatic)
    },

    VariableDeclaration: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    LoopParameter: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    ValueParameter: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    MemberAccess: (element) => {
      const target = element.entity.ref
      if (!target) {
        return EMPTY_STREAM
      }

      if (isSyntheticAstNode(target) || isScript(target) || isClassDeclaration(target)) {
        return this.streamMembers(target)
      }

      const receiverType = this.typeComputer.inferType(element.receiver)
      if (!receiverType) {
        // may be static declaration
        return this.streamMembers(target)
      }

      let type = this.typeComputer.inferType(element)
      if (isClassType(receiverType)) {
        type = type?.substituteTypeParameters(receiverType.substitutions)
      }
      return this.streamMembers(type)
    },

    ParenthesizedExpression: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    PrefixExpression: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    InfixExpression: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    IndexExpression: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    ReferenceExpression: (element) => {
      if (element.entity.$refText === 'this' && isClassDeclaration(element.entity.ref)) {
        return this.streamMembers(new ClassType(element.entity.ref, new Map()))
      }
      return this.streamMembers(element.entity.ref)
    },

    CallExpression: (element) => {
      const receiver = element.receiver
      if (isReferenceExpression(receiver) || isMemberAccess(receiver)) {
        const entity = receiver.entity.ref
        if (isConstructorDeclaration(entity)) {
          const owner = AstUtils.getContainerOfType(entity, isClassDeclaration)
          if (!owner)
            return EMPTY_STREAM
          return this.streamMembers(new ClassType(owner, new Map()))
        }

        if (isFunctionDeclaration(entity)) {
          const returnType = this.typeComputer.inferType(entity.retType)
          return this.streamMembers(returnType)
        }
      }

      const receiverType = this.typeComputer.inferType(element.receiver)
      if (isFunctionType(receiverType)) {
        return this.streamMembers(receiverType.returnType)
      }
      if (isAnyType(receiverType)) {
        return this.streamMembers(receiverType)
      }
      return EMPTY_STREAM
    },

    BracketExpression: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    FieldDeclaration: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    StringLiteral: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    StringTemplate: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    IntegerLiteral: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    FloatLiteral: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    BooleanLiteral: (element) => {
      const type = this.typeComputer.inferType(element)
      return this.streamMembers(type)
    },

    ClassType: (element) => {
      return streamClassChain(element.declaration)
        .flatMap(it => it.members)
        .filter(it => !isStatic(it))
    },
  })
}
