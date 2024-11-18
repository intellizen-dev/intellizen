import type { AstNode, AstNodeDescription } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ClassHierarchy } from '../typing/class-hierarchy'
import type { TypeComputer } from '../typing/type-computer'
import type { DescriptionIndex } from '../workspace/description-index'
import { AstUtils } from 'langium'
import { isCallExpression, isClassDeclaration, isFunctionDeclaration } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'
import { isStatic } from '../utils/ast'

export interface DynamicProvider {
  getDynamics: (source: AstNode) => AstNodeDescription[]
}

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => AstNodeDescription[] }

export class ZenScriptDynamicProvider implements DynamicProvider {
  private readonly descriptionIndex: DescriptionIndex
  private readonly typeComputer: TypeComputer
  private readonly classHierarchy: ClassHierarchy

  constructor(services: ZenScriptServices) {
    this.descriptionIndex = services.workspace.DescriptionIndex
    this.typeComputer = services.typing.TypeComputer
    this.classHierarchy = services.typing.ClassHierarchy
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
        dynamics.push(this.descriptionIndex.getThisDescription(classDecl))
      }

      // dynamic arguments
      if (isCallExpression(source.$container) && source.$containerProperty === 'arguments') {
        const index = source.$containerIndex!
        const receiverType = this.typeComputer.inferType(source.$container.receiver)
        if (isFunctionType(receiverType)) {
          const paramType = receiverType.paramTypes[index]
          if (isClassType(paramType)) {
            this.classHierarchy.streamDeclaredMembers(paramType.declaration)
              .filter(isFunctionDeclaration)
              .filter(isStatic)
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
      const receiverType = this.typeComputer.inferType(source.receiver)
      if (isClassType(receiverType)) {
        const operatorDecl = this.classHierarchy.streamDeclaredOperators(receiverType.declaration)
          .filter(it => it.op === '.')
          .filter(it => it.parameters.length === 1)
          .head()
        if (operatorDecl) {
          dynamics.push(this.descriptionIndex.createDynamicDescription(operatorDecl.parameters[0], source.target.$refText))
        }
      }

      return dynamics
    },
  }
}
