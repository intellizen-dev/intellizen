import type { AstNode, AstNodeDescription, ReferenceInfo, Scope, Stream } from 'langium'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, URI, stream } from 'langium'
import { substringBeforeLast } from '@intellizen/shared'
import type { MemberAccess, NamedTypeReference, ZenScriptAstType } from '../generated/ast'
import { ClassDeclaration, ImportDeclaration, TypeParameter, isClassDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { getPathAsString } from '../utils/ast'
import type { PackageManager } from '../workspace/package-manager'
import { generateStream } from '../utils/stream'
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

  private lexicalScope(
    astNode: AstNode,
    processor: (desc: AstNodeDescription) => AstNodeDescription | undefined,
    outside?: Scope,
  ): Scope {
    const precomputed = AstUtils.getDocument(astNode).precomputedScopes
    return generateStream(astNode, it => it.$container)
      .map(container => precomputed?.get(container))
      .nonNullable()
      .map(descriptions => stream(descriptions).map(processor).nonNullable())
      .reduce((outer, descriptions) => this.createScope(descriptions, outer), outside as Scope)
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

      const processor = (desc: AstNodeDescription) => {
        switch (desc.type) {
          case TypeParameter:
            return
          case ImportDeclaration: {
            const importDecl = desc.node as ImportDeclaration
            const ref = importDecl.path.at(-1)?.ref ?? importDecl
            return this.descriptions.createDescription(ref, this.nameProvider.getName(importDecl))
          }
          default:
            return desc
        }
      }
      return this.lexicalScope(source.container, processor, outer)
    })

    rule('MemberAccess', (source) => {
      const container = source.container as MemberAccess
      const members = this.memberProvider.getMember(container.receiver)
      return this.createScope(members)
    })

    rule('NamedTypeReference', (source) => {
      if (!source.index) {
        const classes = stream(this.packageManager.root.children.values())
          .flatMap(it => it.values)
          .filter(isClassDeclaration)
          .map(it => this.descriptions.createDescription(it, it.name))
        const outer = this.createScope(classes)

        const processor = (desc: AstNodeDescription) => {
          switch (desc.type) {
            case TypeParameter:
            case ClassDeclaration:
              return desc
            case ImportDeclaration: {
              const importDecl = desc.node as ImportDeclaration
              const ref = importDecl.path.at(-1)?.ref ?? importDecl
              return this.descriptions.createDescription(ref, this.nameProvider.getName(importDecl))
            }
          }
        }
        return this.lexicalScope(source.container, processor, outer)
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
