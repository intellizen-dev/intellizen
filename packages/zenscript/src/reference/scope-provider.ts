import type { AstNode, AstNodeDescription, ReferenceInfo, Scope, Stream } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { PackageManager } from '../workspace/package-manager'
import type { MemberProvider } from './member-provider'
import type { SyntheticsProvider } from './synthetics-provider'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, stream } from 'langium'
import { ClassDeclaration, ImportDeclaration, isClassDeclaration, TypeParameter } from '../generated/ast'
import { getPathAsString } from '../utils/ast'
import { generateStream } from '../utils/stream'
import { createSyntheticAstNodeDescription } from './synthetic'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => Scope }

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly syntheticsProvider: SyntheticsProvider

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.syntheticsProvider = services.references.SyntheticsProvider
  }

  override getScope(context: ReferenceInfo): Scope {
    // @ts-expect-error allowed index type
    return this.rules[context.container.$type]?.call(this, context) ?? EMPTY_SCOPE
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

  private readonly rules: RuleMap = {
    ImportDeclaration: (source) => {
      const path = getPathAsString(source.container, source.index)
      const parentPath = substringBeforeLast(path, '.')
      const siblings = this.packageManager.find(parentPath)?.children.values()
      if (!siblings) {
        return EMPTY_SCOPE
      }

      const elements: AstNodeDescription[] = []
      for (const sibling of siblings) {
        if (sibling.isDataNode()) {
          sibling.data.forEach(it => elements.push(this.descriptions.createDescription(it, sibling.name)))
        }
        else {
          elements.push(createSyntheticAstNodeDescription('SyntheticHierarchyNode', sibling.name, sibling))
        }
      }
      return this.createScope(elements)
    },

    ReferenceExpression: (source) => {
      let outer: Scope

      const packages: Stream<AstNodeDescription> = stream(this.packageManager.root.children.values())
        .filter(it => it.isInternalNode())
        .map(it => createSyntheticAstNodeDescription('SyntheticHierarchyNode', it.name, it))
      outer = this.createScope(packages)

      const globals = this.indexManager.allElements()
      outer = this.createScope(globals, outer)

      const synthetics = this.syntheticsProvider.getSynthetics(source.container)
      outer = this.createScope(synthetics, outer)

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
    },

    MemberAccess: (source) => {
      const synthetics = this.syntheticsProvider.getSynthetics(source.container)
      const members = this.memberProvider.getMember(source.container.receiver)
      return this.createScope(members, this.createScope(synthetics))
    },

    NamedTypeReference: (source) => {
      if (!source.index) {
        const classes = stream(this.packageManager.root.children.values())
          .filter(it => it.isDataNode())
          .flatMap(it => it.data)
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
        const prev = source.container.path[source.index - 1].ref
        const members = this.memberProvider.getMember(prev)
        return this.createScope(members)
      }
    },
  }
}
