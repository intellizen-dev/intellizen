import type { AstNode, AstNodeDescription, LangiumDocument, PrecomputedScopes, ReferenceInfo, Scope, ScopeOptions, Stream } from 'langium'
import type { Script, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptDescriptionIndex } from '../workspace/description-index'
import type { PackageManager } from '../workspace/package-manager'
import type { DynamicProvider } from './dynamic-provider'
import type { MemberProvider } from './member-provider'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, MapScope, stream, StreamScope } from 'langium'

import { ClassDeclaration, ImportDeclaration, isClassDeclaration, isScript, TypeParameter } from '../generated/ast'
import { getPathAsString } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { generateStream } from '../utils/stream'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => Scope }

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly dynamicProvider: DynamicProvider
  private readonly descriptionIndex: ZenScriptDescriptionIndex

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.dynamicProvider = services.references.DynamicProvider
    this.descriptionIndex = services.workspace.DescriptionIndex
  }

  override getScope(context: ReferenceInfo): Scope {
    return this.rules(context.container.$type)?.call(this, context) ?? EMPTY_SCOPE
  }

  private lexicalScope(
    astNode: AstNode,
    processor: (desc: AstNodeDescription) => AstNodeDescription | undefined,
    outside?: Scope,
    document?: LangiumDocument,
  ): Scope {
    const precomputed = (document ?? AstUtils.getDocument(astNode)).precomputedScopes
    return generateStream(astNode, it => it.$container)
      .map(container => precomputed?.get(container))
      .nonNullable()
      .map(descriptions => stream(descriptions).map(processor).nonNullable())
      .reduce((outer, descriptions) => this.createScope(descriptions, outer), outside as Scope)
  }

  private dynamicScope(astNode: AstNode, outside?: Scope) {
    return this.createScope(this.dynamicProvider.streamDynamicDescriptions(astNode), outside)
  }

  private globalScope(outside?: Scope) {
    return this.createScope(this.indexManager.allElements(), outside)
  }

  private packageCache: MapScope | undefined

  private packageScope(outside?: Scope) {
    if (!this.packageCache) {
      const packages = stream(this.packageManager.root.children.values())
        .filter(it => it.isInternalNode())
      this.packageCache = new MapScope(packages.map(it => this.descriptionIndex.getDescription(it)), outside)
    }

    return this.packageCache!
  }

  private importScope(script: Script, source: ReferenceInfo, outside?: Scope) {
    const imports = stream(script.imports)
      .map(it => this.descriptionIndex.createImportedDescription(it))
    return this.createScope(imports, outside)
  }

  private classScope(outside?: Scope) {
    const classes = stream(this.packageManager.root.children.values())
      .filter(it => it.isDataNode())
      .flatMap(it => it.data)
      .filter(isClassDeclaration)
    return this.createScopeForNodes(classes, outside)
  }

  override createScopeForNodes(nodes: Stream<AstNode>, outerScope?: Scope, options?: ScopeOptions): Scope {
    return new StreamScope(nodes.map(it => this.descriptionIndex.getDescription(it)), outerScope, options)
  }

  private readonly rules = defineRules<RuleMap>({
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
          sibling.data.forEach(it => elements.push(this.descriptionIndex.getDescription(it)))
        }
        else {
          elements.push(this.descriptionIndex.getDescription(sibling))
        }
      }
      return this.createScope(elements)
    },

    ReferenceExpression: (source) => {
      let outer: Scope
      outer = this.packageScope()
      outer = this.globalScope(outer)
      outer = this.dynamicScope(source.container, outer)

      const processor = (desc: AstNodeDescription) => {
        switch (desc.type) {
          case TypeParameter:
            return
          case ImportDeclaration: {
            return this.descriptionIndex.createImportedDescription(desc.node as ImportDeclaration)
          }
          default:
            return desc
        }
      }
      return this.lexicalScope(source.container, processor, outer)
    },

    MemberAccess: (source) => {
      const outer = this.dynamicScope(source.container)
      const members = this.memberProvider.streamMembers(source.container.receiver, { nameHint: source.reference.$refText })
      return this.createScopeForNodes(members, outer)
    },

    NamedTypeReference: (source) => {
      if (!source.index) {
        let outer = this.classScope()
        const document = AstUtils.getDocument(source.container)
        const script = document.parseResult.value
        if (!isScript(script)) {
          return outer
        }
        outer = this.importScope(script, source, outer)

        const localClasses = stream(script.classes)
          .filter(isClassDeclaration)
          .flatMap((it) => {
            if (it.typeParameters) {
              return [...it.typeParameters, it]
            }
            return it
          })
          .map(it => this.descriptionIndex.getDescription(it))

        return this.createScope(localClasses, outer)
      }
      else {
        const prev = source.container.path[source.index - 1].ref
        const members = this.memberProvider.streamMembers(prev, { nameHint: source.reference.$refText })
        return this.createScopeForNodes(members)
      }
    },
  })
}
