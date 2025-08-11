import type { AstNodeDescription, LinkingError, ReferenceInfo } from 'langium'
import type { ZenScriptServices } from '../module'
import { DefaultLinker } from 'langium'
import { isImportDeclaration, isMapEntry, isNamedType, isReferenceExpression } from '../generated/ast'
import { createSyntheticAstNodeDescription } from './synthetic'

export class ZenScriptLinker extends DefaultLinker {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  override getCandidate(refInfo: ReferenceInfo): AstNodeDescription | LinkingError {
    if (isReferenceExpression(refInfo.container)) {
      const reference = refInfo.container
      if (isMapEntry(reference.$container) && reference.$containerProperty === 'key') {
        return createSyntheticAstNodeDescription(refInfo.reference.$refText, { $type: 'StringLiteral' })
      }
    }

    const scope = this.scopeProvider.getScope(refInfo)
    const description = scope.getElement(refInfo.reference.$refText)
    if (description) {
      return description
    }

    if (isImportDeclaration(refInfo.container) && refInfo.container.path.some(it => it.error)) {
      return createSyntheticAstNodeDescription(refInfo.reference.$refText, { $type: 'Unknown' })
    }

    if (isNamedType(refInfo.container) && refInfo.container.path.some(it => it.error)) {
      return createSyntheticAstNodeDescription(refInfo.reference.$refText, { $type: 'Unknown' })
    }

    return this.createLinkingError(refInfo)
  }

  override getCandidates(refInfo: ReferenceInfo): AstNodeDescription[] | LinkingError {
    // TODO: multi reference
    return this.createLinkingError(refInfo)
  }
}
