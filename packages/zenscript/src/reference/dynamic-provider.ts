import type { AstNode, AstNodeDescription } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { DescriptionIndex } from '../workspace/description-index'
import type { MemberProvider } from './member-provider'
import { AstUtils, stream } from 'langium'
import { isCallExpression, isClassDeclaration, isFunctionDeclaration, isOperatorFunctionDeclaration } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'
import { defineRules } from '../utils/rule'

export interface DynamicProvider {
  getDynamics: (source: AstNode) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => AstNodeDescription[] }

export class ZenScriptDynamicProvider implements DynamicProvider {
  private readonly descriptionIndex: DescriptionIndex
  private readonly typeComputer: TypeComputer
  private readonly memberProvider: MemberProvider

  constructor(services: ZenScriptServices) {
    this.descriptionIndex = services.workspace.DescriptionIndex
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
  }

  getDynamics(source: AstNode): AstNodeDescription[] {
    return this.rules(source.$type)?.call(this, source) ?? []
  }

  private readonly rules = defineRules<RuleMap>({
    ReferenceExpression: (source) => {
      const dynamics: AstNodeDescription[] = []

      // dynamic this
      const classDecl = AstUtils.getContainerOfType(source, isClassDeclaration)
      if (classDecl) {
        dynamics.push(this.descriptionIndex.getThisDescription(classDecl))
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
              .forEach(it => dynamics.push(this.descriptionIndex.getDescription(it)))
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
        dynamics.push(this.descriptionIndex.createDynamicDescription(operatorDecl.parameters[0], source.target.$refText))
      }

      return dynamics
    },
  })
}
