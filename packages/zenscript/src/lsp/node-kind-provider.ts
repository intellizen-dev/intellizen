import type { AstNode, AstNodeDescription } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { DefaultNodeKindProvider } from 'langium/lsp'
import { CompletionItemKind, SymbolKind } from 'vscode-languageserver'
import { toAstNode } from '../utils/ast'
import { isNamespaceNode } from '../utils/namespace-tree'
import { defineRules } from '../utils/rule'

type RuleSpec = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap<R> = { [K in keyof RuleSpec]?: (element: RuleSpec[K]) => R }

export class ZenScriptNodeKindProvider extends DefaultNodeKindProvider {
  override getSymbolKind(node: AstNode | AstNodeDescription): SymbolKind {
    const element = toAstNode(node)
    return this.symbolKindRules(element?.$type)?.call(this, element) ?? super.getSymbolKind(node)
  }

  private readonly symbolKindRules = defineRules<RuleMap<SymbolKind>>({
    FunctionDeclaration: () => SymbolKind.Function,
    ClassDeclaration: () => SymbolKind.Class,
    FieldDeclaration: () => SymbolKind.Field,
    ExpandFunctionDeclaration: () => SymbolKind.Function,
    LoopParameter: () => SymbolKind.Variable,
    PackageDeclaration: () => SymbolKind.Module,
    ImportDeclaration: () => SymbolKind.Module,
    ConstructorDeclaration: () => SymbolKind.Constructor,
    OperatorFunctionDeclaration: () => SymbolKind.Operator,
    TypeParameter: () => SymbolKind.TypeParameter,
    ValueParameter: () => SymbolKind.Variable,
    VariableDeclaration: () => SymbolKind.Variable,
    SyntheticAstNode: ({ content }) => {
      if (isNamespaceNode(content)) {
        return SymbolKind.Module
      }
      else if (content.$type === 'Unknown') {
        return SymbolKind.Variable
      }
      else if (content.$type === 'StringLiteral') {
        return SymbolKind.String
      }
      else {
        return SymbolKind.Variable
      }
    },
  })

  override getCompletionItemKind(node: AstNode | AstNodeDescription): CompletionItemKind {
    const element = toAstNode(node)
    return this.completionItemRules(element?.$type)?.call(this, element) ?? super.getCompletionItemKind(node)
  }

  private readonly completionItemRules = defineRules<RuleMap<CompletionItemKind>>({
    FunctionDeclaration: () => CompletionItemKind.Function,
    ClassDeclaration: () => CompletionItemKind.Class,
    FieldDeclaration: () => CompletionItemKind.Field,
    ExpandFunctionDeclaration: () => CompletionItemKind.Function,
    LoopParameter: () => CompletionItemKind.Variable,
    PackageDeclaration: () => CompletionItemKind.Module,
    ImportDeclaration: () => CompletionItemKind.Module,
    ConstructorDeclaration: () => CompletionItemKind.Constructor,
    OperatorFunctionDeclaration: () => CompletionItemKind.Operator,
    TypeParameter: () => CompletionItemKind.TypeParameter,
    ValueParameter: () => CompletionItemKind.Variable,
    VariableDeclaration: () => CompletionItemKind.Variable,
    SyntheticAstNode: ({ content }) => {
      if (isNamespaceNode(content)) {
        return CompletionItemKind.Module
      }
      else if (content.$type === 'Unknown') {
        return CompletionItemKind.Variable
      }
      else if (content.$type === 'StringLiteral') {
        return CompletionItemKind.Value
      }
      else {
        return CompletionItemKind.Variable
      }
    },
  })
}
