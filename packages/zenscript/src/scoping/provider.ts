import type { ReferenceInfo, Scope } from 'langium'
import { DefaultScopeProvider } from 'langium'
import type { ClassDeclaration, ClassMemberDeclaration } from '../generated/ast'
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

  private scopeInstanceMembers(properTypeDesc: ClassTypeDescription): Scope {
    const members = this.handleClassMembers(properTypeDesc.ref?.ref).filter(m => !this.isStaticMember(m))
    return this.createScopeForNodes(members)
  }

  private scopeStaticMembers(properTypeDesc: ProperTypeDescription): Scope {
    const members = this.handleClassMembers(properTypeDesc.ref?.ref).filter(m => this.isStaticMember(m))
    return this.createScopeForNodes(members)
  }

  private handleClassMembers(clazz?: ClassDeclaration) {
    return this.typeComputer.getClassChain(clazz).flatMap(c => c.members)
  }

  private isStaticMember(member: ClassMemberDeclaration) {
    return member.$type !== 'ConstructorDeclaration' && member.prefix === 'static'
  }
}
