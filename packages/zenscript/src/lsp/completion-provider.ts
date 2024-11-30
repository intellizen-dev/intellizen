import type { AstNodeDescription, LangiumDocument, MaybePromise, Stream } from 'langium'
import type { CompletionAcceptor, CompletionContext, CompletionProviderOptions, CompletionValueItem, NextFeature } from 'langium/lsp'
import type { CancellationToken, CompletionItem, CompletionItemLabelDetails, CompletionList, CompletionParams, Range } from 'vscode-languageserver'
import type { BracketExpression, BracketLocation, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { TypeComputer } from '../typing/type-computer'
import type { ZenScriptBracketManager } from '../workspace/bracket-manager'
import { substringBeforeLast } from '@intellizen/shared'
import { GrammarUtils, stream } from 'langium'
import { DefaultCompletionProvider } from 'langium/lsp'
import { CompletionItemKind, TextEdit } from 'vscode-languageserver'
import { isBracketExpression, isBracketLocation, isBracketProperty, isExpressionTemplate } from '../generated/ast'
import { isFunctionType } from '../typing/type-description'
import { getPathAsString, toAstNode } from '../utils/ast'
import { defineRules } from '../utils/rule'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => CompletionItemLabelDetails | undefined }

export interface BracketCompletion {
  id: string
  name?: string
}

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  private readonly typeComputer: TypeComputer
  private readonly bracketManager: ZenScriptBracketManager
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.', '<', ':', '=', ','],
  }

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
    this.bracketManager = services.workspace.BracketManager
  }

  private collectBracketFor(path: string[], current: string): Stream<BracketCompletion> {
    const hierarchy = this.bracketManager.entryTree.find(path)
    if (!hierarchy) {
      return stream([])
    }

    const children = hierarchy.children

    const candidates = stream(children.values())
      .filter(it => !current || this.fuzzyMatcher.match(current, it.name))
      .toArray()

    const entries = stream(candidates).filter(node => node.isDataNode())
      .flatMap((node) => {
        return stream(node.data).map((entry) => {
          return {
            id: node.name,
            name: entry.name,
          }
        })
      })

    const groups = stream(candidates).filter(node => node.isInternalNode())
      .map((node) => {
        return {
          id: node.name,
        }
      })

    return entries.concat(groups)
  }

  private tryCompletionForBracketProperty(context: CompletionContext, bracket: BracketExpression, acceptor: CompletionAcceptor): boolean {
    // do not complete for expression template beacuse it is hard to determine the value
    if (bracket.path.some(it => isExpressionTemplate(it))) {
      return false
    }

    const existingKeys = stream(bracket.properties?.map(it => it.key.value) ?? []).nonNullable().toSet()

    let key: string | undefined
    let value: string | undefined
    let bracketId: string
    // need to manual provide range for vs may use '=', ':' to match the completion
    let range: Range | undefined

    // <blockstate:minecraft:furnace:|>  (with > here, empty property)
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    if (isBracketExpression(context.node)) {
      bracketId = bracket.path.map(it => it.value).join(':')
      range = {
        start: context.position,
        end: context.position,
      }
    }
    // <blockstate:minecraft:furnace:faci|>  (with > here, no '=', not empty value)
    //                               ^^^^
    else if (isBracketLocation(context.node)) {
      key = context.node.value as string
      bracketId = bracket.path.slice(0, context.node.$containerIndex!).map(it => it.value).join(':')
      range = context.node.$cstNode?.range
    }
    // <blockstate:minecraft:furnace:faci=|>        (with '=' here)
    //                               ^^^^^
    else if (isBracketProperty(context.node)) {
      const property = context.node
      key = property.key.value
      value = ''
      bracketId = bracket.path.map(it => it.value).join(':')
      range = {
        start: context.position,
        end: context.position,
      }
    }
    // <blockstate:minecraft:furnace:faci|        (no > here)
    //                               ^^^^
    else if (isBracketProperty(context.node?.$container)) {
      const property = context.node.$container

      key = property.key.value
      value = property.value?.value?.toString()
      bracketId = bracket.path.map(it => it.value).join(':')

      range = context.node.$cstNode?.range
    }
    else {
      return false
    }

    // completion for property
    const mirror = this.bracketManager.resolve(bracketId)
    if (!mirror) {
      return false
    }

    if (value === undefined) {
      stream(Object.keys(mirror.properties))
        .filter(it => !existingKeys.has(it))
        .filter(it => !key || this.fuzzyMatcher.match(key, it))
        .forEach((it) => {
          acceptor(context, {
            label: it,
            kind: CompletionItemKind.Property,
            commitCharacters: ['='],
            textEdit: range && TextEdit.replace(range, it),
          })
        })

      return true
    }

    const propValues = (mirror.properties as any)[key!]
    if (!Array.isArray(propValues)) {
      return false
    }

    stream(propValues)
      .filter(it => !value || this.fuzzyMatcher.match(value, it))
      .forEach((it) => {
        acceptor(context, {
          label: it,
          kind: CompletionItemKind.Constant,
          commitCharacters: ['>', ','],
          textEdit: range && TextEdit.replace(range, it),
        })
      })

    return true
  }

  private completionForBracketLocation(context: CompletionContext, bracket: BracketExpression, acceptor: CompletionAcceptor): void {
    if (bracket.path.some(it => isExpressionTemplate(it))) {
      return
    }

    let path: BracketLocation[] | undefined
    let current: string | undefined
    // <item:minecraft:app|>  (with > here)
    if (isBracketLocation(context.node)) {
      path = bracket.path.slice(0, context.node.$containerIndex!)
      current = context.node.value as string
    }
    // <item:minecraft:app|        (no > here)
    else {
      path = bracket.path
      if (bracket.properties.length === 0) {
        current = ''
      }
      else if (bracket.properties.length === 1 && !GrammarUtils.findNodeForKeyword(bracket.properties[0].$cstNode, '=')) {
        // if the last property only has a key, may is be a wrong ast node, assume it as also a path
        current = bracket.properties[0].key.value
      }
    }

    if (current === undefined) {
      return
    }

    const candidate = this.collectBracketFor(path.map(it => it.value as string), current)

    for (const completion of candidate) {
      acceptor(context, {
        label: completion.id,
        kind: completion.name ? CompletionItemKind.EnumMember : CompletionItemKind.Enum,
        labelDetails: {
          description: completion.name,
        },
        commitCharacters: [':', '>'],

      })
    }
  }

  // find the bracket expression node from the context
  private findBracket(context: CompletionContext): BracketExpression | undefined {
    if (isBracketExpression(context.node)) {
      return context.node
    }
    let bracketNode
    if (context.node?.$containerProperty === 'path' || context.node?.$containerProperty === 'properties') {
      bracketNode = context.node?.$container
    }
    else if (context.node?.$containerProperty === 'key' || context.node?.$containerProperty === 'value') {
      bracketNode = context.node?.$container?.$container
    }

    if (isBracketExpression(bracketNode)) {
      return bracketNode
    }
  }

  private readonly bracketTriggerCharacters = new Set(['<', ':', '=', ','])

  private currentTriggerCharacter: string | undefined
  private continue: boolean = true

  public override getCompletion(document: LangiumDocument, params: CompletionParams, _cancelToken?: CancellationToken): Promise<CompletionList | undefined> {
    // store the current trigger character, and reset the continue flag
    this.currentTriggerCharacter = params.context?.triggerCharacter
    this.continue = true
    return super.getCompletion(document, params, _cancelToken)
  }

  private completionForBracket(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): boolean {
    const bracket = this.findBracket(context)
    if (bracket) {
      // stop completion here for we only complete for bracket context once, and do not check completion for other features even no completion items
      this.continue = false
      if (this.tryCompletionForBracketProperty(context, bracket, acceptor)) {
        return false
      }
      this.completionForBracketLocation(context, bracket, acceptor)
      return false
    }

    // if the current trigger character is a bracket trigger character, skip other completions
    if (this.currentTriggerCharacter && this.bracketTriggerCharacters.has(this.currentTriggerCharacter)) {
      this.continue = false
      return false
    }

    return true
  }

  protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
    const continueCompletion = this.continue && this.completionForBracket(context, next, acceptor)
    if (!continueCompletion) {
      return
    }

    return super.completionFor(context, next, acceptor)
  }

  protected override continueCompletion(items: CompletionItem[]): boolean {
    // because langium will attempt to use a different context to complete if they found no items,
    // we need to check if we have already completed the bracket context, if so, we should not continue to other contexts
    if (!this.continue) {
      return false
    }
    return super.continueCompletion(items)
  }

  protected override createReferenceCompletionItem(nodeDescription: AstNodeDescription): CompletionValueItem {
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
