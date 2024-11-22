import type { AstNode, CstNode } from 'langium'
import type { Script, ZenScriptAstType } from '../generated/ast'
import { AstUtils, DefaultNameProvider, GrammarUtils } from 'langium'
import { isClassDeclaration, isScript } from '../generated/ast'
import { isImportable, isStatic, isToplevel } from '../utils/ast'
import { getName, getQualifiedName } from '../utils/document'
import { defineRules } from '../utils/rule'

declare module 'langium' {
  interface NameProvider {
    getQualifiedName: (node: AstNode) => string | undefined
  }
}

type SourceMap = ZenScriptAstType
type NameRuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => string | undefined }
type NameNodeRuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => CstNode | undefined }

export class ZenScriptNameProvider extends DefaultNameProvider {
  getName(node: AstNode): string | undefined {
    return this.nameRules(node.$type).call(node)
  }

  getNameNode(node: AstNode): CstNode | undefined {
    return this.nameNodeRules(node.$type).call(node)
  }

  getQualifiedName(node: AstNode): string | undefined {
    const document = AstUtils.getDocument<Script>(node)
    if (!document) {
      return
    }

    if (isScript(node)) {
      return getQualifiedName(document)
    }
    else if (isToplevel(node) && isImportable(node)) {
      return concat(getQualifiedName(document), this.getName(node))
    }
    else if (isClassDeclaration(node.$container) && isStatic(node)) {
      return concat(this.getQualifiedName(node.$container!), this.getName(node))
    }
  }

  private readonly nameRules = defineRules<NameRuleMap>(this, {
    Script: source => source.$document ? getName(source.$document) : undefined,
    ImportDeclaration: source => source.alias || source.path.at(-1)?.$refText,
    FunctionDeclaration: source => source.name || 'lambda function',
    ConstructorDeclaration: _ => 'zenConstructor',
    OperatorFunctionDeclaration: source => source.op,
  }, source => super.getName(source))

  private readonly nameNodeRules = defineRules<NameNodeRuleMap>(this, {
    ImportDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'alias'),
    ConstructorDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'zenConstructor'),
    OperatorFunctionDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'op'),
  }, source => super.getNameNode(source))
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
