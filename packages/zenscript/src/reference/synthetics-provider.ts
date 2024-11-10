import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { MemberProvider } from './member-provider'
import { AstUtils, stream } from 'langium'
import { isCallExpression, isClassDeclaration, isFunctionDeclaration, isOperatorFunctionDeclaration } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'

export interface SyntheticsProvider {
  getSynthetics: (source: AstNode) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => AstNodeDescription[] }

export class ZenScriptSyntheticsProvider implements SyntheticsProvider {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly memberProvider: MemberProvider

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
  }

  getSynthetics(source: AstNode): AstNodeDescription[] {
    // @ts-expect-error allowed index type
    return this.rules[source.$type]?.call(this, source)
  }

  private readonly rules: RuleMap = {
    ReferenceExpression: (source) => {
      const synthetics: AstNodeDescription[] = []

      // synthetic this
      const classDecl = AstUtils.getContainerOfType(source, isClassDeclaration)
      if (classDecl) {
        synthetics.push(this.descriptions.createDescription(classDecl, 'this'))
      }

      // synthetic arguments
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
              .forEach(it => synthetics.push(this.descriptions.createDescription(it, it.name)))
          }
        }
      }

      return synthetics
    },

    MemberAccess: (source) => {
      const synthetics: AstNodeDescription[] = []

      // synthetic member
      const operatorDecl = stream(this.memberProvider.getMember(source.receiver))
        .map(it => it.node)
        .filter(it => isOperatorFunctionDeclaration(it))
        .filter(it => it.parameters.length === 1)
        .find(it => it.op === '.')
      if (operatorDecl) {
        synthetics.push(this.descriptions.createDescription(operatorDecl.parameters[0], source.target.$refText))
      }

      return synthetics
    },
  }
}
