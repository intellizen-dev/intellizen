import type { AstNode, AstNodeDescription, LangiumDocument, PrecomputedScopes } from 'langium'
import type { Script } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptDescriptionIndex } from '../workspace/description-index'
import { DefaultScopeComputation } from 'langium'
import { isGlobal } from '../utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  private readonly descriptionIndex: ZenScriptDescriptionIndex

  constructor(services: ZenScriptServices) {
    super(services)
    this.descriptionIndex = services.workspace.DescriptionIndex
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<Script>): void {
    if (isGlobal(node)) {
      exports.push(this.descriptions.createDescription(node, undefined, document))
    }
  }

  protected override processNode(node: AstNode, document: LangiumDocument, scopes: PrecomputedScopes): void {
    const container = node.$container
    if (!container) {
      return
    }

    const name = this.nameProvider.getName(node)
    if (!name) {
      return
    }

    const uri = document.uri
    const description = this.descriptions.createDescriptionWithUri(node, uri, name)
    this.descriptionIndex.astDescriptions.set(node, description)
    scopes.add(container, description)
  }
}
