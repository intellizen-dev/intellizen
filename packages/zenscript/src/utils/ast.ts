import type { AstNode, AstNodeDescription } from 'langium'
import type { BracketExpression, ClassDeclaration, ImportDeclaration, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { AstUtils } from 'langium'
import { isBracketExpression, isClassDeclaration, isFunctionDeclaration, isImportDeclaration, isScript } from '../generated/ast'
import { isZs } from './document'

export function isToplevel(node: AstNode | undefined): boolean {
  return isScript(node?.$container)
}

export function getClassChain(clazz?: ClassDeclaration): ClassDeclaration[] {
  if (!clazz) {
    return []
  }
  if (!clazz.superTypes) {
    return [clazz]
  }

  const set = new Set<ClassDeclaration>()
  set.add(clazz)
  clazz.superTypes
    .map(it => it.path.at(-1)?.ref)
    .filter(it => isClassDeclaration(it))
    .flatMap(it => getClassChain(it))
    .forEach(it => set.add(it))
  return Array.from(set)
}

export function isStatic(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'static'
}

export function isGlobal(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'global'
}

export function isConst(node: AstNode | undefined) {
  return node && 'prefix' in node && node.prefix === 'val'
}

export function isImportable(node: AstNode | undefined) {
  if (isScript(node)) {
    return isZs(AstUtils.getDocument(node))
  }
  else if (isToplevel(node) && isFunctionDeclaration(node)) {
    return true
  }
  else {
    return isStatic(node) || isClassDeclaration(node)
  }
}

export function getPathAsString(importDecl: ImportDeclaration, index?: number): string
export function getPathAsString(bracket: BracketExpression): string
export function getPathAsString(astNode: ImportDeclaration | BracketExpression, index?: number): string {
  if (isImportDeclaration(astNode)) {
    let names = astNode.path.map(it => it.$refText)
    if (index !== undefined) {
      names = names.slice(0, index + 1)
    }
    return names.join('.')
  }
  else if (isBracketExpression(astNode)) {
    return astNode.path.map(it => it?.$cstNode?.text).join(':')
  }
  else {
    throw new Error(`Illegal argument: ${astNode}`)
  }
}

export function getPrettyDeclarationText(decl: AstNodeDescription) {
  type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
  type RuleMap<T> = { [K in keyof SourceMap]?: (source: SourceMap[K], name: string) => T }

  const rules: RuleMap<string> = {
    ClassDeclaration: (source, name) => {
      if (!source) {
        return `zenClass ${name}`
      }
      const typeParams = source.typeParameters?.map(it => it.name).join(', ') || ''
      const superTypes = source.superTypes?.map(it => it.path.at(-1)?.$refText).join(', ') || ''
      return `zenClass ${name}${typeParams ? `<${typeParams}>` : ''}${superTypes ? ` extends ${superTypes}` : ''}`
    },
    FunctionDeclaration: (source, name) => {
      if (!source) {
        return `function ${name}(...)`
      }
      const func = source
      const clazz = func.$container
      let prefix = 'function '
      if (isClassDeclaration(clazz)) {
        const typeParams = clazz.typeParameters?.map(it => it.name).join(', ') || ''
        prefix = `${clazz.name}${typeParams}.`
      }

      const params = func.parameters.map((it) => {
        if (it.typeRef && it.typeRef.$cstNode) {
          return `${it.name} as ${it.typeRef.$cstNode.text}`
        }
        return it.name
      }).join(', ')

      return `${prefix}${func.name}(${params})`
    },

    ImportDeclaration: (source, name) => {
      if (!source) {
        return `import ... as ${name}`
      }
      const alias = source.alias ? ` as ${source.alias}` : ''
      return `import ${getPathAsString(source)}${alias}`
    },
    VariableDeclaration: (source, name) => {
      if (!source) {
        return `var ${name}`
      }
      const type = source.typeRef?.$cstNode ? ` as ${source.typeRef.$cstNode.text}` : ''
      const initText = source.initializer ? ` = ...` : ''
      const prefix = source.prefix ? `${source.prefix} ` : ''
      return `${prefix}${name}${type}${initText}`
    },

    ValueParameter: (source, name) => {
      if (!source) {
        return `${name}`
      }
      const type = source.typeRef?.$cstNode ? ` as ${source.typeRef.$cstNode.text}` : ''
      return `${name}${type}`
    },

    FieldDeclaration: (source, name) => {
      if (!source) {
        return `var ${name}`
      }
      const type = source.typeRef?.$cstNode ? ` as ${source.typeRef.$cstNode.text}` : ''
      const initText = source.initializer ? ` = ...` : ''
      const prefix = source.prefix ? `${source.prefix} ` : ''
      return `${prefix}${name}${type}${initText}`
    },

    SyntheticHierarchyNode: (source, name) => {
      if (!source) {
        return `pacakge ${name}`
      }
      const qualifiedName = [source.name]
      let parent = source.parent
      while (parent) {
        if (parent.name) {
          qualifiedName.unshift(parent.name)
        }
        parent = parent.parent
      }
      return `package ${qualifiedName.join('.')}`
    },
  }

  // @ts-expect-error allowed index type
  return rules[decl.type]?.(decl.node, decl.name) ?? decl.type
}
