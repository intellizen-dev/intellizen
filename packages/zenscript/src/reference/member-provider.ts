import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { WorkspaceCache } from '../utils/cache'
import type { ZenScriptSyntheticAstType } from './synthetic'
import { stream } from 'langium'
import { isClassDeclaration, isVariableDeclaration } from '../generated/ast'
import { ClassType, isAnyType, isClassType, isFunctionType, type Type, type ZenScriptType } from '../typing/type-description'
import { getClassChain, isStatic } from '../utils/ast'
import { createSyntheticAstNodeDescription, isSyntheticAstNode } from './synthetic'

export interface MemberProvider {
  getMembers: (source: AstNode | Type | undefined) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType & ZenScriptType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => AstNodeDescription[] }

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly workspaceCache: WorkspaceCache

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
    this.workspaceCache = services.shared.workspace.Cache
  }

  getMembers(source: AstNode | Type | undefined): AstNodeDescription[] {
    const cache = this.workspaceCache.get(this)
    if (cache.has(source!)) {
      return cache.get(source!)
    }

    // @ts-expect-error allowed index type
    const members = this.rules[source?.$type]?.call(this, source)
    if (members) {
      cache.set(source!, members)
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

    ImportDeclaration: (source) => {
      return this.getMembers(source.path.at(-1)?.ref)
    },

    ClassDeclaration: (source) => {
      return getClassChain(source)
        .flatMap(it => it.members)
        .filter(it => isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    },

    VariableDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    LoopParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    ValueParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    MemberAccess: (source) => {
      const target = source.target.ref
      if (!target) {
        return []
      }

      if (isSyntheticAstNode(target)) {
        return this.getMembers(target)
      }

      const receiverType = this.typeComputer.inferType(source.receiver)
      if (!receiverType) {
        return this.getMembers(target)
      }

      let type = this.typeComputer.inferType(source)
      if (isClassType(receiverType)) {
        type = type?.substituteTypeParameters(receiverType.substitutions)
      }
      return this.getMembers(type)
    },

    IndexingExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    ReferenceExpression: (source) => {
      if (source.target.$refText === 'this' && isClassDeclaration(source.target.ref)) {
        return this.getMembers(new ClassType(source.target.ref, new Map()))
      }
      return this.getMembers(source.target.ref)
    },

    CallExpression: (source) => {
      const receiverType = this.typeComputer.inferType(source.receiver)
      if (isFunctionType(receiverType)) {
        return this.getMembers(receiverType.returnType)
      }
      if (isAnyType(receiverType)) {
        return this.getMembers(receiverType)
      }
      return []
    },

    BracketExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    FieldDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    StringLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    StringTemplate: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    IntegerLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    FloatingLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    BooleanLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    ClassType: (source) => {
      return getClassChain(source.declaration)
        .flatMap(it => it.members)
        .filter(it => !isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    },
  }
}
