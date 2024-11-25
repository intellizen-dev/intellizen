import type { AstNode, AstNodeDescription, LangiumDocument, PrecomputedScopes } from 'langium'
import type { Script } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { DescriptionCreator } from '../workspace/description-creator'
import type { ZenScriptDescriptionIndex } from '../workspace/description-index'
import { DefaultScopeComputation } from 'langium'
import { isGlobal } from '../utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  private readonly index: ZenScriptDescriptionIndex
  private readonly creator: DescriptionCreator

  constructor(services: ZenScriptServices) {
    super(services)
    this.index = services.workspace.DescriptionIndex
    this.creator = services.workspace.AstNodeDescriptionProvider
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<Script>): void {
    if (isGlobal(node)) {
      const description = this.creator.createDescriptionWithUri(node, document.uri)
      this.index.astDescriptions.set(node, description)
      exports.push(this.index.getDescription(node))
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

    const description = this.creator.createDescriptionWithUri(node, document.uri, name)
    this.index.astDescriptions.set(node, description)
    scopes.add(container, description)
  }
}
