import type { AstNodeDescription } from 'langium'
import type { CompletionProviderOptions, CompletionValueItem } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { DefaultCompletionProvider } from 'langium/lsp'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K], name: string) => CompletionItemLabelDetails | undefined }

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
    const details = this.rules[nodeDescription.type]?.call(this, nodeDescription.node, nodeDescription.name)
    if (details) {
      item.labelDetails = details
    }
    item.detail = undefined

    return item
  }

  private readonly rules: RuleMap = {
    ClassDeclaration: (source, _) => {
      const packageName = this.nameProvider.getQualifiedName(source.$container)
      if (!packageName) {
        return
      }
      return {
        detail: `(${packageName})`,
      }
    },
    FunctionDeclaration: (source, _) => {
      if (!source) {
        return
      }
      const func = source

      const params = func.parameters.map((it) => {
        if (it.typeRef && it.typeRef.$cstNode) {
          return `${it.name} as ${it.typeRef.$cstNode.text}`
        }
        return it.name
      }).join(', ')

      const retType = func.returnTypeRef?.$cstNode?.text

      return {
        detail: `(${params})`,
        description: retType,
      }
    },

    ImportDeclaration: (source, _) => {
      if (!source) {
        return
      }
      return {
        detail: `(${source.path.slice(0, -1).map(it => it.$refText).join('.')})`,
      }
    },
    VariableDeclaration: (source, _) => {
      if (!source) {
        return
      }
      const type = source.typeRef?.$cstNode?.text

      return {
        description: `${type}`,
      }
    },

    ValueParameter: (source, _) => {
      if (!source) {
        return
      }
      const type = source.typeRef?.$cstNode?.text
      return {
        description: `${type}`,
      }
    },

    FieldDeclaration: (source, _) => {
      if (!source) {
        return
      }

      const type = source.typeRef?.$cstNode?.text
      return {
        description: `${type}`,
      }
    },

    SyntheticHierarchyNode: (source, name) => {
      if (!source) {
        return
      }
      const qualifiedName = [name]
      let parent = source.parent
      while (parent) {
        if (parent.name) {
          qualifiedName.unshift(parent.name)
        }
        parent = parent.parent
      }

      if (qualifiedName.length > 1) {
        return {
          detail: `(${qualifiedName.join('.')})`,
        }
      }
    },
  }
}
