import type { SemanticTokenAcceptor } from 'langium/lsp'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import { type AstNode, stream } from 'langium'
import { AbstractSemanticTokenProvider } from 'langium/lsp'
import { SemanticTokenModifiers, SemanticTokenTypes } from 'vscode-languageserver'
import { isBracketLocation } from '../generated/ast'
import { isStringType } from '../typing/type-description'
import { firstTokenTypeName } from '../utils/cst'
import { defineRules } from '../utils/rule'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K], acceptor: SemanticTokenAcceptor) => void }

const READONLY_PREFIX = ['global', 'static', 'val']

export class ZenScriptSemanticTokenProvider extends AbstractSemanticTokenProvider {
  protected readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  override highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void {
    this.rules(node.$type)?.call(this, node, acceptor)
  }

  private readonly rules = defineRules<RuleMap>({
    IntegerLiteral: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'value',
        type: SemanticTokenTypes.number,
      })
    },

    FloatingLiteral: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'value',
        type: SemanticTokenTypes.number,
      })
    },

    UnquotedString: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'value',
        type: SemanticTokenTypes.string,
      })
    },

    BracketExpression: (source, acceptor) => {
      const locations = stream(source.path).filter(isBracketLocation)
      const [first, ...rest] = locations

      switch (firstTokenTypeName(first)) {
        case 'IDENTIFIER':
          acceptor({
            node: first,
            property: 'value',
            type: SemanticTokenTypes.enum,
          })
          break
      }

      rest.forEach((it) => {
        switch (firstTokenTypeName(it)) {
          case 'IDENTIFIER':
            acceptor({
              node: it,
              property: 'value',
              type: SemanticTokenTypes.enumMember,
            })
            break

          case 'INTEGER':
            acceptor({
              node: it,
              property: 'value',
              type: SemanticTokenTypes.number,
            })
            break
        }
      })
    },

    ValueParameter: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'name',
        type: SemanticTokenTypes.parameter,
        modifier: SemanticTokenModifiers.readonly,
      })
    },

    LoopParameter: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'name',
        type: SemanticTokenTypes.parameter,
        modifier: SemanticTokenModifiers.readonly,
      })
    },

    NamedTypeReference: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'path',
        type: SemanticTokenTypes.class,
      })
      acceptor({
        node: source,
        property: 'typeArguments',
        type: SemanticTokenTypes.class,
      })
    },

    ReferenceExpression: (source, acceptor) => {
      switch (source.target?.ref?.$type) {
        // @ts-expect-error SyntheticHierarchyNode
        case 'SyntheticHierarchyNode':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.namespace,
          })
          break

        case 'ClassDeclaration':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.class,
          })
          break

        case 'VariableDeclaration':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.variable,
            modifier: READONLY_PREFIX.includes(source.target.ref.prefix) ? SemanticTokenModifiers.readonly : undefined,
          })
          break

        case 'FunctionDeclaration':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.function,
          })
          break

        case 'LoopParameter':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.parameter,
            modifier: SemanticTokenModifiers.readonly,
          })
          break

        case 'ValueParameter':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.parameter,
            modifier: SemanticTokenModifiers.readonly,
          })
          break
      }
    },

    MemberAccess: (source, acceptor) => {
      switch (source.target?.ref?.$type) {
        case 'Script':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.namespace,
          })
          break

        case 'FunctionDeclaration':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.function,
          })
          break

        case 'ClassDeclaration':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.class,
          })
          break

        case 'FieldDeclaration':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.property,
          })
          break

        // @ts-expect-error SyntheticHierarchyNode
        case 'SyntheticHierarchyNode':
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.namespace,
          })
          break

        case 'ValueParameter':
          // dynamic member
          acceptor({
            node: source,
            property: 'target',
            type: isStringType(this.typeComputer.inferType(source.target.ref)) ? SemanticTokenTypes.string : SemanticTokenTypes.variable,
          })
          break
      }
    },

    FunctionDeclaration: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'name',
        type: SemanticTokenTypes.function,
      })
    },

    ClassDeclaration: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'name',
        type: SemanticTokenTypes.class,
      })
    },

    TypeParameter: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'name',
        type: SemanticTokenTypes.typeParameter,
      })
    },

    FieldDeclaration: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'name',
        type: SemanticTokenTypes.property,
      })
    },

    VariableDeclaration: (source, acceptor) => {
      acceptor({
        node: source,
        property: 'name',
        type: SemanticTokenTypes.variable,
        modifier: READONLY_PREFIX.includes(source.prefix) ? SemanticTokenModifiers.readonly : undefined,
      })
    },
  })
}
