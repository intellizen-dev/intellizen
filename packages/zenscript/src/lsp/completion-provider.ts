import type { AstNodeDescription, MaybePromise, Stream } from 'langium'
import type { CompletionAcceptor, CompletionContext, CompletionProviderOptions, CompletionValueItem, NextFeature } from 'langium/lsp'
import type { CompletionItemLabelDetails } from 'vscode-languageserver'
import type { BracketExpression, BracketLocation, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { TypeComputer } from '../typing/type-computer'
import type { ZenScriptBracketManager } from '../workspace/bracket-manager'
import { substringBeforeLast } from '@intellizen/shared'
import { GrammarUtils, stream } from 'langium'
import { DefaultCompletionProvider } from 'langium/lsp'
import { CompletionItemKind } from 'vscode-languageserver'
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
    // <blockstate:minecraft:furnace:|>  (with > here, empty property)
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    if (isBracketExpression(context.node)) {
      bracketId = bracket.path.map(it => it.value).join(':')
    }
    // <blockstate:minecraft:furnace:faci|>  (with > here, no '=', not empty value)
    //                               ^^^^
    else if (isBracketLocation(context.node)) {
      key = context.node.value as string
      bracketId = bracket.path.slice(0, context.node.$containerIndex!).map(it => it.value).join(':')
    }
    // <blockstate:minecraft:furnace:faci=|>        (with '=' here)
    //                               ^^^^
    else if (isBracketProperty(context.node)) {
      const property = context.node
      key = property.key.value
      value = ''
      bracketId = bracket.path.map(it => it.value).join(':')
    }
    // <blockstate:minecraft:furnace:faci|        (no > here)
    //                               ^^^^
    else if (isBracketProperty(context.node?.$container)) {
      const property = context.node.$container

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

    if (value === undefined) {
      stream(Object.keys(mirror.properties))
        .filter(it => !existingKeys.has(it))
        .filter(it => !key || this.fuzzyMatcher.match(key, it))
        .forEach((it) => {
          acceptor(context, {
            label: it,
            kind: CompletionItemKind.Property,
            commitCharacters: ['='],
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
        })
      })

    return true
  }

  private completionForBracket(context: CompletionContext, bracket: BracketExpression, acceptor: CompletionAcceptor): MaybePromise<void> {
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

  protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
    const bracket = this.findBracket(context)
    if (bracket) {
      // skip other features, only complete for bracket context once
      if (next !== context.features[0]) {
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
