import type { AstNodeDescription, LinkingError, ReferenceInfo } from 'langium'
import type { ZenScriptServices } from '../module'
import { DefaultLinker } from 'langium'
import { isImportDeclaration, isMapEntry, isNamedTypeReference, isReferenceExpression } from '../generated/ast'
import { createStringLiteralAstDescription, createUnknownAstDescription } from './synthetic'

export class ZenScriptLinker extends DefaultLinker {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  override getCandidate(refInfo: ReferenceInfo): AstNodeDescription | LinkingError {
    if (isReferenceExpression(refInfo.container)) {
      const reference = refInfo.container
      if (isMapEntry(reference.$container) && reference.$containerProperty === 'key') {
        return createStringLiteralAstDescription(refInfo.reference.$refText)
      }
    }

    const scope = this.scopeProvider.getScope(refInfo)
    const description = scope.getElement(refInfo.reference.$refText)
    if (description) {
      return description
    }

    if (isImportDeclaration(refInfo.container) && refInfo.container.path.some(it => it.error)) {
      return createUnknownAstDescription(refInfo.reference.$refText)
    }

    if (isNamedTypeReference(refInfo.container) && refInfo.container.path.some(it => it.error)) {
      return createUnknownAstDescription(refInfo.reference.$refText)
    }

    return this.createLinkingError(refInfo)
  }
}
