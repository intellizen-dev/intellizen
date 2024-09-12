import type { ReferenceInfo, Scope } from 'langium'
import { DefaultScopeProvider } from 'langium'
import { isMemberAccess } from '../generated/ast'
import type { TypeInferrer } from '../typing/infer'
import type { IntelliZenServices } from '../module'
import type { ClassTypeDescription } from '../typing/description'
import { isClassTypeDesc } from '../typing/description'

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private typeInferer: TypeInferrer
  constructor(services: IntelliZenServices) {
    super(services)
    this.typeInferer = services.typing.TypeInferrer
  }

  override getScope(context: ReferenceInfo): Scope {
    // member access
    const node = context.container
    if (isMemberAccess(node)) {
      const receiver = node.receiver
      const receiverType = this.typeInferer.inferExpressionType(receiver)

      if (isClassTypeDesc(receiverType)) {
        return this.scopeClassMembers(receiverType)
      }
    }

    return super.getScope(context)
  }

  private scopeClassMembers(classTypeDesc: ClassTypeDescription): Scope {
    const members = classTypeDesc.getMembers()
    // TODO: get parent class members
    return this.createScopeForNodes(members)
  }
}
