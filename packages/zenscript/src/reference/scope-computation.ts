import type { AstNode, AstNodeDescription, LangiumDocument } from 'langium'
import type { Script } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { DefaultScopeComputation } from 'langium'
import { isGlobal } from '../utils/ast'

export class ZenScriptScopeComputation extends DefaultScopeComputation {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<Script>): void {
    if (isGlobal(node)) {
      exports.push(this.descriptions.createDescription(node, undefined, document))
    }
  }
}
