import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { WorkspaceCache } from '../utils/cache'
import type { MemberProvider } from './member-provider'
import { AstUtils, stream } from 'langium'
import { isCallExpression, isClassDeclaration, isFunctionDeclaration, isOperatorFunctionDeclaration } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'

export interface DynamicProvider {
  getDynamics: (source: AstNode) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => AstNodeDescription[] }

export class ZenScriptDynamicProvider implements DynamicProvider {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly memberProvider: MemberProvider
  private readonly workspaceCache: WorkspaceCache

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
    this.workspaceCache = services.shared.workspace.Cache
  }

  getDynamics(source: AstNode): AstNodeDescription[] {
    const cache = this.workspaceCache.get(this)
    if (cache.has(this, source)) {
      return cache.get(this, source)
    }
    // @ts-expect-error allowed index type
    const dynamics = this.rules[source.$type]?.call(this, source)
    if (dynamics) {
      cache.set(this, source, dynamics)
    }
    return dynamics
  }

  private readonly rules: RuleMap = {
    ReferenceExpression: (source) => {
      const dynamics: AstNodeDescription[] = []

      // dynamic this
      const classDecl = AstUtils.getContainerOfType(source, isClassDeclaration)
      if (classDecl) {
        dynamics.push(this.descriptions.createDescription(classDecl, 'this'))
      }

      // dynamic arguments
      if (isCallExpression(source.$container) && source.$containerProperty === 'arguments') {
        const index = source.$containerIndex!
        const receiverType = this.typeComputer.inferType(source.$container.receiver)
        if (isFunctionType(receiverType)) {
          const paramType = receiverType.paramTypes[index]
          if (isClassType(paramType)) {
            stream(this.memberProvider.getMembers(paramType.declaration))
              .map(it => it.node)
              .filter(it => isFunctionDeclaration(it))
              .filter(it => it.prefix === 'static')
              .filter(it => it.parameters.length === 0)
              .forEach(it => dynamics.push(this.descriptions.createDescription(it, it.name)))
          }
        }
      }

      return dynamics
    },

    MemberAccess: (source) => {
      const dynamics: AstNodeDescription[] = []

      // dynamic member
      const operatorDecl = stream(this.memberProvider.getMembers(source.receiver))
        .map(it => it.node)
        .filter(it => isOperatorFunctionDeclaration(it))
        .filter(it => it.parameters.length === 1)
        .find(it => it.op === '.')
      if (operatorDecl) {
        dynamics.push(this.descriptions.createDescription(operatorDecl.parameters[0], source.target.$refText))
      }

      return dynamics
    },
  }
}
