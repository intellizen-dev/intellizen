import type { HierarchyNode } from '@intellizen/shared'
import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import { stream } from 'langium'
import { isVariableDeclaration } from '../generated/ast'
import { isFunctionType, type Type, type ZenScriptType } from '../typing/type-description'
import { createHierarchyNodeDescription, getClassChain, isStatic } from '../utils/ast'

export interface MemberProvider {
  getMember: (source: AstNode | Type | undefined) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType & ZenScriptType & { HierarchyNode: HierarchyNode<AstNode> }
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => AstNodeDescription[] }

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
  }

  getMember(source: AstNode | Type | undefined): AstNodeDescription[] {
    // @ts-expect-error allowed index type
    return this.rules[source?.$type]?.call(this, source) ?? []
  }

  private readonly rules: RuleMap = {
    HierarchyNode: (source) => {
      const declarations = stream(source.children.values())
        .filter(it => it.isDataNode())
        .flatMap(it => it.data)
        .map(it => this.descriptions.createDescription(it, undefined))
      const packages = stream(source.children.values())
        .filter(it => it.isInternalNode())
        .map(it => createHierarchyNodeDescription(it))
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
      return this.getMember(source.path.at(-1)?.ref)
    },

    ClassDeclaration: (source) => {
      return getClassChain(source)
        .flatMap(it => it.members)
        .filter(it => isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    },

    VariableDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    LoopParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    ValueParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    MemberAccess: (source) => {
      const target = source.target.ref
      if (!target) {
        return []
      }

      if (target.$type as string === 'HierarchyNode') {
        return this.getMember(target)
      }

      const receiverType = this.typeComputer.inferType(source.receiver)
      if (!receiverType) {
        return this.getMember(target)
      }

      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    IndexingExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    ReferenceExpression: (source) => {
      return this.getMember(source.target.ref)
    },

    CallExpression: (source) => {
      const receiverType = this.typeComputer.inferType(source.receiver)
      return isFunctionType(receiverType) ? this.getMember(receiverType.returnType) : []
    },

    FieldDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    StringLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    StringTemplate: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    IntegerLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    FloatingLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    BooleanLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    },

    ClassType: (source) => {
      return getClassChain(source.declaration)
        .flatMap(it => it.members)
        .filter(it => !isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    },
  }
}
