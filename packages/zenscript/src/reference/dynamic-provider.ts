import type { AstNode, AstNodeDescription, Stream } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { DescriptionCreator } from '../workspace/description-creator'
import { AstUtils, EMPTY_STREAM } from 'langium'
import { isCallExpression, isClassDeclaration } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'
import { isStatic, streamDeclaredFunctions, streamDeclaredOperators } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { toStream } from '../utils/stream'

export interface DynamicProvider {
  streamDynamicDescriptions: (element: AstNode) => Stream<AstNodeDescription>
}

type RuleSpec = ZenScriptAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K]) => Stream<AstNodeDescription> }

export class ZenScriptDynamicProvider implements DynamicProvider {
  private readonly descriptionCreator: DescriptionCreator
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    this.descriptionCreator = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
  }

  streamDynamicDescriptions(element: AstNode): Stream<AstNodeDescription> {
    return this.dynamicDescRules(element.$type)?.call(this, element) ?? EMPTY_STREAM
  }

  private readonly dynamicDescRules = defineRules<RuleMap>({
    ReferenceExpression: (element) => {
      return toStream(function* (this: ZenScriptDynamicProvider) {
        // dynamic this
        const classDecl = AstUtils.getContainerOfType(element, isClassDeclaration)
        if (classDecl) {
          yield this.descriptionCreator.getOrCreateThisDescription(classDecl)
        }

        // dynamic arguments
        if (isCallExpression(element.$container) && element.$containerProperty === 'arguments') {
          const index = element.$containerIndex!
          const receiverType = this.typeComputer.inferType(element.$container.receiver)
          if (isFunctionType(receiverType)) {
            const paramType = receiverType.paramTypes[index]
            if (isClassType(paramType)) {
              yield* streamDeclaredFunctions(paramType.declaration)
                .filter(isStatic)
                .filter(it => it.params.length === 0)
                .map(it => this.descriptionCreator.getOrCreateDescription(it))
            }
          }
        }
      }.bind(this))
    },

    MemberAccess: (element) => {
      return toStream(function* (this: ZenScriptDynamicProvider) {
        // dynamic member
        const receiverType = this.typeComputer.inferType(element.receiver)
        if (isClassType(receiverType)) {
          const operatorDecl = streamDeclaredOperators(receiverType.declaration)
            .filter(it => it.operator === '.')
            .filter(it => it.params.length === 1)
            .head()
          if (operatorDecl) {
            yield this.descriptionCreator.createDynamicDescription(operatorDecl.params[0], element.entity.$refText)
          }
        }
      }.bind(this))
    },
  })
}
