import type { AstNode, ReferenceInfo, Scope } from 'langium'
import { DefaultScopeProvider, EMPTY_SCOPE } from 'langium'
import { isClassDeclaration, isMemberAccess, isScript } from '../generated/ast'
import type { TypeComputer } from '../typing/infer'
import type { IntelliZenServices } from '../module'
import type { ClassTypeDescription, PackageTypeDescription, ProperTypeDescription, TypeDescription } from '../typing/description'
import { isClassTypeDesc, isPackageTypeDesc, isProperTypeDesc } from '../typing/description'
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

      if (isPackageTypeDesc(receiverType)) {
        return this.handlePackageTypeRef(receiverType)
      }
      else {
        return this.handleTypeDescScope(receiverType)
      }
    }

    return super.getScope(context)
  }

  private handlePackageTypeRef(packageTypeDesc: PackageTypeDescription): Scope {
    const element = this.indexManager.allElements().find((it) => {
      const qName = this.nameProvider.getQualifiedName(it.node!)
      return packageTypeDesc.packageName === qName
    })?.node

    if (!element)
      return EMPTY_SCOPE

    const members: AstNode[] = []
    if (isScript(element)) {
      element.classes.forEach(it => members.push(it))
      element.functions.forEach(it => members.push(it))
      element.statements.forEach(it => members.push(it))
    }
    else if (isClassDeclaration(element)) {
      element.members.forEach(it => members.push(it))
    }

    return this.createScopeForNodes(members)
  }

  private handleTypeDescScope(type?: TypeDescription): Scope {
    if (isClassTypeDesc(type)) {
      return this.scopeInstanceMembers(type)
    }
    else if (isProperTypeDesc(type)) {
      return this.scopeStaticMembers(type)
    }
    return EMPTY_SCOPE
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
