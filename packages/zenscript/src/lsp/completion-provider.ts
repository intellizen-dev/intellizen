import type { AstNodeDescription } from 'langium'
import type { CompletionProviderOptions, CompletionValueItem } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { DefaultCompletionProvider } from 'langium/lsp'
import { toAstNode } from '../utils/ast'
import { generateStream } from '../utils/stream'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap<R> = { [K in keyof SourceMap]?: (source: SourceMap[K]) => R | undefined }

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
      return {
        description: this.nameProvider.getQualifiedName(source),
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
        detail: `${source.path.slice(0, -1).map(it => it.$refText).join('.')}`,
      }
    },

    VariableDeclaration: (source) => {
      return {
        description: source.typeRef?.$cstNode?.text,
      }
    },

    ValueParameter: (source) => {
      return {
        description: source.typeRef?.$cstNode?.text,
      }
    },

    FieldDeclaration: (source) => {
      return {
        description: source.typeRef?.$cstNode?.text,
      }
    },

    SyntheticHierarchyNode: (source) => {
      const qualifiedName = generateStream(source, it => it.parent)
        .filter(it => it.parent !== undefined)
        .map(it => it.name)
        .toArray()
        .reverse()
        .join('.')

      return {
        description: qualifiedName,
      }
    },
  }
}
