import type { ReferenceInfo, Scope } from 'langium'
import { DefaultScopeProvider } from 'langium'
import { isMemberAccess } from '../generated/ast'
import type { TypeComputer } from '../typing/infer'
import type { IntelliZenServices } from '../module'
import type { ClassTypeDescription, ProperTypeDescription } from '../typing/description'
import { isClassTypeDesc, isProperTypeDesc } from '../typing/description'
import { getClassMembers, isStaticMember } from '../utils/ast'

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private typeComputer: TypeComputer

  constructor(services: IntelliZenServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  override getScope(context: ReferenceInfo): Scope {
    const { container } = context

    if (isMemberAccess(container)) {
      const receiver = container.receiver
      const receiverType = this.typeComputer.inferType(receiver)

      if (isClassTypeDesc(receiverType)) {
        return this.scopeInstanceMembers(receiverType)
      }
      else if (isProperTypeDesc(receiverType)) {
        return this.scopeStaticMembers(receiverType)
      }
    }

    return super.getScope(context)
  }

  private scopeInstanceMembers(classTypeDesc: ClassTypeDescription): Scope {
    const members = getClassMembers(classTypeDesc.ref?.ref).filter(m => !isStaticMember(m))
    return this.createScopeForNodes(members)
  }

  private scopeStaticMembers(properTypeDesc: ProperTypeDescription): Scope {
    const members = getClassMembers(properTypeDesc.ref?.ref).filter(m => isStaticMember(m))
    return this.createScopeForNodes(members)
  }
}
