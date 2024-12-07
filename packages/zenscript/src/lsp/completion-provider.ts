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
import { CstUtils, stream } from 'langium'
import { DefaultCompletionProvider } from 'langium/lsp'
import { CompletionItemKind } from 'vscode-languageserver'
import { isBracketExpression, isBracketLocation, isBracketProperty, isUnquotedString } from '../generated/ast'
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

  override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
    if (isBracketExpression(context.node)) {
      this.completionForBracketLocation(context, acceptor)
    }
    else if (isBracketLocation(context.node)) {
      this.completionForBracketLocation(context, acceptor)
    }
    else if (isBracketProperty(context.node?.$container)) {
      this.completionForBracketLocation(context, acceptor)
    }
    else {
      return super.completionFor(context, next, acceptor)
    }
  }

  private completionForBracketLocation(context: CompletionContext, acceptor: CompletionAcceptor): void {
    let subPath: string
    if (isBracketExpression(context.node)) {
      subPath = getPathAsString(context.node)
    }
    else if (isBracketLocation(context.node)) {
      subPath = getPathAsString(context.node.$container, context.node.$containerIndex! - 1)
    }
    else if (isUnquotedString(context.node) && isBracketProperty(context.node.$container)) {
      subPath = getPathAsString(context.node.$container.$container)
    }
    else {
      subPath = ''
    }

    const tree = this.bracketManager.entryTree.find(subPath)
    if (!tree) {
      return
    }

    const middles: Stream<MiddleCompletion> = stream(tree.children.values())
      .filter(node => node.isInternalNode())
      .map(node => ({ node, label: node.name }))

    for (const middle of middles) {
      acceptor(context, {
        label: middle.label,
        kind: CompletionItemKind.EnumMember,
        insertText: `${middle.label}:`,
        labelDetails: {
          detail: ':',
          description: `+${middle.node.children.size + middle.node.data.size} item(s)`,
        },
        command: {
          title: 'Trigger Suggest',
          command: 'editor.action.triggerSuggest',
        },
      })
    }

    const ends: Stream<EndCompletion> = stream(tree.children.values())
      .filter(node => node.isDataNode())
      .flatMap(node => node.data.values().map(entry => ({ entry, label: node.name, description: entry.name })))

    const needClose = this.needCloseBracket(context)
    for (const end of ends) {
      acceptor(context, {
        label: end.label,
        kind: CompletionItemKind.EnumMember,
        insertText: needClose ? `${end.label}>` : undefined,
        labelDetails: {
          detail: '>',
          description: end.description,
        },
        detail: end.description,
      })
    }
  }

  private needCloseBracket(context: CompletionContext): boolean {
    const container = context.node?.$cstNode?.container
    const leaf = container ? CstUtils.findLeafNodeAtOffset(container, context.tokenEndOffset) : undefined
    return leaf?.text !== '>'
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
