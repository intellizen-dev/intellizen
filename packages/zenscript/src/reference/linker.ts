import type { AstNode, AstNodeDescription, LangiumDocument, LinkingError, Reference, ReferenceInfo } from 'langium'
import type { ZenScriptServices } from '../module'
import { DefaultLinker } from 'langium'
import { isImportDeclaration, isNamedTypeReference } from '../generated/ast'
import { createUnknownAstDescription } from './synthetic'

declare module 'langium' {
  interface Linker {
    relink: (document: LangiumDocument, changedUris: Set<string>) => void
  }
}

export class ZenScriptLinker extends DefaultLinker {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  override getCandidate(refInfo: ReferenceInfo): AstNodeDescription | LinkingError {
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

  relink(document: LangiumDocument, changedUris: Set<string>) {
    for (const ref of document.references) {
      const targetUri = ref?.$nodeDescription?.documentUri.toString()
      if (targetUri && changedUris.has(targetUri)) {
        this.reset(ref)
      }
    }
  }

  reset(ref: DefaultReference) {
    delete ref._ref
  }
}

interface DefaultReference extends Reference {
  _ref?: AstNode
  _nodeDescription?: AstNodeDescription
}
