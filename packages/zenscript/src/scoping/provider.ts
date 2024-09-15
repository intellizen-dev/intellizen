import type { ReferenceInfo, Scope } from 'langium'
import { DefaultScopeProvider } from 'langium'
import { isMemberAccess } from '../generated/ast'
import type { TypeComputer } from '../typing/infer'
import type { IntelliZenServices } from '../module'
import type { ClassTypeDescription } from '../typing/description'
import { isClassTypeDesc } from '../typing/description'

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private typeComputer: TypeComputer

  constructor(services: IntelliZenServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  override getScope(context: ReferenceInfo): Scope {
    // member access
    const node = context.container
    if (isMemberAccess(node)) {
      const receiver = node.receiver
      const receiverType = this.typeComputer.inferType(receiver)

      if (isClassTypeDesc(receiverType)) {
        return this.scopeClassMembers(receiverType)
      }
    }

    return super.getScope(context)
  }

  private scopeClassMembers(classTypeDesc: ClassTypeDescription): Scope {
    const members = classTypeDesc.ref?.ref?.members ?? []
    // TODO: get parent class members
    return this.createScopeForNodes(members)
  }
}
