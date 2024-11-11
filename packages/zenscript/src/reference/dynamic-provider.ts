import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
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

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
  }

  getDynamics(source: AstNode): AstNodeDescription[] {
    // @ts-expect-error allowed index type
    return this.rules[source.$type]?.call(this, source)
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
            stream(this.memberProvider.getMember(paramType.declaration))
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
      const operatorDecl = stream(this.memberProvider.getMember(source.receiver))
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
