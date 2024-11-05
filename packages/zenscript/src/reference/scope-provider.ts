import type { AstNode, AstNodeDescription, ReferenceInfo, Scope, Stream } from 'langium'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, URI, stream } from 'langium'
import { generateSequence, substringBeforeLast } from '@intellizen/shared'
import type { ImportDeclaration, MemberAccess, NamedTypeReference, ZenScriptAstType } from '../generated/ast'
import { isClassDeclaration, isImportDeclaration, isTypeParameter } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { getPathAsString } from '../utils/ast'
import type { PackageManager } from '../workspace/package-manager'
import type { MemberProvider } from './member-provider'

type SourceKey = keyof ZenScriptAstType
type Produce = (source: ReferenceInfo) => Scope
type Rule = <K extends SourceKey>(match: K, produce: Produce) => void
type RuleMap = Map<SourceKey, Produce>

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly rules: RuleMap

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.rules = this.initRules()
  }

  override getScope(context: ReferenceInfo): Scope {
    const match = context.container.$type as SourceKey
    return this.rules.get(match)?.call(this, context) ?? EMPTY_SCOPE
  }

  private createLexicalScope(astNode: AstNode, mapper: (desc: AstNodeDescription) => AstNodeDescription | undefined, outer?: Scope): Scope {
    const precomputed = AstUtils.getDocument(astNode).precomputedScopes
    if (!precomputed) {
      return this.createScope([], outer)
    }
    return stream(generateSequence(astNode, it => it.$container))
      .map(container => precomputed.get(container))
      .map(descriptions => descriptions.map(mapper).filter(desc => !!desc))
      .reduce((scope, descriptions) => this.createScope(descriptions, scope), outer as Scope)
  }

  private initRules(): RuleMap {
    const rules: RuleMap = new Map()
    const rule: Rule = (match, produce) => {
      if (rules.has(match)) {
        throw new Error(`Rule "${match}" is already defined.`)
      }
      rules.set(match, produce)
    }

    rule('ImportDeclaration', (source) => {
      const importDecl = source.container as ImportDeclaration
      const path = getPathAsString(importDecl, source.index)
      const parentPath = substringBeforeLast(path, '.')
      const siblings = this.packageManager.find(parentPath)?.children.values()
      if (!siblings) {
        return EMPTY_SCOPE
      }

      const elements: AstNodeDescription[] = []
      for (const sibling of siblings) {
        if (sibling.values?.size) {
          sibling.values.forEach(it => elements.push(this.descriptions.createDescription(it, sibling.name)))
        }
        else {
          // TODO: temporary, needs to be reimplemented
          elements.push({
            type: 'package',
            name: sibling.name,
            documentUri: URI.from({ scheme: 'package' }),
            path: '',
          })
        }
      }

      return this.createScope(elements)
    })

    rule('ReferenceExpression', (source) => {
      let outer: Scope

      const packages: Stream<AstNodeDescription> = stream(this.packageManager.find('')!.children.values())
        .filter(it => it.values.size === 0)
        .map(it => ({
          type: 'package',
          name: it.name,
          documentUri: URI.from({ scheme: 'package' }),
          path: '',
        }))
      outer = this.createScope(packages)

      const globals = this.indexManager.allElements()
      outer = this.createScope(globals, outer)

      const mapper = (desc: AstNodeDescription) => {
        if (isImportDeclaration(desc.node)) {
          const importDecl = desc.node
          const ref = importDecl.path.at(-1)?.ref ?? importDecl
          return this.descriptions.createDescription(ref, this.nameProvider.getName(importDecl))
        }
        if (isTypeParameter(desc.node)) {
          return undefined
        }
        return desc
      }

      return this.createLexicalScope(source.container, mapper, outer)
    })

    rule('MemberAccess', (source) => {
      const container = source.container as MemberAccess
      const members = this.memberProvider.getMember(container.receiver)
      return this.createScope(members)
    })

    rule('NamedTypeReference', (source) => {
      if (source.index === 0 || source.index === undefined) {
        const classes = stream(this.packageManager.find('')!.children.values())
          .flatMap(it => it.values)
          .filter(it => isClassDeclaration(it))
          .map(it => this.descriptions.createDescription(it, it.name))
        const outer = this.createScope(classes)

        const mapper = (desc: AstNodeDescription) => {
          if (isTypeParameter(desc.node)) {
            return desc
          }
          else if (isClassDeclaration(desc.node)) {
            return desc
          }
          else if (isImportDeclaration(desc.node)) {
            const importDecl = desc.node
            const ref = importDecl.path.at(-1)?.ref ?? importDecl
            return this.descriptions.createDescription(ref, this.nameProvider.getName(importDecl))
          }
          else {
            return undefined
          }
        }
        return this.createLexicalScope(source.container, mapper, outer)
      }
      else {
        const container = source.container as NamedTypeReference
        const prev = container.path[source.index - 1].ref
        const members = this.memberProvider.getMember(prev)
        return this.createScope(members)
      }
    })

    return rules
  }
}
