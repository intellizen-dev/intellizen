import type { AstNode, AstNodeDescription, ReferenceInfo, Scope } from 'langium'
import type { CallExpression, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptOverloadResolver } from '../typing/overload-resolver'
import type { ZenScriptDescriptionIndex } from '../workspace/description-index'
import type { PackageManager } from '../workspace/package-manager'
import type { DynamicProvider } from './dynamic-provider'
import type { MemberProvider } from './member-provider'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, stream } from 'langium'
import { ClassDeclaration, ImportDeclaration, isCallExpression, isClassDeclaration, isScript, TypeParameter } from '../generated/ast'
import { getPathAsString } from '../utils/ast'
import { generateStream } from '../utils/stream'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => Scope }

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly dynamicProvider: DynamicProvider
  private readonly descriptionIndex: ZenScriptDescriptionIndex
  private readonly overloadResolver: ZenScriptOverloadResolver

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.dynamicProvider = services.references.DynamicProvider
    this.descriptionIndex = services.workspace.DescriptionIndex
    this.overloadResolver = services.typing.OverloadResolver
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

  private importScope(source: ReferenceInfo, outer?: Scope) {
    const script = AstUtils.findRootNode(source.container)
    if (!isScript(script)) {
      return EMPTY_SCOPE
    }

    const imports = stream(script.imports)
      .flatMap(it => this.descriptionIndex.createImportedDescription(it))

    if (source.reference.$refText === '' || !isCallExpression(source.container.$container) || source.container.$containerProperty !== 'receiver') {
      return this.createScope(imports, outer)
    }

    const overload = this.overloadResolver.findOverloadMethod(imports, source.container.$container, source.reference.$refText)
    if (!overload) {
      return outer || EMPTY_SCOPE
    }
    return this.createScope([overload], outer)
  }

  private dynamicScope(astNode: AstNode, outside?: Scope) {
    return this.createScope(this.dynamicProvider.getDynamics(astNode), outside)
  }

  private globalScope(outside?: Scope) {
    return this.createScope(this.indexManager.allElements(), outside)
  }

  private packageScope(outside?: Scope) {
    const packages = stream(this.packageManager.root.children.values())
      .filter(it => it.isInternalNode())
      .map(it => this.descriptionIndex.getPackageDescription(it))
    return this.createScope(packages, outside)
  }

  private classScope(outside?: Scope) {
    const classes = stream(this.packageManager.root.children.values())
      .filter(it => it.isDataNode())
      .flatMap(it => it.data)
      .filter(isClassDeclaration)
      .map(it => this.descriptionIndex.getDescription(it))
    return this.createScope(classes, outside)
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
          sibling.data.forEach(it => elements.push(this.descriptionIndex.getDescription(it)))
        }
        else {
          elements.push(this.descriptionIndex.getPackageDescription(sibling))
        }
      }
      return this.createScope(elements)
    },

    ReferenceExpression: (source) => {
      let outer: Scope
      outer = this.packageScope()
      outer = this.globalScope(outer)
      outer = this.dynamicScope(source.container, outer)

      outer = this.importScope(source, outer)

      const processOverload = source.reference.$refText !== '' && isCallExpression(source.container.$container) && source.container.$containerProperty === 'receiver'

      const processor = (desc: AstNodeDescription) => {
        switch (desc.type) {
          case TypeParameter:
            return
          case ImportDeclaration: {
            return
          }
          case ClassDeclaration: {
            if (processOverload) {
              return this.overloadResolver.findOverlaodConstructor(desc.node as ClassDeclaration, source.container.$container as CallExpression)
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
      const members = this.memberProvider.getMembers(source.container.receiver)

      if (source.reference.$refText === '' || !isCallExpression(source.container.$container) || source.container.$containerProperty !== 'receiver') {
        return this.createScope(members, outer)
      }

      const overload = this.overloadResolver.findOverloadMethod(members, source.container.$container, source.reference.$refText)
      if (!overload) {
        return outer
      }
      return this.createScope([overload], outer)
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
              return this.descriptionIndex.createImportedDescription(desc.node as ImportDeclaration).at(0) || desc
            }
          }
        }
        return this.lexicalScope(source.container, processor, outer)
      }
      else {
        const prev = source.container.path[source.index - 1].ref
        const members = this.memberProvider.getMembers(prev)
        return this.createScope(members)
      }
    },
  }
}
