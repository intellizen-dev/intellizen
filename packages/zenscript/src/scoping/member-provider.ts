import { type AstNode, type AstNodeDescription, type AstNodeDescriptionProvider, AstUtils, type NameProvider } from 'langium'
import type { ClassDeclaration, ClassType, ImportDeclaration, Script, VariableDeclaration } from '../generated/ast'
import { isScript, isVariableDeclaration } from '../generated/ast'
import type { IntelliZenServices } from '../module'
import { getClassChain, isStaticMember } from '../utils/ast'
import type { ClassTypeDescription, TypeDescription } from '../typing/description'
import type { TypeComputer } from '../typing/infer'

export interface MemberProvider {
  getMember: (source: AstNode | TypeDescription | undefined) => AstNodeDescription[]
}

// type RuleMap<T extends keyof IntelliZenAstType, K extends T> = Map<IntelliZenAstType[K], (node: IntelliZenAstType[K]) => AstNodeDescription[]>
// type Rule = <T extends keyof IntelliZenAstType, K extends T>(match: T, produce: (source: IntelliZenAstType[K]) => AstNodeDescription[]) => void
// type Produce = <S extends AstNode | TypeDescription>(source: S) => AstNodeDescription[]

type RuleMap = Map<string, Produce>
type Rule = (match: string, produce: Produce) => void
type Produce = (source: any) => AstNodeDescription[]

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly nameProvider: NameProvider
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly rules: RuleMap

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
      this.rules.set(match, produce)
    }

    rule('Script', (source: Script) => {
      const members: AstNode[] = []
      source.classes.forEach(it => members.push(it))
      source.functions.forEach(it => members.push(it))
      source.statements.filter(it => isVariableDeclaration(it))
        .filter(it => it.prefix === 'static')
        .forEach(it => members.push(it))
      return members.map(it => this.createDescriptionForNode(it))
    })

    rule('ImportDeclaration', (source: ImportDeclaration) => {
      return this.getMember(source.path.at(-1)?.ref)
    })

    rule('ClassDeclaration', (source: ClassDeclaration) => {
      return getClassChain(source)
        .flatMap(it => it.members)
        .filter(it => isStaticMember(it))
        .map(it => this.createDescriptionForNode(it, undefined))
    })

    rule('VariableDeclaration', (source: VariableDeclaration) => {
      const type = this.typeComputer.inferType(source)
      return this.getMember(type)
    })

    rule('ClassType', (source: ClassType) => {
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

    rule('class', (source: ClassTypeDescription) => {
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
