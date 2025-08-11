import type { AstNode, CstNode } from 'langium'
import type { Script, ZenScriptAstType } from '../generated/ast'
import { AstUtils, DefaultNameProvider, GrammarUtils } from 'langium'
import { isClassDeclaration, isScript } from '../generated/ast'
import { isExposed, isStatic, isToplevel } from '../utils/ast'
import { getName, getQualifiedName } from '../utils/document'
import { defineRules } from '../utils/rule'

declare module 'langium' {
  interface NameProvider {
    getQualifiedName: (node: AstNode) => string | undefined
  }
}

type RuleSpec = ZenScriptAstType
type RuleMap<R> = { [K in keyof RuleSpec]?: (element: RuleSpec[K]) => R | undefined }

export class ZenScriptNameProvider extends DefaultNameProvider {
  getName(node: AstNode): string | undefined {
    return this.nameRules(node.$type)?.call(this, node) ?? super.getName(node)
  }

  getNameNode(node: AstNode): CstNode | undefined {
    return this.nameNodeRules(node.$type)?.call(this, node) ?? super.getNameNode(node)
  }

  getQualifiedName(node: AstNode): string | undefined {
    const document = AstUtils.getDocument<Script>(node)
    if (!document) {
      return
    }

    if (isScript(node)) {
      return getQualifiedName(document)
    }
    else if (isToplevel(node) && isExposed(node)) {
      return concat(getQualifiedName(document), this.getName(node))
    }
    else if (isClassDeclaration(node.$container) && isStatic(node)) {
      return concat(this.getQualifiedName(node.$container!), this.getName(node))
    }
  }

  private readonly nameRules = defineRules<RuleMap<string>>({
    Script: element => element.$document ? getName(element.$document) : undefined,
    ImportDeclaration: element => element.alias || element.path.at(-1)?.$refText,
    FunctionDeclaration: element => element.name || 'lambda function',
    ConstructorDeclaration: element => element.$container.name,
    OperatorFunctionDeclaration: element => element.operator,
  })

  private readonly nameNodeRules = defineRules<RuleMap<CstNode>>({
    ImportDeclaration: element => GrammarUtils.findNodeForProperty(element.$cstNode, 'alias'),
    ConstructorDeclaration: element => GrammarUtils.findNodeForKeyword(element.$cstNode, 'zenConstructor'),
    OperatorFunctionDeclaration: element => GrammarUtils.findNodeForProperty(element.$cstNode, 'operator'),
  })
}

function concat(qualifiedName: string | undefined, name: string | undefined): string | undefined {
  if (qualifiedName === undefined || name === undefined) {
    return
  }
  if (qualifiedName === '') {
    return name
  }
  return [...qualifiedName.split('.'), name].join('.')
}
