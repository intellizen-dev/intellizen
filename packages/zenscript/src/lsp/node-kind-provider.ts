import type { NodeKindProvider } from 'langium/lsp'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { type AstNode, type AstNodeDescription, isAstNodeDescription } from 'langium'
import { CompletionItemKind, SymbolKind } from 'vscode-languageserver'
import { isConst } from '../utils/ast'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap<T> = { [K in keyof SourceMap]?: (source: SourceMap[K]) => T }

export class ZenScriptNodeKindProvider implements NodeKindProvider {
  getSymbolKind(node: AstNode | AstNodeDescription): SymbolKind {
    const type = isAstNodeDescription(node) ? node.type : node.$type
    const source = isAstNodeDescription(node) ? node.node : node
    // @ts-expect-error allowed index type
    return this.symbolRules[type]?.call(this, source) ?? SymbolKind.Field
  }

  getCompletionItemKind(node: AstNode | AstNodeDescription): CompletionItemKind {
    const type = isAstNodeDescription(node) ? node.type : node.$type
    const source = isAstNodeDescription(node) ? node.node : node
    // @ts-expect-error allowed index type
    return this.completionItemRules[type]?.call(this, source) ?? CompletionItemKind.Reference
  }

  private readonly symbolRules: RuleMap<SymbolKind> = {
    FunctionDeclaration: () => SymbolKind.Function,
    ClassDeclaration: () => SymbolKind.Class,
    FieldDeclaration: () => SymbolKind.Field,
    ExpandFunctionDeclaration: () => SymbolKind.Function,
    LoopParameter: () => SymbolKind.Variable,
    PackageDeclaration: () => SymbolKind.Package,
    ImportDeclaration: () => SymbolKind.Module,
    ConstructorDeclaration: () => SymbolKind.Constructor,
    OperatorFunctionDeclaration: () => SymbolKind.Operator,
    TypeParameter: () => SymbolKind.TypeParameter,
    ValueParameter: () => SymbolKind.Property,
    SyntheticHierarchyNode: () => SymbolKind.Module,
    VariableDeclaration: (node) => {
      if (isConst(node)) {
        return SymbolKind.Constant
      }
      return SymbolKind.Variable
    },
  }

  private readonly completionItemRules: RuleMap<CompletionItemKind> = {
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
    ValueParameter: () => CompletionItemKind.Property,
    SyntheticHierarchyNode: () => CompletionItemKind.Module,
    VariableDeclaration: (decl) => {
      const node = isAstNodeDescription(decl) ? decl.node : decl
      if (isConst(node)) {
        return CompletionItemKind.Constant
      }
      return CompletionItemKind.Variable
    },

  }
}
