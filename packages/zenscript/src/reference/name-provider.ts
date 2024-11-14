import type { AstNode, CstNode } from 'langium'
import type { Script, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { AstUtils, DefaultNameProvider, GrammarUtils } from 'langium'
import { isClassDeclaration, isScript } from '../generated/ast'
import { isImportable, isStatic, isToplevel } from '../utils/ast'
import { getAstCache, ZenScriptDocumentCache } from '../utils/cache'
import { getName, getQualifiedName } from '../utils/document'

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
    // @ts-expect-error allowed index type
    return (this.nameRules[node.$type] ?? super.getName).call(this, node)
  }

  getNameNode(node: AstNode): CstNode | undefined {
    // @ts-expect-error allowed index type
    return (this.nameNodeRules[node.$type] ?? super.getNameNode).call(this, node)
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

  private readonly nameRules: NameRuleMap = {
    Script: source => source.$document ? getName(source.$document) : undefined,
    ImportDeclaration: source => source.alias || source.path.at(-1)?.$refText,
    FunctionDeclaration: source => source.name || 'lambda function',
    ConstructorDeclaration: _ => 'zenConstructor',
    OperatorFunctionDeclaration: source => source.op,
  }

  private readonly nameNodeRules: NameNodeRuleMap = {
    ImportDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'alias'),
    ConstructorDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'zenConstructor'),
    OperatorFunctionDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'op'),
  }
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
