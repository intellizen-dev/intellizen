import type { AstNodeDescription, MaybePromise, Stream } from 'langium'
import type { CompletionAcceptor, CompletionContext, CompletionProviderOptions, CompletionValueItem, NextFeature } from 'langium/lsp'
import type { CompletionItemLabelDetails, Range } from 'vscode-languageserver'
import type { BracketExpression, BracketLocation, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { BracketMirror } from '../resource'
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
  path: string[]
  name?: string
}

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

  private collectBracketFor(path: string[]): Stream<BracketCompletion> {
    if (path.length === 0) {
      // if do not type anything, return all items
      return stream(this.bracketManager.mirrors)
        .filter(mirror => mirror.type === 'crafttweaker.item.IItemStack')
        .flatMap((mirror) => {
          return this.collectBracketForMirror(mirror, path)
        })
    }
    const prefix = path.join(':')
    const mirror = this.bracketManager.mirrors.find(mirror => mirror.regex.test(prefix))
    if (mirror) {
      return this.collectBracketForMirror(mirror, path)
    }
    return stream(this.bracketManager.mirrors).flatMap((mirror) => {
      return this.collectBracketForMirror(mirror, path)
    })
  }

  private collectBracketForMirror(mirror: BracketMirror, path: string[]): Stream<BracketCompletion> {
    const isItem = (mirror.type === 'crafttweaker.item.IItemStack')
    if (isItem && path.length > 0 && this.fuzzyMatcher.match(path[0], 'item')) {
      path = path.slice(1)
    }

    return stream(mirror.entries.entries())
      .filter((it) => {
        const sourcePaths = it[0].split(':')
        return sourcePaths.length >= path.length
          && sourcePaths.slice(0, path.length).every(
            (it, i) => this.fuzzyMatcher.match(path[i], it),
          )
      })
      .map((it) => {
        const [id, entry] = it

        return {
          id: isItem ? `item:${id}` : id,
          path: isItem ? ['item', ...id.split(':')] : id.split(':'),
          name: entry.name,
        }
      })
  }

  private tryCompletionForBracketProperty(context: CompletionContext, bracket: BracketExpression, acceptor: CompletionAcceptor): boolean {
    // do not complete for expression template beacuse it is hard to determine the value
    if (bracket.path.some(it => isExpressionTemplate(it))) {
      return false
    }

    let range: Range | undefined
    let key: string | undefined
    let value: string | undefined
    let bracketId: string
    // <blockstate:minecraft:furnace:|>  (with > here, empty property)
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    if (isBracketExpression(context.node)) {
      bracketId = bracket.path.map(it => it.value).join(':')

      const mirror = this.bracketManager.resolve(bracketId)
      if (!mirror) {
        return false
      }

      stream(Object.keys(mirror.properties))
        .flatMap((key) => {
          const propValues = (mirror.properties as any)[key]
          if (!Array.isArray(propValues)) {
            return []
          }
          return stream(propValues)
            .filter(it => typeof it === 'string')
            .map(it => `${key}=${it}`)
        })
        .forEach((it) => {
          acceptor(context, {
            label: it,
            kind: CompletionItemKind.Property,
          })
        })

      return true
    }
    // <blockstate:minecraft:furnace:faci|>  (with > here, no '=', not empty value)
    //                               ^^^^
    if (isBracketLocation(context.node)) {
      range = {
        start: context.node.$cstNode!.range.start,
        end: context.node.$cstNode!.range.end,
      }
      key = context.node.value as string
      bracketId = bracket.path.slice(0, context.node.$containerIndex!).map(it => it.value).join(':')
    }
    // <blockstate:minecraft:furnace:faci        (no > here)
    //                               ^^^^
    else if (isBracketProperty(context.node?.$container)) {
      const property = context.node.$container
      range = {
        start: property.key.$cstNode!.range.start,
        end: context.node!.$cstNode!.range.end,
      }

      key = property.key.value
      value = property.value?.value?.toString()
      bracketId = bracket.path.map(it => it.value).join(':')
    }
    else {
      return false
    }

    // completion for property
    const mirror = this.bracketManager.resolve(bracketId)
    if (!mirror) {
      return false
    }

    stream(Object.keys(mirror.properties))
      .filter(it => this.fuzzyMatcher.match(key, it))
      .flatMap((key) => {
        const propValues = (mirror.properties as any)[key]
        if (!Array.isArray(propValues)) {
          return []
        }
        return stream(propValues)
          .filter(it => typeof it === 'string')
          .filter(it => !value || this.fuzzyMatcher.match(value, it))
          .map(it => `${key}=${it}`)
      })
      .forEach((it) => {
        const textEdit = TextEdit.replace(range, it)
        acceptor(context, {
          label: it,
          kind: CompletionItemKind.Property,
          textEdit,
        })
      })

    return true
  }

  private completionForBracket(context: CompletionContext, bracket: BracketExpression, acceptor: CompletionAcceptor): MaybePromise<void> {
    let path: (BracketLocation | { value: string })[] | undefined
    // <item:minecraft:app|>  (with > here)
    if (isBracketLocation(context.node)) {
      path = bracket.path.slice(0, context.node.$containerIndex! + 1)
    }
    // <item:minecraft:app|        (no > here)
    else {
      if (bracket.properties.length === 0) {
        path = bracket.path
      }
      else if (bracket.properties.length === 1 && !GrammarUtils.findNodeForKeyword(bracket.properties[0].$cstNode, '=')) {
        // if the last property only has a key, may is be a wrong ast node, assume it as also a path
        const lastText = bracket.properties[0].key.value
        path = [...bracket.path, { value: lastText }]
      }
    }
    if (!path || path.some(it => isExpressionTemplate(it))) {
      return
    }

    const candidate = this.collectBracketFor(path.map(it => it.value as string))

    let editTextRange: Range | undefined

    // completion for empty path, no text to replace
    if (bracket.path.length > 0) {
      editTextRange = {
        start: bracket.path[0].$cstNode!.range.start,
        end: context.node!.$cstNode!.range.end,
      }
    }

    const hasTrailingGT = GrammarUtils.findNodeForKeyword(bracket.$cstNode, '>')

    for (const completion of candidate) {
      const textEditText = hasTrailingGT ? completion.id : `${completion.id}>`
      const textEdit = editTextRange
        ? TextEdit.replace(editTextRange, textEditText)
        : TextEdit.insert(context.position, textEditText)
      acceptor(context, {
        label: completion.id,
        kind: CompletionItemKind.EnumMember,
        labelDetails: {
          description: completion.name,
        },
        textEdit,
      })
    }
  }

  // find the bracket expression node from the context
  private findBracket(context: CompletionContext): BracketExpression | undefined {
    if (isBracketExpression(context.node)) {
      return context.node
    }
    let bracketNode
    if (context.node?.$containerProperty === 'path') {
      bracketNode = context.node?.$container
    }
    else if (context.node?.$containerProperty === 'key') {
      bracketNode = context.node?.$container?.$container
    }

    if (isBracketExpression(bracketNode)) {
      return bracketNode
    }
  }

  protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
    const bracket = this.findBracket(context)
    if (bracket) {
      // skip other features, only complete for bracket context once
      if (next.feature.$containerIndex !== 0) {
        return
      }
      if (this.tryCompletionForBracketProperty(context, bracket, acceptor)) {
        return
      }
      return this.completionForBracket(context, bracket, acceptor)
    }

    return super.completionFor(context, next, acceptor)
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
