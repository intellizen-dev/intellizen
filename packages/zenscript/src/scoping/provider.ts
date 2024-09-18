import type { ReferenceInfo, Scope } from 'langium'
import { DefaultScopeProvider } from 'langium'
import { isMemberAccess } from '../generated/ast'
import type { TypeComputer } from '../typing/infer'
import type { IntelliZenServices } from '../module'
import type { ClassTypeDescription, ProperTypeDescription } from '../typing/description'
import { isClassTypeDesc, isProperTypeDesc } from '../typing/description'

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

  private scopeClassMembers(classTypeDesc: ClassTypeDescription): Scope {
    const members = this.typeComputer.getClassMembers(classTypeDesc.ref?.ref) ?? []
    return this.createScopeForNodes(members)
  }

  private scopeInstanceMembers(properTypeDesc: ProperTypeDescription): Scope {
    const members = this.typeComputer.getClassMembers(properTypeDesc.ref?.ref)
      ?.filter(it => (it as any).prefix !== 'static')
      ?? []
    return this.createScopeForNodes(members)
  }

  private scopeStaticMembers(properTypeDesc: ProperTypeDescription): Scope {
    const members = this.typeComputer.getClassMembers(properTypeDesc.ref?.ref)
      ?.filter(it => (it as any).prefix === 'static')
      ?? []
    return this.createScopeForNodes(members)
  }
}
