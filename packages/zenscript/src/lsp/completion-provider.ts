import type { AstNodeDescription, MaybePromise, ReferenceInfo, Stream } from 'langium'
import type { CompletionAcceptor, CompletionContext, CompletionProviderOptions, CompletionValueItem, NextFeature } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { BracketExpression, BracketProperty, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { TypeComputer } from '../typing/type-computer'
import type { NamespaceNode } from '../utils/namespace-tree'
import type { BracketEntry, ZenScriptBracketManager } from '../workspace/bracket-manager'
import { substringBeforeLast } from '@intellizen/shared'
import { AstUtils, CstUtils, GrammarAST, stream } from 'langium'
import { DefaultCompletionProvider } from 'langium/lsp'
import { CompletionItemKind } from 'vscode-languageserver'
import { isBracketExpression, isBracketLocation, isBracketProperty, isOperatorFunctionDeclaration, isUnquotedString } from '../generated/ast'
import { isFunctionType } from '../typing/type-description'
import { getPathAsString, toAstNode } from '../utils/ast'
import { isZs } from '../utils/document'
import { defineRules } from '../utils/rule'

type RuleSpec = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K]) => CompletionItemLabelDetails | undefined }

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  private readonly typeComputer: TypeComputer
  private readonly bracketManager: ZenScriptBracketManager
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.', '<', ':'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
    this.bracketManager = services.shared.workspace.BracketManager
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

    const node = this.bracketManager.entries.find(subPath)
    if (!node) {
      return
    }

    this.completionForBracketLocation(node, context, next, acceptor)
    this.completionForBracketProperty(node, context, next, acceptor)
  }

  private completionForBracketLocation(node: NamespaceNode<BracketEntry>, context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): void {
    const requiredNextFeature
      = (GrammarAST.isRuleCall(next.feature) && next.feature.rule.ref?.name === 'IDENTIFIER')
    if (!requiredNextFeature) {
      return
    }

    const middles = stream(node.children.values())
      .filter(node => !node.hasData())
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

    const ends = stream(node.children.values())
      .filter(node => node.hasData())
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

  private completionForBracketProperty(node: NamespaceNode<BracketEntry>, context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): void {
    const entry = node.data.values().next().value
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
    const element = toAstNode(nodeDescription)
    const kind = this.nodeKindProvider.getCompletionItemKind(nodeDescription)
    const labelDetails = this.labelDetailRules(element?.$type)?.call(this, element)

    return {
      nodeDescription,
      kind,
      labelDetails,
      sortText: '0',
    }
  }

  private readonly labelDetailRules = defineRules<RuleMap>({
    ClassDeclaration: (element) => {
      const qualifiedName = this.nameProvider.getQualifiedName(element)
      if (qualifiedName) {
        return {
          description: substringBeforeLast(qualifiedName, '.'),
        }
      }
    },

    FunctionDeclaration: (element) => {
      const funcType = this.typeComputer.inferType(element)
      if (!isFunctionType(funcType)) {
        return
      }

      const params = element.params.map((param, index) => {
        return `${param.name}: ${funcType.paramTypes[index].toString()}`
      }).join(', ')

      return {
        detail: `(${params})`,
        description: funcType.returnType.toString(),
      }
    },

    ImportDeclaration: (element) => {
      return {
        description: getPathAsString(element),
      }
    },

    VariableDeclaration: (element) => {
      return {
        description: this.typeComputer.inferType(element)?.toString(),
      }
    },

    ValueParameter: (element) => {
      return {
        description: this.typeComputer.inferType(element)?.toString(),
      }
    },

    FieldDeclaration: (element) => {
      return {
        description: this.typeComputer.inferType(element)?.toString(),
      }
    },
  })

  override filterKeyword(context: CompletionContext, keyword: GrammarAST.Keyword): boolean {
    if (isZs(context.document) && this.ZsKeywordBlackList.has(keyword.value)) {
      return false
    }
    else {
      return super.filterKeyword(context, keyword)
    }
  }

  readonly ZsKeywordBlackList = new Set([
    'default',
    'expand',
    'lambda',
    'operator',
    'package',
  ])

  override getReferenceCandidates(refInfo: ReferenceInfo, context: CompletionContext): Stream<AstNodeDescription> {
    return this.scopeProvider.getScope(refInfo).getAllElements().filter(desc => this.filterReference(context, desc))
  }

  filterReference(context: CompletionContext, desc: AstNodeDescription): boolean {
    return this.ReferenceBlackList.every(predict => !predict(desc.node))
  }

  readonly ReferenceBlackList = [
    isOperatorFunctionDeclaration,
  ]
}
