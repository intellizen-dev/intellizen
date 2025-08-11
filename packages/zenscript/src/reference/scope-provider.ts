import type { AstNode, ReferenceInfo, Scope, ScopeOptions } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { PackageManager } from '../workspace/package-manager'
import type { MemberProvider } from './member-provider'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, stream, StreamScope } from 'langium'
import { CallExpression, isCallExpression, isClassDeclaration, isFunctionDeclaration, isMemberAccess, isOperatorFunctionDeclaration, isReferenceExpression } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'
import { getPathAsString, isStatic } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { generateStream, toStream } from '../utils/stream'
import { createSyntheticAstNodeDescription } from './synthetic'

type RuleSpec = ZenScriptAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: ReferenceInfo & { container: RuleSpec[K] }) => Scope }

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.references.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.typeComputer = services.typing.TypeComputer
  }

  override getScope(context: ReferenceInfo): Scope {
    return this.scopeRules(context.container.$type)?.call(this, context) ?? EMPTY_SCOPE
  }

  private readonly scopeRules = defineRules<RuleMap>({
    ImportDeclaration: ({ container, index }) => {
      const fullPath = getPathAsString(container, index)

      let subPath: string
      const endsWithDot = container.$cstNode?.text.endsWith('.') ?? false
      if (index === undefined && endsWithDot) {
        subPath = fullPath
      }
      else {
        subPath = substringBeforeLast(fullPath, '.')
      }

      const tree = this.packageManager.findNode(subPath)
      if (!tree) {
        return EMPTY_SCOPE
      }

      const elements = stream(tree.children.values()).flatMap((child) => {
        if (child.hasData()) {
          return child.data.values().map(it => this.descriptions.getOrCreateDescription(it))
        }
        else {
          return createSyntheticAstNodeDescription(child.name, child)
        }
      })

      return new StreamScope(elements)
    },

    ReferenceExpression: ({ container }) => {
      let outer: Scope
      outer = this.createPackageNameScope()
      outer = this.createGlobalScope(outer)
      outer = this.createDynamicScope(container, outer)
      outer = this.createLexicalScope(container, outer)
      return outer
    },

    MemberAccess: ({ container }) => {
      const members = this.memberProvider.streamMembers(container.receiver)
      const outer = this.createDynamicScope(container)
      return this.createScopeForNodes(members, outer)
    },

    NamedType: ({ container, index }) => {
      if (!index) {
        let outer: Scope
        outer = this.createPackageNameScope()
        outer = this.createClassNameScope(outer)
        outer = this.createLexicalScope(container, outer)
        return outer
      }
      else {
        const prev = container.path[index - 1].ref
        const members = this.memberProvider.streamMembers(prev)
        return this.createScopeForNodes(members)
      }
    },
  })

  private createLexicalScope(node: AstNode, outer?: Scope): Scope {
    const localSymbols = AstUtils.getDocument(node).localSymbols
    return generateStream(node, it => it.$container)
      .map(container => localSymbols?.getStream(container))
      .nonNullable()
      .map(descriptions => stream(descriptions))
      .reduceRight((outer, descriptions) => new StreamScope(descriptions, outer), outer as Scope)
  }

  private createDynamicScope(node: AstNode, outer?: Scope): Scope {
    if (isReferenceExpression(node)) {
      return new StreamScope(toStream(function* (this: ZenScriptScopeProvider) {
        // dynamic this
        const classDecl = AstUtils.getContainerOfType(node, isClassDeclaration)
        if (classDecl) {
          yield this.descriptions.createDescription(classDecl, 'this')
        }

        // dynamic arguments
        if (isCallExpression(node.$container) && node.$containerProperty === CallExpression.args) {
          const index = node.$containerIndex!
          const receiverType = this.typeComputer.inferType(node.$container.receiver)
          if (isFunctionType(receiverType)) {
            const paramType = receiverType.paramTypes[index]
            if (isClassType(paramType)) {
              yield* stream(paramType.declaration.members)
                .filter(isFunctionDeclaration)
                .filter(isStatic)
                .filter(it => it.params.length === 0)
                .map(it => this.descriptions.getOrCreateDescription(it))
            }
          }
        }
      }.bind(this)), outer)
    }
    else if (isMemberAccess(node)) {
      return new StreamScope(toStream(function* (this: ZenScriptScopeProvider) {
        // dynamic members
        const receiverType = this.typeComputer.inferType(node.receiver)
        if (isClassType(receiverType)) {
          const operatorDecl = stream(receiverType.declaration.members)
            .filter(isOperatorFunctionDeclaration)
            .filter(it => it.operator === '.')
            .filter(it => it.params.length === 1)
            .head()
          if (operatorDecl) {
            yield this.descriptions.createDescription(operatorDecl.params[0], node.entity.$refText)
          }
        }
      }.bind(this)), outer)
    }
    else {
      return EMPTY_SCOPE
    }
  }

  private createGlobalScope(outer?: Scope): Scope {
    return new StreamScope(this.indexManager.allElements(), outer)
  }

  private createPackageNameScope(outer?: Scope): Scope {
    const packages = stream(this.packageManager.root.children.values())
      .filter(it => !it.hasData())
      .map(it => createSyntheticAstNodeDescription(it.name, it))
    return new StreamScope(packages, outer)
  }

  private createClassNameScope(outer?: Scope) {
    const classes = stream(this.packageManager.root.children.values())
      .filter(it => it.hasData())
      .flatMap(it => it.data)
      .filter(isClassDeclaration)
    return this.createScopeForNodes(classes, outer)
  }

  override createScopeForNodes(nodes: Iterable<AstNode>, outerScope?: Scope, options?: ScopeOptions): Scope {
    return new StreamScope(stream(nodes).map(it => this.descriptions.getOrCreateDescription(it)), outerScope, options)
  }
}
