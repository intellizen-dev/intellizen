import type { AstNode, AstNodeDescription, ReferenceInfo, Scope, ScopeOptions, Stream } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { PackageManager } from '../workspace/package-manager'
import type { MemberProvider } from './member-provider'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, EMPTY_STREAM, stream, StreamScope } from 'langium'
import * as ast from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'
import { findMaximumLowerBound, getIndexOfContainer, getPathAsString, isStatic } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { generateStream, toStream } from '../utils/stream'
import { createSyntheticAstNodeDescription } from './synthetic'

type RuleSpec = ZenScriptAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: Omit<ReferenceInfo, 'container'> & { container: RuleSpec[K] }) => Scope }

declare module 'langium' {
  interface LocalSymbols {
    get: (key: AstNode) => AstNodeDescription[]
  }
}

interface LexicalNode {
  container: AstNode
  symbols: AstNodeDescription[]
}

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
      let scope: Scope
      scope = this.createPackageNameScope()
      scope = this.createGlobalScope(scope)
      scope = this.createDynamicScope(container, scope)

      {
        let seed: AstNode = container.$container
        if (ast.isForStatement(seed) && container.$containerProperty === ast.ForStatement.range) {
          // ForStatement::range should not be accessible to ForStatement::params
          // Skip ForStatement
          seed = seed.$container
        }
        else if (ast.isValueParameter(seed) && container.$containerProperty === ast.ValueParameter.defaultValue) {
          // ValueParameter::defaultValue should not be accessible to ValueParameter itself
          // Skip CallableDeclaration
          seed = seed.$container.$container
        }
        scope = this.streamLexicalSymbols(seed)
          .map((node) => {
            const refIndex = getIndexOfContainer(seed, node.container)
            // Ensure ref's index is greater than symbol's index (declaration before usage)
            const lowerBound = refIndex ? findMaximumLowerBound(node.symbols, refIndex) : node.symbols.length
            // Reverse order (nearest first)
            return stream(node.symbols.slice(0, lowerBound).reverse())
          })
          .reduceRight((outer, symbols) => new StreamScope(symbols, outer), scope)
      }

      return scope
    },

    MemberAccess: ({ container }) => {
      const members = this.memberProvider.streamMembers(container.receiver)
      const outer = this.createDynamicScope(container)
      return this.createScopeForNodes(members, outer)
    },

    NamedType: ({ container, index }) => {
      if (!index) {
        let scope: Scope
        scope = this.createPackageNameScope()
        scope = this.createClassNameScope(scope)
        scope = this.streamLexicalSymbols(container)
          .map(node => stream(node.symbols)
            .filter(symbol =>
              ast.isClassDeclaration(symbol.node)
              || ast.isTypeParameter(symbol.node)
              || ast.isImportDeclaration(symbol.node)))
          .reduceRight((outer, symbols) => new StreamScope(symbols, outer), scope)
        return scope
      }
      else {
        const prev = container.path[index - 1].ref
        const members = this.memberProvider.streamMembers(prev)
        return this.createScopeForNodes(members)
      }
    },
  })

  private streamLexicalSymbols(seed: AstNode): Stream<LexicalNode> {
    const localSymbols = AstUtils.getDocument(seed).localSymbols
    if (localSymbols) {
      return generateStream(seed, it => it.$container)
        .filter(it => localSymbols.has(it))
        .map(it => ({ container: it, symbols: localSymbols.get(it) }))
    }
    else {
      return EMPTY_STREAM
    }
  }

  private createDynamicScope(node: AstNode, outer?: Scope): Scope {
    if (ast.isReferenceExpression(node)) {
      return new StreamScope(toStream(function* (this: ZenScriptScopeProvider) {
        // dynamic this
        const classDecl = AstUtils.getContainerOfType(node, ast.isClassDeclaration)
        if (classDecl) {
          yield this.descriptions.createDescription(classDecl, 'this')
        }

        // dynamic arguments
        if (ast.isCallExpression(node.$container) && node.$containerProperty === ast.CallExpression.args) {
          const index = node.$containerIndex!
          const receiverType = this.typeComputer.inferType(node.$container.receiver)
          if (isFunctionType(receiverType)) {
            const paramType = receiverType.paramTypes[index]
            if (isClassType(paramType)) {
              yield* stream(paramType.declaration.members)
                .filter(ast.isFunctionDeclaration)
                .filter(isStatic)
                .filter(it => it.params.length === 0)
                .map(it => this.descriptions.getOrCreateDescription(it))
            }
          }
        }
      }.bind(this)), outer)
    }
    else if (ast.isMemberAccess(node)) {
      return new StreamScope(toStream(function* (this: ZenScriptScopeProvider) {
        // dynamic members
        const receiverType = this.typeComputer.inferType(node.receiver)
        if (isClassType(receiverType)) {
          const operatorDecl = stream(receiverType.declaration.members)
            .filter(ast.isOperatorFunctionDeclaration)
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
      .filter(ast.isClassDeclaration)
    return this.createScopeForNodes(classes, outer)
  }

  override createScopeForNodes(nodes: Iterable<AstNode>, outerScope?: Scope, options?: ScopeOptions): Scope {
    return new StreamScope(stream(nodes).map(it => this.descriptions.getOrCreateDescription(it)), outerScope, options)
  }
}
