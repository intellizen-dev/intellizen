import { type AstNode, type AstNodeDescription, type AstNodeDescriptionProvider, AstUtils, type NameProvider } from 'langium'
import type { Script, ZenScriptAstType } from '../generated/ast'
import { isScript, isVariableDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { getClassChain, isStatic } from '../utils/ast'
import { type Type, type ZenScriptType, isClassType, isFunctionType, isTypeVariable } from '../typing/type-description'
import type { TypeComputer } from '../typing/type-computer'

export interface MemberProvider {
  getMember: (source: AstNode | Type | undefined) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType & ZenScriptType
type SourceKey = keyof SourceMap
type Produce<K extends SourceKey, S extends SourceMap[K]> = (source: S) => AstNodeDescription[]
type Rule = <K extends SourceKey, S extends SourceMap[K]>(match: K, produce: Produce<K, S>) => void
type RuleMap = Map<SourceKey, Produce<SourceKey, any>>

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly nameProvider: NameProvider
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly rules: RuleMap

  constructor(services: ZenScriptServices) {
    this.nameProvider = services.references.NameProvider
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

    rule('Script', (source) => {
      const members: AstNode[] = []
      source.classes.forEach(it => members.push(it))
      source.functions.forEach(it => members.push(it))
      source.statements.filter(it => isVariableDeclaration(it))
        .filter(it => it.prefix === 'static')
        .forEach(it => members.push(it))
      return members.map(it => this.createDescriptionForNode(it))
    })

    rule('ImportDeclaration', (source) => {
      return this.getMember(source.path.at(-1)?.ref)
    })

    rule('ClassDeclaration', (source) => {
      return getClassChain(source)
        .flatMap(it => it.members)
        .filter(it => isStatic(it))
        .map(it => this.createDescriptionForNode(it, undefined))
    })

    rule('VariableDeclaration', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('ClassTypeReference', (source) => {
      const script = AstUtils.findRootNode(source) as Script
      const result: AstNodeDescription[] = []
      script.imports.forEach((importDecl) => {
        const importDeclName = this.nameProvider.getName(importDecl)
        const ref = importDecl.path.at(-1)?.ref
        if (isScript(ref)) {
          const scriptMembers = this.getMember(ref)
          scriptMembers.forEach((member) => {
            member.name = `${importDeclName}.${member.name}`
          })
          result.push(...scriptMembers)
        }
        else if (ref) {
          result.push(this.createDescriptionForNode(ref, importDeclName))
        }
      })
      return result
    })

    rule('MemberAccess', (source) => {
      const member = source.refer.ref
      if (!member) {
        return []
      }

      const receiverType = this.typeComputer.inferType(source.receiver)
      if (!receiverType) {
        return this.getMember(member)
      }

      const memberType = this.typeComputer.inferType(member)
      if (!memberType) {
        return this.getMember(member)
      }

      if (isTypeVariable(memberType) && isClassType(receiverType)) {
        return this.getMember(memberType.substituteTypeParameters(receiverType.substitutions))
      }

      return []
    })

    rule('ReferenceExpression', (source) => {
      return this.getMember(source.refer.ref)
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
        .map(it => this.createDescriptionForNode(it))
    })

    return rules
  }

  private createDescriptionForNode(node: AstNode, name?: string): AstNodeDescription {
    name ??= this.nameProvider.getName(node)
    return this.descriptions.createDescription(node, name)
  }
}
