import type { AstNodeDescription } from 'langium'
import type { CompletionProviderOptions, CompletionValueItem } from 'langium/lsp'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { DefaultCompletionProvider } from 'langium/lsp'
import { getPrettyDeclarationText } from '../utils/ast'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap<T> = { [K in keyof SourceMap]?: (source: SourceMap[K], desc: AstNodeDescription) => T }

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
  }

  protected override createReferenceCompletionItem(nodeDescription: AstNodeDescription): CompletionValueItem {
    const item = super.createReferenceCompletionItem(nodeDescription)

    // Add additional properties to the completion item
    // @ts-expect-error allowed index type
    const detail = this.detailRules[nodeDescription.type]?.call(this, nodeDescription.node, nodeDescription)
    if (detail) {
      item.detail = detail
    }

    return item
  }

  private readonly detailRules: RuleMap<string> = {
    FunctionDeclaration: (_, desc) => {
      return `(method) ${getPrettyDeclarationText(desc)}`
    },

    ClassDeclaration: (_, desc) => {
      return `(class) ${getPrettyDeclarationText(desc)}`
    },

    ImportDeclaration: (_, desc) => {
      return `(module) ${getPrettyDeclarationText(desc)}`
    },

    VariableDeclaration: (_, desc) => {
      return `(variable) ${getPrettyDeclarationText(desc)}`
    },

    ValueParameter: (_, desc) => {
      return `(parameter) ${getPrettyDeclarationText(desc)}`
    },

    SyntheticHierarchyNode: (_, desc) => {
      return `(module) ${getPrettyDeclarationText(desc)}`
    },

    FieldDeclaration: (_, desc) => {
      return `(field) ${getPrettyDeclarationText(desc)}`
    },
  }
}
