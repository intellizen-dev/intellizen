import type { AstNodeDescription } from 'langium'
import type { CompletionProviderOptions, CompletionValueItem } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { DefaultCompletionProvider } from 'langium/lsp'
import { toAstNode } from '../utils/ast'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap<R> = { [K in keyof SourceMap]?: (source: SourceMap[K], name: string) => R | undefined }

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
  }

  protected override createReferenceCompletionItem(nodeDescription: AstNodeDescription): CompletionValueItem {
    const source = toAstNode(nodeDescription)
    // @ts-expect-error allowed index type
    const labelDetails = this.labelDetailRules[source.$type]?.call(this, source)
    const kind = this.nodeKindProvider.getCompletionItemKind(nodeDescription)

    return {
      nodeDescription,
      kind,
      labelDetails,
      sortText: '0',
    }
  }

  private readonly labelDetailRules: RuleMap<CompletionItemLabelDetails> = {
    ClassDeclaration: (source) => {
      const qualifiedName = this.nameProvider.getQualifiedName(source)
      if (qualifiedName) {
        return {
          detail: `(${qualifiedName})`,
        }
      }
    },

    FunctionDeclaration: (source) => {
      const params = source.parameters.map((it) => {
        if (it.typeRef && it.typeRef.$cstNode) {
          return `${it.name} as ${it.typeRef.$cstNode.text}`
        }
        return it.name
      }).join(', ')

      const retType = source.returnTypeRef?.$cstNode?.text

      return {
        detail: `(${params})`,
        description: retType,
      }
    },

    ImportDeclaration: (source) => {
      return {
        detail: `(${source.path.slice(0, -1).map(it => it.$refText).join('.')})`,
      }
    },

    VariableDeclaration: (source) => {
      const type = source.typeRef?.$cstNode?.text
      return {
        description: `${type}`,
      }
    },

    ValueParameter: (source) => {
      const type = source.typeRef?.$cstNode?.text
      return {
        description: `${type}`,
      }
    },

    FieldDeclaration: (source) => {
      const type = source.typeRef?.$cstNode?.text
      return {
        description: `${type}`,
      }
    },

    SyntheticHierarchyNode: (source, name) => {
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
