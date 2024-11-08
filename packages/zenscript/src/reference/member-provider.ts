import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import { stream } from 'langium'
import type { HierarchyNode } from '@intellizen/shared'
import type { ZenScriptAstType } from '../generated/ast'
import { isVariableDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { createHierarchyNodeDescription, getClassChain, isStatic } from '../utils/ast'
import { type Type, type ZenScriptType, isFunctionType } from '../typing/type-description'
import type { TypeComputer } from '../typing/type-computer'

export interface MemberProvider {
  getMember: (source: AstNode | Type | undefined) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType & ZenScriptType & { HierarchyNode: HierarchyNode<AstNode> }
type SourceKey = keyof SourceMap
type Produce<K extends SourceKey, S extends SourceMap[K]> = (source: S) => AstNodeDescription[]
type Rule = <K extends SourceKey, S extends SourceMap[K]>(match: K, produce: Produce<K, S>) => void
type RuleMap = Map<SourceKey, Produce<SourceKey, any>>

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly rules: RuleMap

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
    this.rules = this.initRules()
  }

  getMember(source: AstNode | Type | undefined): AstNodeDescription[] {
    const match = source?.$type as SourceKey
    return this.rules.get(match)?.call(this, source) ?? []
  }

  private initRules(): RuleMap {
    const rules: RuleMap = new Map()
    const rule: Rule = (match, produce) => {
      if (rules.has(match)) {
        throw new Error(`Rule "${match}" is already defined.`)
      }
      rules.set(match, produce)
    }

    rule('HierarchyNode', (source) => {
      const declarations = stream(source.children.values())
        .filter(it => it.isDataNode())
        .flatMap(it => it.data)
        .map(it => this.descriptions.createDescription(it, undefined))
      const packages = stream(source.children.values())
        .filter(it => it.isInternalNode())
        .map(it => createHierarchyNodeDescription(it))
      return stream(declarations, packages).toArray()
    })

    rule('Script', (source) => {
      const members: AstNode[] = []
      source.classes.forEach(it => members.push(it))
      source.functions.forEach(it => members.push(it))
      source.statements.filter(it => isVariableDeclaration(it))
        .filter(it => it.prefix === 'static')
        .forEach(it => members.push(it))
      return members.map(it => this.descriptions.createDescription(it, undefined))
    })

    rule('ImportDeclaration', (source) => {
      return this.getMember(source.path.at(-1)?.ref)
    })

    rule('ClassDeclaration', (source) => {
      return getClassChain(source)
        .flatMap(it => it.members)
        .filter(it => isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    })

    rule('VariableDeclaration', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('ValueParameter', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('MemberAccess', (source) => {
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
    })

    rule('IndexingExpression', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('ReferenceExpression', (source) => {
      return this.getMember(source.target.ref)
    })

    rule('CallExpression', (source) => {
      const receiverType = this.typeComputer.inferType(source.receiver)
      return isFunctionType(receiverType) ? this.getMember(receiverType.returnType) : []
    })

    rule('FieldDeclaration', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('StringLiteral', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('StringTemplate', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('IntegerLiteral', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('FloatingLiteral', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('BooleanLiteral', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('ClassType', (source) => {
      return getClassChain(source.declaration)
        .flatMap(it => it.members)
        .filter(it => !isStatic(it))
        .map(it => this.descriptions.createDescription(it, undefined))
    })

    return rules
  }
}
