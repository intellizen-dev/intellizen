import type { AstNodeDescription, MaybePromise, Stream } from 'langium'
import type { CompletionAcceptor, CompletionContext, CompletionProviderOptions, CompletionValueItem, NextFeature } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { BracketEntry } from '../resource'
import type { TypeComputer } from '../typing/type-computer'
import type { HierarchyNode } from '../utils/hierarchy-tree'
import type { ZenScriptBracketManager } from '../workspace/bracket-manager'
import { substringBeforeLast } from '@intellizen/shared'
import { EMPTY_STREAM, stream } from 'langium'
import { DefaultCompletionProvider } from 'langium/lsp'
import { CompletionItemKind } from 'vscode-languageserver'
import { isBracketExpression, isBracketLocation } from '../generated/ast'
import { isFunctionType } from '../typing/type-description'
import { getPathAsString, toAstNode } from '../utils/ast'
import { defineRules } from '../utils/rule'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => CompletionItemLabelDetails | undefined }

interface MiddleCompletion {
  node: HierarchyNode<BracketEntry>
  label: string
}

interface EndCompletion {
  entry: BracketEntry
  label: string
  description?: string
}

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  private readonly typeComputer: TypeComputer
  private readonly bracketManager: ZenScriptBracketManager
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.', '<'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
    this.bracketManager = services.workspace.BracketManager
  }

  protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
    if (isBracketExpression(context.node)) {
      this.completionForBracketExpression(context, acceptor)
    }
    else if (isBracketLocation(context.node)) {
      this.completionForBracketLocation(context, acceptor)
    }
    else {
      return super.completionFor(context, next, acceptor)
    }
  }

  private collectBracketCompletions(path: string): { middles: Stream<MiddleCompletion>, ends: Stream<EndCompletion> } {
    const tree = this.bracketManager.entryTree.find(path)
    if (!tree) {
      return { middles: EMPTY_STREAM, ends: EMPTY_STREAM }
    }
    const middles: Stream<MiddleCompletion> = stream(tree.children.values())
      .filter(node => node.isInternalNode())
      .map(node => ({ node, label: node.name }))
    const ends: Stream<EndCompletion> = stream(tree.children.values())
      .filter(node => node.isDataNode())
      .flatMap(node => node.data.values().map(entry => ({ entry, label: node.name, description: entry.name })))
    return { middles, ends }
  }

  private completionForBracketExpression(context: CompletionContext, acceptor: CompletionAcceptor): void {
    const node = isBracketExpression(context.node) ? context.node : undefined
    const path = node ? getPathAsString(node, node.$containerIndex) : ''
    const { middles, ends } = this.collectBracketCompletions(path)

    for (const middle of middles) {
      acceptor(context, {
        label: middle.label,
        kind: CompletionItemKind.EnumMember,
        insertText: `${middle.label}:`,
        labelDetails: {
          detail: ':',
          description: `+${middle.node.children.size + middle.node.data.size} items`,
        },
        command: {
          title: 'Trigger Suggest',
          command: 'editor.action.triggerSuggest',
        },
      })
    }

    for (const end of ends) {
      acceptor(context, {
        label: end.label,
        kind: CompletionItemKind.EnumMember,
        insertText: `${end.label}>`,
        labelDetails: {
          detail: '>',
          description: end.description,
        },
      })
    }
  }

  private completionForBracketLocation(context: CompletionContext, acceptor: CompletionAcceptor): void {
    const location = isBracketLocation(context.node) ? context.node : undefined
    const path = location ? substringBeforeLast(getPathAsString(location.$container, location.$containerIndex), ':') : ''
    const { middles, ends } = this.collectBracketCompletions(path)
    for (const middle of middles) {
      acceptor(context, {
        label: middle.label,
        kind: CompletionItemKind.EnumMember,
        insertText: `${middle.label}:`,
        labelDetails: {
          detail: ':',
          description: `+${middle.node.children.size + middle.node.data.size} items`,
        },
        command: {
          title: 'Trigger Suggest',
          command: 'editor.action.triggerSuggest',
        },
      })
    }
    for (const end of ends) {
      acceptor(context, {
        label: end.label,
        kind: CompletionItemKind.EnumMember,
        insertText: `${end.label}>`,
        labelDetails: {
          detail: '>',
          description: end.description,
        },
      })
    }
  }

  override createReferenceCompletionItem(nodeDescription: AstNodeDescription): CompletionValueItem {
    const source = toAstNode(nodeDescription)
    const kind = this.nodeKindProvider.getCompletionItemKind(nodeDescription)
    const labelDetails = this.labelDetailRules(source?.$type)?.call(this, source)

    return {
      nodeDescription,
      kind,
      labelDetails,
      sortText: '0',
    }
  }

  private readonly labelDetailRules = defineRules<RuleMap>({
    ClassDeclaration: (source) => {
      const qualifiedName = this.nameProvider.getQualifiedName(source)
      if (qualifiedName) {
        return {
          description: substringBeforeLast(qualifiedName, '.'),
        }
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
  })
}
