import type { AstNodeDescription, MaybePromise } from 'langium'
import type { CompletionAcceptor, CompletionContext, CompletionProviderOptions, CompletionValueItem, NextFeature } from 'langium/lsp'
import type { BracketExpression, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { TypeComputer } from '../typing/type-computer'
import type { ZenScriptBracketManager } from '../workspace/bracket-manager'
import { substringBeforeLast } from '@intellizen/shared'
import { DefaultCompletionProvider } from 'langium/lsp'

import { CompletionItemKind, type CompletionItemLabelDetails, TextEdit } from 'vscode-languageserver'
import { isBracketExpression, isBracketPath, isExpressionTemplate } from '../generated/ast'
import { isFunctionType } from '../typing/type-description'
import { getPathAsString, toAstNode } from '../utils/ast'
import { defineRules } from '../utils/rule'

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => CompletionItemLabelDetails | undefined }

export class ZenScriptCompletionProvider extends DefaultCompletionProvider {
  private readonly typeComputer: TypeComputer
  private readonly bracketManager: ZenScriptBracketManager
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['.'],
  }

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
    this.bracketManager = services.workspace.BracketManager
  }

  private compltetForBracket(context: CompletionContext, bracket: BracketExpression, acceptor: CompletionAcceptor): MaybePromise<void> {
    const path = isBracketPath(context.node) ? bracket.path.slice(0, context.node?.$containerIndex) : bracket.path

    if (path.some(it => isExpressionTemplate(it))) {
      return
    }
    const candidate = this.bracketManager.completionFor(path.map(it => it.value as string))

    const textRange = {
      start: bracket.path[0].$cstNode!.range.start,
      end: context.node!.$cstNode!.range.end,
    }

    for (const completion of candidate) {
      acceptor(context, {
        label: completion.id,
        kind: CompletionItemKind.EnumMember,
        labelDetails: {
          description: completion.name,
        },
        textEdit: TextEdit.replace(textRange, completion.id),
      })
    }
  }

  protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
    if (isBracketExpression(context.node?.$container)) {
      if (next.feature.$containerIndex !== 0) {
        return
      }
      return this.compltetForBracket(context, context.node.$container, acceptor)
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
