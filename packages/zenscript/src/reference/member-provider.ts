import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { ContextCache } from '../utils/cache'
import type { ZenScriptSyntheticAstType } from './synthetic'
import { stream } from 'langium'
import { isClassDeclaration, isVariableDeclaration } from '../generated/ast'
import { ClassType, isAnyType, isClassType, isFunctionType, type Type, type ZenScriptType } from '../typing/type-description'
import { getClassChain, isStatic } from '../utils/ast'
import { createSyntheticAstNodeDescription, isSyntheticAstNode } from './synthetic'

export interface MemberProvider {
  getMembers: (source: AstNode | Type | undefined, cache: ContextCache) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType & ZenScriptType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K], cache: ContextCache) => AstNodeDescription[] }

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
  }

  getMembers(source: AstNode | Type | undefined, cache: ContextCache): AstNodeDescription[] {
    if (cache.has(this, source)) {
      return cache.get(this, source)
    }

    // @ts-expect-error allowed index type
    const members = this.rules[source?.$type]?.call(this, source, cache)
    if (members) {
      cache.set(this, source, members)
    }
    return members
  }

  private readonly rules: RuleMap = {
    SyntheticHierarchyNode: (source) => {
      const declarations = stream(source.children.values())
        .filter(it => it.isDataNode())
        .flatMap(it => it.data)
        .map(it => this.descriptions.createDescription(it, undefined))
      const packages = stream(source.children.values())
        .filter(it => it.isInternalNode())
        .map(it => createSyntheticAstNodeDescription('SyntheticHierarchyNode', it.name, it))
      return stream(declarations, packages).toArray()
    },

    Script: (source) => {
      const members: AstNode[] = []
      source.classes.forEach(it => members.push(it))
      source.functions.forEach(it => members.push(it))
      source.statements.filter(it => isVariableDeclaration(it))
        .filter(it => it.prefix === 'static')
        .forEach(it => members.push(it))
      return members.map(it => this.descriptions.createDescription(it, undefined))
    },

    ImportDeclaration: (source, cache) => {
      return this.getMembers(source.path.at(-1)?.ref, cache)
    },

    ClassDeclaration: (source) => {
      return getClassChain(source)
        .flatMap(it => it.members)
        .filter(it => isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    },

    VariableDeclaration: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    LoopParameter: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    ValueParameter: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    MemberAccess: (source, cache) => {
      const target = source.target.ref
      if (!target) {
        return []
      }

      if (isSyntheticAstNode(target)) {
        return this.getMembers(target, cache)
      }

      const receiverType = this.typeComputer.inferType(source.receiver, cache)
      if (!receiverType) {
        return this.getMembers(target, cache)
      }

      let type = this.typeComputer.inferType(source, cache)
      if (isClassType(receiverType)) {
        type = type?.substituteTypeParameters(receiverType.substitutions)
      }
      return this.getMembers(type, cache)
    },

    IndexingExpression: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    ReferenceExpression: (source, cache) => {
      if (source.target.$refText === 'this' && isClassDeclaration(source.target.ref)) {
        return this.getMembers(new ClassType(source.target.ref, new Map()), cache)
      }
      return this.getMembers(source.target.ref, cache)
    },

    CallExpression: (source, cache) => {
      const receiverType = this.typeComputer.inferType(source.receiver, cache)
      if (isFunctionType(receiverType)) {
        return this.getMembers(receiverType.returnType, cache)
      }
      if (isAnyType(receiverType)) {
        return this.getMembers(receiverType, cache)
      }
      return []
    },

    BracketExpression: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    FieldDeclaration: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    StringLiteral: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    StringTemplate: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    IntegerLiteral: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    FloatingLiteral: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    BooleanLiteral: (source, cache) => {
      const type = this.typeComputer.inferType(source, cache)
      return this.getMembers(type, cache)
    },

    ClassType: (source) => {
      return getClassChain(source.declaration)
        .flatMap(it => it.members)
        .filter(it => !isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    },
  }
}
