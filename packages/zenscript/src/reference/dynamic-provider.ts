import type { AstNode, AstNodeDescription, Stream } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptOverloadResolver } from '../typing/overload-resolver'
import type { TypeComputer } from '../typing/type-computer'
import type { DescriptionIndex } from '../workspace/description-index'
import { AstUtils, EMPTY_STREAM, stream } from 'langium'
import { isCallExpression, isClassDeclaration } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'
import { isStatic, streamDeclaredFunctions, streamDeclaredOperators } from '../utils/ast'
import { defineRules } from '../utils/rule'

export interface DynamicProvider {
  streamDynamicDescriptions: (source: AstNode) => Stream<AstNodeDescription>
}

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => Stream<AstNodeDescription> }

export class ZenScriptDynamicProvider implements DynamicProvider {
  private readonly descriptionIndex: DescriptionIndex
  private readonly typeComputer: TypeComputer
  private readonly overloadResolver: ZenScriptOverloadResolver

  constructor(services: ZenScriptServices) {
    this.descriptionIndex = services.workspace.DescriptionIndex
    this.typeComputer = services.typing.TypeComputer
    this.overloadResolver = services.typing.OverloadResolver
  }

  streamDynamicDescriptions(source: AstNode): Stream<AstNodeDescription> {
    return this.rules(source.$type)?.call(this, source) ?? EMPTY_STREAM
  }

  private readonly rules = defineRules<RuleMap>({
    ReferenceExpression: (source) => {
      return stream(function *(this: ZenScriptDynamicProvider) {
        // dynamic this
        const classDecl = AstUtils.getContainerOfType(source, isClassDeclaration)
        if (classDecl) {
          yield this.descriptionIndex.getThisDescription(classDecl)
        }

        // dynamic arguments
        if (isCallExpression(source.$container) && source.$containerProperty === 'arguments') {
          const index = source.$containerIndex!
          const receiverType = this.typeComputer.inferType(source.$container.receiver)
          if (isFunctionType(receiverType)) {
            const paramType = receiverType.paramTypes[index]
            if (isClassType(paramType)) {
              yield * streamDeclaredFunctions(paramType.declaration)
                .filter(isStatic)
                .filter(it => it.parameters.length === 0)
                .map(it => this.descriptionIndex.getDescription(it))
            }
          }
        }
      }.call(this))
    },

    MemberAccess: (source) => {
      return stream(function *(this: ZenScriptDynamicProvider) {
        // dynamic member
        const receiverType = this.typeComputer.inferType(source.receiver)
        if (isClassType(receiverType)) {
          const operatorDecl = streamDeclaredOperators(receiverType.declaration)
            .filter(it => it.op === '.')
            .filter(it => it.parameters.length === 1)
            .head()
          if (operatorDecl) {
            yield this.descriptionIndex.createDynamicDescription(operatorDecl.parameters[0], source.target.$refText)
          }
        }
      }.call(this))
    },
  })
}
