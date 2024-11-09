import type { AstNodeDescription, LinkingError, ReferenceInfo } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import { DefaultLinker } from 'langium'
import { isAnyType } from '../typing/type-description'
import { createSyntheticAstNodeDescription } from './synthetic'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: ReferenceInfo & { container: SourceMap[K] }) => AstNodeDescription | undefined }

export class ZenScriptLinker extends DefaultLinker {
  private readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
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
      const receiverType = this.typeComputer.inferType(source.container.receiver)
      if (isAnyType(receiverType)) {
        return createSyntheticAstNodeDescription('SyntheticUnknown', source.reference.$refText)
      }
    },
  }
}
