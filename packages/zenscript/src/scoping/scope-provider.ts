import type { AstNodeDescription, ReferenceInfo, Scope } from 'langium'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, EMPTY_STREAM, URI, isNamed } from 'langium'
import type { ClassTypeReference, ImportDeclaration, ZenScriptAstType } from '../generated/ast'
import { isClassTypeReference, isImportDeclaration, isLocalVariable, isMemberAccess, isScript, isStatement } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { getPathAsString } from '../utils/ast'
import type { PackageManager } from '../workspace/package-manager'
import type { MemberProvider } from './member-provider'

type SourceKey = keyof ZenScriptAstType
type Produce = (source: ReferenceInfo) => Scope
type Rule = <K extends SourceKey>(match: K, produce: Produce) => void

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly rules: Map<SourceKey, Produce>

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.rules = new Map()
  }

  private initRules() {
    const rule: Rule = (match, produce) => {
      if (this.rules.has(match)) {
        throw new Error(`Rule "${match}" is already defined.`)
      }
      this.rules.set(match, produce)
    }

    rule('LocalVariable', (source) => {
      return this.scopeLocalVariable(source)
    })
  }

  override getScope(context: ReferenceInfo): Scope {
    const { container } = context

    if (isImportDeclaration(container)) {
      return this.scopeImportDeclaration(context)
    }

    if (isClassTypeReference(container)) {
      return this.scopeClassTypeReference(context)
    }

    if (isLocalVariable(container)) {
      return this.scopeLocalVariable(context)
    }

    if (isMemberAccess(container)) {
      const members = this.memberProvider.getMember(container.receiver)
      return this.createScope(members)
    }

    return super.getScope(context)
  }

  private scopeLocalVariable(context: ReferenceInfo): Scope {
    const script = AstUtils.getContainerOfType(context.container, isScript)!
    const scriptImports = script.imports.map(it => this.descriptions.createDescription(it, undefined))
    const scriptStatics = this.memberProvider.getMember(script)
    const block = AstUtils.getContainerOfType(context.container, isStatement)?.$container
    let locals = EMPTY_STREAM
    if (block) {
      locals = AstUtils.streamContents(block)
        .filter(isStatement)
        .filter(isNamed)
        .map(it => this.descriptions.createDescription(it, undefined))
    }

    let scope = this.createScope(scriptImports)
    scope = this.createScope(scriptStatics, scope)
    scope = this.createScope(locals, scope)
    return scope
  }

  private scopeImportDeclaration(context: ReferenceInfo): Scope {
    const importDecl = context.container as ImportDeclaration
    const path = getPathAsString(importDecl, context)
    const siblings = this.packageManager.getHierarchyNode(path)?.children.values()
    if (!siblings) {
      return EMPTY_SCOPE
    }

    const elements: AstNodeDescription[] = []
    for (const sibling of siblings) {
      if (sibling.value) {
        elements.push(this.descriptions.createDescription(sibling.value, sibling.name))
      }
      else {
        // TODO: temporary, needs to be reimplemented
        elements.push({
          type: 'package',
          name: sibling.name,
          documentUri: URI.file('file:///path/to/package'),
          path: '',
        })
      }
    }

    return this.createScope(elements)
  }

  private scopeClassTypeReference(context: ReferenceInfo): Scope {
    const classTypeRef = context.container as ClassTypeReference

    if (context.index === 0) {
      const script = AstUtils.getContainerOfType(classTypeRef, isScript)
      if (!script) {
        return EMPTY_SCOPE
      }
      const imports = script.imports
        .map((it) => {
          const desc = it.path[it.path.length - 1]?.$nodeDescription
          if (desc && it.alias) {
            desc.name = it.alias
          }
          return desc
        })
        .filter(it => !!it)

      const scriptStatic = script.classes.map(it => this.descriptions.createDescription(it, it.name))
      let scope = this.createScope(imports)
      scope = this.createScope(scriptStatic, scope)

      return scope
    }
    else if (context.index !== undefined) {
      const prev = classTypeRef.path[context.index - 1].ref
      const members = this.memberProvider.getMember(prev)
      return this.createScope(members)
    }
    else {
      return EMPTY_SCOPE
    }
  }
}
