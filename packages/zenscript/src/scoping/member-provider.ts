import { type AstNodeDescription, type AstNodeDescriptionProvider, AstUtils, type AstNode as LangiumAstNode, type NameProvider } from 'langium'
import type { IntelliZenAstType, Script } from '../generated/ast'
import { isScript, isVariableDeclaration } from '../generated/ast'
import type { IntelliZenServices } from '../module'
import { getClassChain, isStaticMember } from '../utils/ast'
import type { TypeDescConstants, TypeDescription } from '../typing/description'
import type { TypeComputer } from '../typing/infer'

interface AstNode extends LangiumAstNode {
  readonly $type: keyof IntelliZenAstType
}

export interface MemberProvider {
  getMember: (source: AstNode | TypeDescription | undefined) => AstNodeDescription[]
}

type RuleKeys = keyof Rules
type Rules = IntelliZenAstType & TypeDescConstants

type Produce<T extends RuleKeys, S extends Rules[T]> = (node: S) => AstNodeDescription[]
type Rule = <T extends RuleKeys, S extends Rules[T]>(match: T, produce: Produce<T, S>) => void

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly nameProvider: NameProvider
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly rules: Map<RuleKeys, Produce<RuleKeys, any>>

  getMember(source: AstNode | TypeDescription | undefined): AstNodeDescription[] {
    if (!source || !source.$type) {
      return []
    }

    const produce = this.rules.get(source.$type)
    return produce ? produce(source) : []
  }

  constructor(services: IntelliZenServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.nameProvider = services.references.NameProvider
    this.typeComputer = services.typing.TypeComputer
    this.rules = new Map()
    this.initRules()
  }

  private initRules() {
    const rule: Rule = (match, produce) => {
      if (this.rules.has(match)) {
        throw new Error(`Rule "${match}" is already defined.`)
      }
      this.rules.set(match, produce)
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
        .filter(it => isStaticMember(it))
        .map(it => this.createDescriptionForNode(it, undefined))
    })

    rule('VariableDeclaration', (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('ClassType', (source) => {
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

    rule('LocalVariable', (source) => {
      return this.getMember(source.refer.ref)
    })

    rule('class', (source) => {
      const ref = source.ref?.ref
      return getClassChain(ref)
        .flatMap(it => it.members)
        .filter(it => !isStaticMember(it))
        .map(it => this.createDescriptionForNode(it))
    })
  }

  private createDescriptionForNode(node: AstNode, name?: string): AstNodeDescription {
    name ??= this.nameProvider.getName(node)
    return this.descriptions.createDescription(node, name)
  }
}
