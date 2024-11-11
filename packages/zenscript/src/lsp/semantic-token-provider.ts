import type { AstNode } from 'langium'
import type { SemanticTokenAcceptor } from 'langium/lsp'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import { AbstractSemanticTokenProvider } from 'langium/lsp'
import { SemanticTokenModifiers, SemanticTokenTypes } from 'vscode-languageserver'
import { ValueParameter } from '../generated/ast'
import { isStringType } from '../typing/type-description'

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
    // @ts-expect-error allowed index type
    this.rules[node.$type]?.call(this, node, acceptor)
  }

  private readonly rules: RuleMap = {
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
        type: SemanticTokenTypes.typeParameter,
      })
    },

    ReferenceExpression: (source, acceptor) => {
      switch (source.target.ref?.$type) {
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

        case 'VariableDeclaration': {
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.variable,
            modifier: READONLY_PREFIX.includes(source.target.ref.prefix) ? SemanticTokenModifiers.readonly : undefined,
          })
          break
        }

        case 'FunctionDeclaration': {
          acceptor({
            node: source,
            property: 'target',
            type: SemanticTokenTypes.function,
          })
          break
        }

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
      switch (source.target.ref?.$type) {
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

        case ValueParameter: {
          // dynamic member
          const type = this.typeComputer.inferType(source.target.ref)
          acceptor({
            node: source,
            property: 'target',
            type: isStringType(type) ? SemanticTokenTypes.string : SemanticTokenTypes.variable,
          })
        }
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
  }
}
