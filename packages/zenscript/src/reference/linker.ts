import type { AstNodeDescription, AstNodeDescriptionProvider, LinkingError, ReferenceInfo } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { MemberProvider } from './member-provider'
import { AstUtils, DefaultLinker, stream } from 'langium'
import { isCallExpression, isClassDeclaration, isFunctionDeclaration, isOperatorFunctionDeclaration } from '../generated/ast'
import { isClassType, isFunctionType } from '../typing/type-description'

type SourceMap = ZenScriptAstType
type SyntheticRuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => AstNodeDescription | undefined }

export class ZenScriptLinker extends DefaultLinker {
  private readonly typeComputer: TypeComputer
  private readonly memberProvider: MemberProvider
  private readonly descriptions: AstNodeDescriptionProvider

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
    this.descriptions = services.workspace.AstNodeDescriptionProvider
  }

  override getCandidate(refInfo: ReferenceInfo): AstNodeDescription | LinkingError {
    const scope = this.scopeProvider.getScope(refInfo)
    const description = scope.getElement(refInfo.reference.$refText) ?? this.getSynthetic(refInfo)
    return description ?? this.createLinkingError(refInfo)
  }

  private getSynthetic(refInfo: ReferenceInfo): AstNodeDescription | undefined {
    // @ts-expect-error allowed index type
    return this.syntheticRules[refInfo.container.$type]?.call(this, refInfo)
  }

  private readonly syntheticRules: SyntheticRuleMap = {
    MemberAccess: (source) => {
      return stream(this.memberProvider.getMember(source.container.receiver))
        .map(it => it.node)
        .filter(isOperatorFunctionDeclaration)
        .filter(it => it.op === '.')
        .map(it => this.descriptions.createDescription(it.parameters[0], undefined))
        .head()
    },

    ReferenceExpression: (source) => {
      // synthetic this
      if (source.reference.$refText === 'this') {
        const classDecl = AstUtils.getContainerOfType(source.container, isClassDeclaration)
        if (classDecl) {
          return this.descriptions.createDescription(classDecl, 'this')
        }
      }

      // synthetic argument
      if (isCallExpression(source.container.$container) && source.container.$containerProperty === 'arguments') {
        const argIndex = source.container.$containerIndex!
        const receiverType = this.typeComputer.inferType(source.container.$container.receiver)
        if (!isFunctionType(receiverType)) {
          return
        }

        const paramType = receiverType.paramTypes[argIndex]
        if (!isClassType(paramType)) {
          return
        }

        const funcDecl = stream(this.memberProvider.getMember(paramType.declaration))
          .map(it => it.node)
          .filter(it => isFunctionDeclaration(it))
          .filter(it => it.prefix === 'static')
          .filter(it => it.parameters.length === 0)
          .find(it => it.name === source.reference.$refText)
        if (!funcDecl) {
          return
        }

        return this.descriptions.createDescription(funcDecl, funcDecl.name)
      }
    },
  }
}
