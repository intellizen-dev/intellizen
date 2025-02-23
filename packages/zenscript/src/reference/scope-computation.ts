import type { AstNode, AstNodeDescription, LangiumDocument, PrecomputedScopes } from 'langium'
import type { Script } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { DescriptionCache } from '../workspace/description-cache'
import type { DescriptionCreator } from '../workspace/description-creator'
import { DefaultScopeComputation } from 'langium'
import { isGlobal } from '../utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  private readonly creator: DescriptionCreator
  private readonly cache: DescriptionCache

  constructor(services: ZenScriptServices) {
    super(services)
    this.creator = services.workspace.AstNodeDescriptionProvider
    this.cache = services.shared.workspace.DescriptionCache
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<Script>): void {
    if (isGlobal(node)) {
      const description = this.creator.createDescriptionWithUri(node, document.uri)
      this.cache.astDescriptions.set(node, description)
      exports.push(description)
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
    this.cache.astDescriptions.set(node, description)
    scopes.add(container, description)
  }
}
