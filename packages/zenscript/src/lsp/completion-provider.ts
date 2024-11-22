import type { AstNodeDescription } from 'langium'
import type { CompletionProviderOptions, CompletionValueItem } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { TypeComputer } from '../typing/type-computer'
import { DefaultCompletionProvider } from 'langium/lsp'
import { isFunctionType } from '../typing/type-description'
import { getPathAsString, toAstNode } from '../utils/ast'
import { generateStream } from '../utils/stream'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap<R> = { [K in keyof SourceMap]?: (source: SourceMap[K]) => R | undefined }

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  private readonly typeComputer: TypeComputer
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
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
      const funcType = this.typeComputer.inferType(source)
      if (!isFunctionType(funcType)) {
        return
      }

      const params = source.parameters.map((param, index) => {
        return `${param.name}: ${funcType.paramTypes[index].toString()}`
      }).join(', ')

      return {
        detail: `(${params})`,
        description: funcType.returnType.toString(),
      }
    },

    ImportDeclaration: (source) => {
      return {
        description: getPathAsString(source),
      }
    },

    VariableDeclaration: (source) => {
      return {
        description: this.typeComputer.inferType(source)?.toString(),
      }
    },

    ValueParameter: (source) => {
      return {
        description: this.typeComputer.inferType(source)?.toString(),
      }
    },

    FieldDeclaration: (source) => {
      return {
        description: this.typeComputer.inferType(source)?.toString(),
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
