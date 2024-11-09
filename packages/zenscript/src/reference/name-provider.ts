import type { AstNode, CstNode, NameProvider } from 'langium'
import type { Script, ZenScriptAstType } from '../generated/ast'
import { AstUtils, GrammarUtils } from 'langium'
import { isClassDeclaration, isScript } from '../generated/ast'
import { isImportable, isStatic, isToplevel } from '../utils/ast'
import { getName, getQualifiedName } from '../utils/document'

declare module 'langium' {
  interface NameProvider {
    getQualifiedName: (node: AstNode) => string | undefined
  }
}

type SourceMap = ZenScriptAstType
type NameRuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => string | undefined }
type NameNodeRuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => CstNode | undefined }

export class ZenScriptNameProvider implements NameProvider {
  getName(node: AstNode): string | undefined {
    // @ts-expect-error allowed index type
    return this.nameRules[node.$type]?.call(this, node)
  }

  getNameNode(node: AstNode): CstNode | undefined {
    // @ts-expect-error allowed index type
    return this.nameNodeRules[node.$type]?.call(this, node)
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
    VariableDeclaration: source => source.name,
    FunctionDeclaration: source => source.name || 'lambda function',
    ClassDeclaration: source => source.name,
    FieldDeclaration: source => source.name,
    ConstructorDeclaration: _ => 'zenConstructor',
    OperatorFunctionDeclaration: source => source.op,
    ExpandFunctionDeclaration: source => source.name,
    ValueParameter: source => source.name,
    TypeParameter: source => source.name,
    LoopParameter: source => source.name,
  }

  private readonly nameNodeRules: NameNodeRuleMap = {
    ImportDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'alias'),
    VariableDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
    FunctionDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
    ClassDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
    FieldDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
    ConstructorDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'zenConstructor'),
    OperatorFunctionDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'op'),
    ExpandFunctionDeclaration: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
    ValueParameter: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
    TypeParameter: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
    LoopParameter: source => GrammarUtils.findNodeForProperty(source.$cstNode, 'name'),
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
