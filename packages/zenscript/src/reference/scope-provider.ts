import type { AstNode, AstNodeDescription, ReferenceInfo, Scope } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { PackageManager } from '../workspace/package-manager'
import type { DynamicProvider } from './dynamic-provider'
import type { MemberProvider } from './member-provider'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, MapScope, stream, StreamScope } from 'langium'

import { ClassDeclaration, ImportDeclaration, isClassDeclaration, TypeParameter } from '../generated/ast'
import { getPathAsString } from '../utils/ast'
import { getPrecomputedDescription } from '../utils/document'
import { generateStream } from '../utils/stream'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => Scope }

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly dynamicProvider: DynamicProvider
  private cachedGlobal: MapScope | undefined

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.dynamicProvider = services.references.DynamicProvider

    services.shared.workspace.DocumentBuilder.onUpdate(() => {
      this.cachedGlobal = undefined
    })
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
      .reduce((outer, descriptions) => new StreamScope(descriptions, outer), outside as Scope)
  }

  private dynamicScope(astNode: AstNode, outside?: Scope) {
    return this.createScope(this.dynamicProvider.getDynamics(astNode), outside)
  }

  private globalScope() {
    if (!this.cachedGlobal) {
      const outside = this.packageScope()
      this.cachedGlobal = new MapScope(this.indexManager.allElements(), outside)
    }
    return this.cachedGlobal
  }

  private packageScope(outside?: Scope) {
    const packages = stream(this.packageManager.root.children.values())
      .filter(it => it.isInternalNode())
      .map(it => this.packageManager.syntheticDescriptionOf(it))
    return new StreamScope(packages, outside)
  }

  private classScope(outside?: Scope) {
    const classes = stream(this.packageManager.root.children.values())
      .filter(it => it.isDataNode())
      .flatMap(it => it.data)
      .filter(isClassDeclaration)
      .map((it) => {
        const document = AstUtils.getDocument(it)
        return getPrecomputedDescription(document, it)
      })
    return new StreamScope(classes, outside)
  }

  private getImportDescription(importDecl: ImportDeclaration): AstNodeDescription | undefined {
    const refNode = importDecl.path.at(-1)
    if (!refNode) {
      return
    }

    // access the ref to ensure the lookup of the import
    const target = refNode?.ref
    if (!target) {
      return
    }

    if (!importDecl.alias) {
      return refNode?.$nodeDescription
    }

    const name = importDecl.alias

    const targetDesc = refNode?.$nodeDescription
    if (!targetDesc) {
      throw new Error(`could not find description for node: ${target}`)
    }

    return {
      node: target,
      name,
      get nameSegment() {
        return targetDesc.nameSegment
      },
      selectionSegment: targetDesc.selectionSegment,
      type: target.$type,
      documentUri: targetDesc.documentUri,
      path: targetDesc.path,
    }
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
          sibling.data.forEach((it) => {
            const document = AstUtils.getDocument(it)
            elements.push(getPrecomputedDescription(document, it))
          })
        }
        else {
          elements.push(this.packageManager.syntheticDescriptionOf(sibling))
        }
      }
      return this.createScope(elements)
    },

    ReferenceExpression: (source) => {
      let outer: Scope
      outer = this.globalScope()
      outer = this.dynamicScope(source.container, outer)

      const processor = (desc: AstNodeDescription) => {
        switch (desc.type) {
          case TypeParameter:
            return
          case ImportDeclaration: {
            const importDecl = desc.node as ImportDeclaration
            return this.getImportDescription(importDecl) ?? desc
          }
          default:
            return desc
        }
      }
      return this.lexicalScope(source.container, processor, outer)
    },

    MemberAccess: (source) => {
      const outer = this.dynamicScope(source.container)
      const members = this.memberProvider.getMembers(source.container.receiver)
      return new StreamScope(members, outer)
    },

    NamedTypeReference: (source) => {
      if (!source.index) {
        const outer = this.classScope()
        const processor = (desc: AstNodeDescription) => {
          switch (desc.type) {
            case TypeParameter:
            case ClassDeclaration:
              return desc
            case ImportDeclaration: {
              const importDecl = desc.node as ImportDeclaration
              return this.getImportDescription(importDecl) ?? desc
            }
          }
        }
        return this.lexicalScope(source.container, processor, outer)
      }
      else {
        const prev = source.container.path[source.index - 1].ref
        const members = this.memberProvider.getMembers(prev)
        return new StreamScope(members)
      }
    },
  }
}
