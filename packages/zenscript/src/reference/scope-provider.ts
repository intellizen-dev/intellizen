import type { AstNode, AstNodeDescription, ReferenceInfo, Scope, ScopeOptions } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { OverloadResolver } from '../typing/overload-resolver'
import type { DescriptionCreator } from '../workspace/description-creator'
import type { PackageManager } from '../workspace/package-manager'
import type { DynamicProvider } from './dynamic-provider'
import type { MemberProvider } from './member-provider'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, stream, StreamScope } from 'langium'
import { ClassDeclaration, ImportDeclaration, isCallExpression, isClassDeclaration, isConstructorDeclaration, isScript, TypeParameter } from '../generated/ast'
import { getPathAsString } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { generateStream } from '../utils/stream'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => Scope }

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly dynamicProvider: DynamicProvider
  private readonly descriptionCreator: DescriptionCreator
  private readonly overloadResolver: OverloadResolver

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.shared.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.dynamicProvider = services.references.DynamicProvider
    this.descriptionCreator = services.workspace.AstNodeDescriptionProvider
    this.overloadResolver = services.typing.OverloadResolver
  }

  override getScope(context: ReferenceInfo): Scope {
    return this.rules(context.container.$type)?.call(this, context) ?? EMPTY_SCOPE
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
      .reduceRight((outer, descriptions) => this.createScope(descriptions, outer), outside as Scope)
  }

  private dynamicScope(astNode: AstNode, outside?: Scope) {
    return this.createScope(this.dynamicProvider.streamDynamicDescriptions(astNode), outside)
  }

  private globalScope(outside?: Scope) {
    return this.createScope(this.indexManager.allElements(), outside)
  }

  private packageScope(outside?: Scope) {
    const packages = stream(this.packageManager.root.children.values())
      .filter(it => it.isInternalNode())
    return this.createScopeForNodes(packages, outside)
  }

  private classScope(outside?: Scope) {
    const classes = stream(this.packageManager.root.children.values())
      .filter(it => it.isDataNode())
      .flatMap(it => it.data)
      .filter(isClassDeclaration)
    return this.createScopeForNodes(classes, outside)
  }

  private importedScope(source: ReferenceInfo, outside?: Scope) {
    const script = AstUtils.findRootNode(source.container)
    if (!isScript(script)) {
      return EMPTY_SCOPE
    }

    const refText = source.reference.$refText
    const imports = stream(script.imports)
      .flatMap(it => this.descriptionCreator.createImportedDescriptions(it))

    if (refText === '' || !isCallExpression(source.container.$container) || source.container.$containerProperty !== 'receiver') {
      return this.createScope(imports, outside)
    }

    // TODO: Workaround for function overloading, may rework after langium supports multi-target references
    const maybeCandidates = imports
      .filter(it => it.name === refText)
      .map(it => it.node)
      .nonNullable()
      .toArray()

    const overloads = this.overloadResolver.resolveOverloads(source.container.$container, maybeCandidates)
    const descriptions = overloads.map(it => this.descriptionCreator.createDynamicDescription(it, refText))
    return this.createScope(descriptions, outside)
  }

  override createScopeForNodes(nodes: Iterable<AstNode>, outerScope?: Scope, options?: ScopeOptions): Scope {
    return new StreamScope(stream(nodes).map(it => this.descriptionCreator.getOrCreateDescription(it)), outerScope, options)
  }

  private readonly rules = defineRules<RuleMap>({
    ImportDeclaration: (source) => {
      const fullPath = getPathAsString(source.container, source.index)

      let subPath: string
      const endsWithDot = source.container.$cstNode?.text.endsWith('.') ?? false
      if (source.index === undefined && endsWithDot) {
        subPath = fullPath
      }
      else {
        subPath = substringBeforeLast(fullPath, '.')
      }

      const tree = this.packageManager.find(subPath)
      if (!tree) {
        return EMPTY_SCOPE
      }

      const elements = stream(tree.children.values()).flatMap((child) => {
        if (child.isDataNode()) {
          return child.data.values().map(it => this.descriptionCreator.getOrCreateDescription(it))
        }
        else {
          return this.descriptionCreator.getOrCreateDescription(child)
        }
      })

      return new StreamScope(elements)
    },

    ReferenceExpression: (source) => {
      let outer: Scope
      outer = this.packageScope()
      outer = this.globalScope(outer)
      outer = this.importedScope(source, outer)
      outer = this.dynamicScope(source.container, outer)

      const processor = (desc: AstNodeDescription) => {
        switch (desc.type) {
          case TypeParameter:
            return
          case ImportDeclaration: {
            return
          }
          case ClassDeclaration: {
            const classDecl = desc.node as ClassDeclaration
            const callExpr = source.container.$container
            if (isCallExpression(callExpr) && source.container.$containerProperty === 'receiver') {
              const constructors = classDecl.members.filter(isConstructorDeclaration)
              const overloads = this.overloadResolver.resolveOverloads(callExpr, constructors)
              if (overloads[0]) {
                return this.descriptionCreator.getOrCreateDescription(overloads[0])
              }
            }
            return desc
          }
          default:
            return desc
        }
      }
      return this.lexicalScope(source.container, processor, outer)
    },

    MemberAccess: (source) => {
      const outer = this.dynamicScope(source.container)
      const members = this.memberProvider.streamMembers(source.container.receiver)

      if (source.reference.$refText && isCallExpression(source.container.$container) && source.container.$containerProperty === 'receiver') {
        const maybeCandidates = members.filter(it => this.nameProvider.getName(it) === source.reference.$refText).toArray()
        const overloads = this.overloadResolver.resolveOverloads(source.container.$container, maybeCandidates)
        return this.createScopeForNodes(overloads, outer)
      }
      else {
        return this.createScopeForNodes(members, outer)
      }
    },

    NamedTypeReference: (source) => {
      if (!source.index) {
        let outer = this.packageScope()
        outer = this.classScope(outer)
        const processor = (desc: AstNodeDescription) => {
          switch (desc.type) {
            case TypeParameter:
            case ClassDeclaration:
              return desc
            case ImportDeclaration: {
              return this.descriptionCreator.createImportedDescriptions(desc.node as ImportDeclaration)[0]
            }
          }
        }
        return this.lexicalScope(source.container, processor, outer)
      }
      else {
        const prev = source.container.path[source.index - 1].ref
        const members = this.memberProvider.streamMembers(prev)
        return this.createScopeForNodes(members)
      }
    },
  })
}
