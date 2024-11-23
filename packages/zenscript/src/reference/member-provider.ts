import type { AstNode, NameProvider, Stream } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { ZenScriptSyntheticAstType } from './synthetic'
import { EMPTY_STREAM, MultiMap, stream } from 'langium'

import { isClassDeclaration, isVariableDeclaration } from '../generated/ast'
import { ClassType, isAnyType, isClassType, isFunctionType, type Type, type ZenScriptType } from '../typing/type-description'
import { isStatic, streamClassChain, streamDeclaredMembers } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { isSyntheticAstNode } from './synthetic'

export interface SearchHint {
  nameHint?: string
  typeHint?: string
}

export interface MemberProvider {
  streamMembers: (source: AstNode | Type | undefined, hint?: SearchHint) => Stream<AstNode>
}

type SourceMap = ZenScriptAstType & ZenScriptType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K], hint?: SearchHint) => Stream<AstNode> }

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly typeComputer: TypeComputer
  private readonly nameProvider: NameProvider

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
    this.nameProvider = services.references.NameProvider
  }

  private readonly memberCache: WeakMap<AstNode, MultiMap<string, AstNode>> = new WeakMap()

  streamMembers(source: AstNode | Type | undefined, hint?: SearchHint): Stream<AstNode> {
    return this.rules(source?.$type)?.call(this, source, hint) ?? EMPTY_STREAM
  }

  private cacheMembers(source: AstNode, hint: SearchHint | undefined, memberSupplier: () => Stream<AstNode>): Stream<AstNode> {
    if (!this.memberCache.has(source)) {
      const members = memberSupplier()
      const map = new MultiMap<string, AstNode>()
      members.forEach((it) => {
        const name = this.nameProvider.getName(it)
        if (name) {
          map.add(name, it)
        }
      })
      this.memberCache.set(source, map)
    }
    if (hint?.nameHint) {
      return stream(this.memberCache.get(source)!.get(hint.nameHint)) ?? EMPTY_STREAM
    }
    return stream(this.memberCache.get(source)!.values())
  }

  private readonly rules = defineRules<RuleMap>({
    SyntheticHierarchyNode: (source, hint) => {
      return this.cacheMembers(source, hint, () => {
        const declarations = stream(source.children.values())
          .filter(it => it.isDataNode())
          .flatMap(it => it.data)
        const packages = stream(source.children.values())
          .filter(it => it.isInternalNode())
        return stream(declarations, packages)
      })
    },

    Script: (source, hint) => {
      return this.cacheMembers(source, hint, () =>
        stream(source.statements)
          .filter(isVariableDeclaration)
          .filter(isStatic))
    },

    ImportDeclaration: (source, hint) => {
      return this.streamMembers(source.path.at(-1)?.ref, hint)
    },

    ClassDeclaration: (source, _) => {
      return streamDeclaredMembers(source)
        .filter(it => isStatic(it))
    },

    VariableDeclaration: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    LoopParameter: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    ValueParameter: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    MemberAccess: (source, hint) => {
      const target = source.target.ref
      if (!target) {
        return EMPTY_STREAM
      }

      if (isSyntheticAstNode(target)) {
        return this.streamMembers(target, hint)
      }

      const receiverType = this.typeComputer.inferType(source.receiver)
      if (!receiverType) {
        return this.streamMembers(target, hint)
      }

      let type = this.typeComputer.inferType(source)
      if (isClassType(receiverType)) {
        type = type?.substituteTypeParameters(receiverType.substitutions)
      }
      return this.streamMembers(type, hint)
    },

    IndexingExpression: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    ReferenceExpression: (source, hint) => {
      if (source.target.$refText === 'this' && isClassDeclaration(source.target.ref)) {
        return this.streamMembers(new ClassType(source.target.ref, new Map()), hint)
      }
      return this.streamMembers(source.target.ref, hint)
    },

    CallExpression: (source, hint) => {
      const receiverType = this.typeComputer.inferType(source.receiver)
      if (isFunctionType(receiverType)) {
        return this.streamMembers(receiverType.returnType, hint)
      }
      if (isAnyType(receiverType)) {
        return this.streamMembers(receiverType, hint)
      }
      return EMPTY_STREAM
    },

    BracketExpression: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    FieldDeclaration: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    StringLiteral: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    StringTemplate: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    IntegerLiteral: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    FloatingLiteral: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    BooleanLiteral: (source, hint) => {
      const type = this.typeComputer.inferType(source)
      return this.streamMembers(type, hint)
    },

    ClassType: (source, hint) => {
      const classDecl = source.declaration
      return this.cacheMembers(classDecl, hint, () =>
        streamClassChain(classDecl)
          .flatMap(it => streamDeclaredMembers(it))
          .filter(it => !isStatic(it)))
    },
  })
}
