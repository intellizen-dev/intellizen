import type { AstNodeDescription, ReferenceInfo, Scope } from 'langium'
import { AstUtils, DefaultScopeProvider, EMPTY_SCOPE, URI, stream } from 'langium'
import { substringBeforeLast } from '@intellizen/shared'
import type { ClassTypeReference, ImportDeclaration, MemberAccess, ZenScriptAstType } from '../generated/ast'
import { ClassDeclaration, isClassDeclaration, isScript } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { getPathAsString } from '../utils/ast'
import type { PackageManager } from '../workspace/package-manager'
import type { MemberProvider } from './member-provider'

type SourceKey = keyof ZenScriptAstType
type Produce = (source: ReferenceInfo) => Scope
type Rule = <K extends SourceKey>(match: K, produce: Produce) => void
type RuleMap = Map<SourceKey, Produce>

const builtin: AstNodeDescription[] = ['any', 'byte', 'short', 'int', 'long', 'float', 'double', 'bool', 'void', 'string']
  .map(name => ({
    type: ClassDeclaration,
    name,
    documentUri: URI.from({ scheme: 'intellizen', path: `/builtin/${name}` }),
    path: '',
  }))

export class ZenScriptScopeProvider extends DefaultScopeProvider {
  private readonly packageManager: PackageManager
  private readonly memberProvider: MemberProvider
  private readonly rules: RuleMap

  override getScope(context: ReferenceInfo): Scope {
    const match = context.container.$type as SourceKey
    return this.rules.get(match)?.call(this, context) ?? EMPTY_SCOPE
  }

  constructor(services: ZenScriptServices) {
    super(services)
    this.packageManager = services.workspace.PackageManager
    this.memberProvider = services.references.MemberProvider
    this.rules = this.initRules()
  }

  private initRules(): RuleMap {
    const rules: RuleMap = new Map()
    const rule: Rule = (match, produce) => {
      if (rules.has(match)) {
        throw new Error(`Rule "${match}" is already defined.`)
      }
      rules.set(match, produce)
    }

    rule('ImportDeclaration', (source) => {
      const importDecl = source.container as ImportDeclaration
      const path = getPathAsString(importDecl, source.index)
      const parentPath = substringBeforeLast(path, '.')
      const siblings = this.packageManager.getHierarchyNode(parentPath)?.children.values()
      if (!siblings) {
        return EMPTY_SCOPE
      }

      const elements: AstNodeDescription[] = []
      for (const sibling of siblings) {
        if (sibling.values?.length) {
          sibling.values.forEach(it => elements.push(this.descriptions.createDescription(it, sibling.name)))
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
    })

    rule('ReferenceExpression', (source) => {
      return super.getScope(source)
    })

    rule('MemberAccess', (source) => {
      const container = source.container as MemberAccess
      const members = this.memberProvider.getMember(container.receiver)
      return this.createScope(members)
    })

    rule('ClassTypeReference', (source) => {
      const container = source.container as ClassTypeReference
      if (source.index === 0 || source.index === undefined) {
        const script = AstUtils.getContainerOfType(container, isScript)
        if (!script) {
          return EMPTY_SCOPE
        }

        const globals = stream(this.packageManager.getHierarchyNode('')!.children.values())
          .flatMap(it => it.values)
          .filter(it => isClassDeclaration(it))
          .map(it => this.descriptions.createDescription(it, it.name))

        const imports = script.imports
          .map((importDecl) => {
            const ref = importDecl.path.at(-1)?.ref ?? importDecl
            return this.descriptions.createDescription(ref, this.nameProvider.getName(importDecl))
          })
          .filter(it => !!it)

        const locals = script.classes
          .map(it => this.descriptions.createDescription(it, it.name))

        let scope = this.createScope(builtin)
        scope = this.createScope(globals, scope)
        scope = this.createScope(imports, scope)
        scope = this.createScope(locals, scope)
        return scope
      }
      else {
        const prev = container.path[source.index - 1].ref
        const members = this.memberProvider.getMember(prev)
        return this.createScope(members)
      }
    })

    return rules
  }
}
