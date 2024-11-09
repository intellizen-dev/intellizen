import type { AstNodeDescription, AstNodeDescriptionProvider, LinkingError, ReferenceInfo } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { MemberProvider } from './member-provider'
import { DefaultLinker, stream } from 'langium'
import { isOperatorFunctionDeclaration } from '../generated/ast'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => AstNodeDescription | undefined }

export class ZenScriptLinker extends DefaultLinker {
  private readonly memberProvider: MemberProvider
  private readonly descriptions: AstNodeDescriptionProvider

  constructor(services: ZenScriptServices) {
    super(services)
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
    return this.rules[refInfo.container.$type]?.call(this, refInfo)
  }

  private readonly rules: RuleMap = {
    MemberAccess: (source) => {
      return stream(this.memberProvider.getMember(source.container.receiver))
        .map(it => it.node)
        .filter(isOperatorFunctionDeclaration)
        .filter(it => it.op === '.')
        .map(it => this.descriptions.createDescription(it.parameters[0], undefined))
        .head()
    },
  }
}
