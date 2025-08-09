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
import { createSyntheticAstNodeDescription, SyntheticAstNode } from './synthetic'

type RuleSpec = ZenScriptAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: ReferenceInfo & { container: RuleSpec[K] }) => Scope }

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
    return this.scopeRules(context.container.$type)?.call(this, context) ?? EMPTY_SCOPE
  }

  private lexicalScope(
    astNode: AstNode,
    processor: (desc: AstNodeDescription) => AstNodeDescription | undefined,
    outside?: Scope,
  ): Scope {
    const localSymbols = AstUtils.getDocument(astNode).localSymbols
    return generateStream(astNode, it => it.$container)
      .map(container => localSymbols?.getStream(container))
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
      .filter(it => !it.hasData())
      .map(it => new SyntheticAstNode(it))
    return this.createScopeForNodes(packages, outside)
  }

  private classScope(outside?: Scope) {
    const classes = stream(this.packageManager.root.children.values())
      .filter(it => it.hasData())
      .flatMap(it => it.data)
      .filter(isClassDeclaration)
    return this.createScopeForNodes(classes, outside)
  }

  private importedScope(element: ReferenceInfo, outside?: Scope) {
    const script = AstUtils.findRootNode(element.container)
    if (!isScript(script)) {
      return EMPTY_SCOPE
    }

    const refText = element.reference.$refText
    const imports = stream(script.imports)
      .flatMap(it => this.descriptionCreator.createImportedDescriptions(it))

    if (refText === '' || !isCallExpression(element.container.$container) || element.container.$containerProperty !== 'receiver') {
      return this.createScope(imports, outside)
    }

    // TODO: Workaround for function overloading, may rework after langium supports multi-target references
    const maybeCandidates = imports
      .filter(it => it.name === refText)
      .map(it => it.node)
      .nonNullable()
      .toArray()

    const overloads = this.overloadResolver.resolveOverloads(element.container.$container, maybeCandidates)
    const descriptions = overloads.map(it => this.descriptionCreator.createDynamicDescription(it, refText))
    return this.createScope(descriptions, outside)
  }

  override createScopeForNodes(nodes: Iterable<AstNode>, outerScope?: Scope, options?: ScopeOptions): Scope {
    return new StreamScope(stream(nodes).map(it => this.descriptionCreator.getOrCreateDescription(it)), outerScope, options)
  }

  private readonly scopeRules = defineRules<RuleMap>({
    ImportDeclaration: (element) => {
      const fullPath = getPathAsString(element.container, element.index)

      let subPath: string
      const endsWithDot = element.container.$cstNode?.text.endsWith('.') ?? false
      if (element.index === undefined && endsWithDot) {
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
        if (child.hasData()) {
          return child.data.values().map(it => this.descriptionCreator.getOrCreateDescription(it))
        }
        else {
          return createSyntheticAstNodeDescription(child.name, child)
        }
      })

      return new StreamScope(elements)
    },

    ReferenceExpression: (element) => {
      let outer: Scope
      outer = this.packageScope()
      outer = this.globalScope(outer)
      outer = this.importedScope(element, outer)
      outer = this.dynamicScope(element.container, outer)

      const processor = (desc: AstNodeDescription) => {
        switch (desc.type) {
          case TypeParameter.$type:
            return
          case ImportDeclaration.$type: {
            return
          }
          case ClassDeclaration.$type: {
            const classDecl = desc.node as ClassDeclaration
            const callExpr = element.container.$container
            if (isCallExpression(callExpr) && element.container.$containerProperty === 'receiver') {
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
      return this.lexicalScope(element.container, processor, outer)
    },

    MemberAccess: (element) => {
      const outer = this.dynamicScope(element.container)
      const members = this.memberProvider.streamMembers(element.container.receiver)

      if (element.reference.$refText && isCallExpression(element.container.$container) && element.container.$containerProperty === 'receiver') {
        const maybeCandidates = members.filter(it => this.nameProvider.getName(it) === element.reference.$refText).toArray()
        const overloads = this.overloadResolver.resolveOverloads(element.container.$container, maybeCandidates)
        return this.createScopeForNodes(overloads, outer)
      }
      else {
        return this.createScopeForNodes(members, outer)
      }
    },

    NamedType: (element) => {
      if (!element.index) {
        let outer = this.packageScope()
        outer = this.classScope(outer)
        const processor = (desc: AstNodeDescription) => {
          switch (desc.type) {
            case TypeParameter.$type:
            case ClassDeclaration.$type:
              return desc
            case ImportDeclaration.$type: {
              return this.descriptionCreator.createImportedDescriptions(desc.node as ImportDeclaration)[0]
            }
          }
        }
        return this.lexicalScope(element.container, processor, outer)
      }
      else {
        const prev = element.container.path[element.index - 1].ref
        const members = this.memberProvider.streamMembers(prev)
        return this.createScopeForNodes(members)
      }
    },
  })
}
