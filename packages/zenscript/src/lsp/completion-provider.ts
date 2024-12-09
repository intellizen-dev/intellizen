import type { AstNodeDescription, MaybePromise } from 'langium'
import type { CompletionAcceptor, CompletionContext, CompletionProviderOptions, CompletionValueItem, NextFeature } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { BracketExpression, BracketProperty, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { BracketEntry } from '../resource'
import type { TypeComputer } from '../typing/type-computer'
import type { HierarchyNode } from '../utils/hierarchy-tree'
import type { ZenScriptBracketManager } from '../workspace/bracket-manager'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, CstUtils, GrammarAST, stream } from 'langium'
import { DefaultCompletionProvider } from 'langium/lsp'
import { CompletionItemKind } from 'vscode-languageserver'
import { isBracketExpression, isBracketLocation, isBracketProperty, isUnquotedString } from '../generated/ast'
import { isFunctionType } from '../typing/type-description'
import { getPathAsString, toAstNode } from '../utils/ast'
import { defineRules } from '../utils/rule'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => CompletionItemLabelDetails | undefined }

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  private readonly typeComputer: TypeComputer
  private readonly bracketManager: ZenScriptBracketManager
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.', '<', ':'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
    this.bracketManager = services.workspace.BracketManager
  }

  override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
    const bracket = AstUtils.getContainerOfType(context.node, isBracketExpression)
    if (bracket) {
      return this.completionForBracketExpression(bracket, context, next, acceptor)
    }
    else {
      return super.completionFor(context, next, acceptor)
    }
  }

  private completionForBracketExpression(bracket: BracketExpression, context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): void {
    let subPath: string
    if (isBracketExpression(context.node)) {
      subPath = getPathAsString(bracket)
    }
    else if (isBracketLocation(context.node)) {
      subPath = getPathAsString(bracket, context.node.$containerIndex! - 1)
    }
    else if (isBracketProperty(context.node)) {
      subPath = getPathAsString(bracket)
    }
    else if (isUnquotedString(context.node) && isBracketProperty(context.node.$container)) {
      subPath = getPathAsString(bracket)
    }
    else {
      subPath = ''
    }

    const tree = this.bracketManager.entryTree.find(subPath)
    if (!tree) {
      return
    }

    this.completionForBracketLocation(tree, context, next, acceptor)
    this.completionForBracketProperty(tree, context, next, acceptor)
  }

  private completionForBracketLocation(tree: HierarchyNode<BracketEntry>, context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): void {
    const requiredNextFeature
      = (GrammarAST.isRuleCall(next.feature) && next.feature.rule.ref?.name === 'IDENTIFIER')
    if (!requiredNextFeature) {
      return
    }

    const middles = stream(tree.children.values())
      .filter(node => node.isInternalNode())
      .map(node => ({ node, label: node.name }))

    for (const middle of middles) {
      const item: CompletionValueItem = {
        label: middle.label,
        kind: CompletionItemKind.EnumMember,
        labelDetails: {
          detail: ':',
          description: `+${middle.node.children.size + middle.node.data.size} item(s)`,
        },
      }
      if (!this.hasNextToken(context, ':')) {
        item.insertText = `${middle.label}:`
        item.command = {
          title: 'Trigger Suggest',
          command: 'editor.action.triggerSuggest',
        }
      }
      acceptor(context, item)
    }

    const ends = stream(tree.children.values())
      .filter(node => node.isDataNode())
      .flatMap(node => node.data.values().map(entry => ({ label: node.name, description: entry.name })))

    for (const end of ends) {
      const item: CompletionValueItem = {
        label: end.label,
        kind: CompletionItemKind.EnumMember,
        labelDetails: {
          detail: '>',
          description: end.description,
        },
        detail: end.description,
      }
      if (!this.hasNextToken(context, '>')) {
        item.insertText = `${end.label}>`
      }
      acceptor(context, item)
    }
  }

  private completionForBracketProperty(tree: HierarchyNode<BracketEntry>, context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): void {
    const entry = tree.data.values().next().value
    if (!entry) {
      return
    }

    this.completionForBracketPropertyKey(entry, context, next, acceptor)
    this.completionForBracketPropertyValue(entry, context, next, acceptor)
  }

  private completionForBracketPropertyKey(entry: BracketEntry, context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): void {
    const requiredNextFeature
      = (GrammarAST.isRuleCall(next.feature) && next.feature.rule.ref?.name === 'IDENTIFIER')
    if (!requiredNextFeature) {
      return
    }

    const invalidContainerProperty
      = (context.node?.$containerProperty === 'properties')
      || (context.node?.$containerProperty === 'value')
    if (invalidContainerProperty) {
      return
    }

    for (const key in entry.properties) {
      const item: CompletionValueItem = {
        label: key,
        kind: CompletionItemKind.Property,
        labelDetails: {
          detail: '=',
          description: `+${entry.properties[key].length} item(s)`,
        },
      }
      if (!this.hasNextToken(context, '=')) {
        item.insertText = `${key}=`
        item.command = {
          title: 'Trigger Suggest',
          command: 'editor.action.triggerSuggest',
        }
      }
      acceptor(context, item)
    }
  }

  private completionForBracketPropertyValue(entry: BracketEntry, context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): void {
    const requiredNextFeature
      = (GrammarAST.isRuleCall(next.feature) && next.feature.rule.ref?.name === 'IDENTIFIER')
      || (GrammarAST.isKeyword(next.feature) && next.feature.value === '=')
    if (!requiredNextFeature) {
      return
    }

    const invalidContainerProperty
      = (context.node?.$containerProperty === 'path')
    if (invalidContainerProperty) {
      return
    }

    let propertyNode: BracketProperty
    if (isBracketProperty(context.node)) {
      propertyNode = context.node
    }
    else if (isUnquotedString(context.node) && isBracketProperty(context.node.$container)) {
      propertyNode = context.node.$container
    }
    else {
      return
    }

    const key = propertyNode.key.$cstNode?.text
    if (!key) {
      return
    }

    const values = entry.properties[key]
    if (!values) {
      return
    }

    for (const value of values) {
      acceptor(context, {
        label: value,
        kind: CompletionItemKind.Constant,
      })
    }
  }

  private hasNextToken(context: CompletionContext, token: string): boolean {
    const container = context.node?.$cstNode?.container
    const leaf = container ? CstUtils.findLeafNodeAtOffset(container, context.tokenEndOffset) : undefined
    return leaf?.text === token
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
