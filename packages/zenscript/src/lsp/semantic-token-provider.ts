import type { AstNode } from 'langium'
import type { SemanticTokenAcceptor } from 'langium/lsp'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import { stream } from 'langium'
import { AbstractSemanticTokenProvider } from 'langium/lsp'
import { SemanticTokenModifiers, SemanticTokenTypes } from 'vscode-languageserver'
import { isBracketLocation } from '../generated/ast'
import { isStringType } from '../typing/type-description'
import { firstTokenTypeName } from '../utils/cst'
import { defineRules } from '../utils/rule'

type RuleSpec = ZenScriptAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K], acceptor: SemanticTokenAcceptor) => void }

const READONLY_PREFIX = ['global', 'static', 'val']

export class ZenScriptSemanticTokenProvider extends AbstractSemanticTokenProvider {
  protected readonly typeComputer: TypeComputer

  constructor(services: ZenScriptServices) {
    super(services)
    this.typeComputer = services.typing.TypeComputer
  }

  override highlightElement(element: AstNode, acceptor: SemanticTokenAcceptor): void {
    this.highlightRules(element.$type)?.call(this, element, acceptor)
  }

  private readonly highlightRules = defineRules<RuleMap>({
    IntegerLiteral: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'value',
        type: SemanticTokenTypes.number,
      })
    },

    FloatLiteral: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'value',
        type: SemanticTokenTypes.number,
      })
    },

    UnquotedString: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'value',
        type: SemanticTokenTypes.string,
      })
    },

    BracketExpression: (element, acceptor) => {
      const locations = stream(element.path).filter(isBracketLocation)
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

    ValueParameter: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.parameter,
        modifier: SemanticTokenModifiers.readonly,
      })
    },

    LoopParameter: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.parameter,
        modifier: SemanticTokenModifiers.readonly,
      })
    },

    NamedType: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'path',
        type: SemanticTokenTypes.class,
      })
      acceptor({
        node: element,
        property: 'typeArgs',
        type: SemanticTokenTypes.class,
      })
    },

    ReferenceExpression: (element, acceptor) => {
      switch (element.entity?.ref?.$type) {
        // @ts-expect-error SyntheticHierarchyNode
        case 'SyntheticHierarchyNode':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.namespace,
          })
          break

        case 'ClassDeclaration':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.class,
          })
          break

        case 'VariableDeclaration':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.variable,
            modifier: READONLY_PREFIX.includes(element.entity.ref.variance) ? SemanticTokenModifiers.readonly : undefined,
          })
          break

        case 'FunctionDeclaration':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.function,
          })
          break

        case 'LoopParameter':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.parameter,
            modifier: SemanticTokenModifiers.readonly,
          })
          break

        case 'ValueParameter':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.parameter,
            modifier: SemanticTokenModifiers.readonly,
          })
          break

        // @ts-expect-error SyntheticStringLiteral
        case 'SyntheticStringLiteral':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.string,
          })
          break
      }
    },

    MemberAccess: (element, acceptor) => {
      switch (element.entity?.ref?.$type) {
        case 'Script':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.namespace,
          })
          break

        case 'FunctionDeclaration':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.function,
          })
          break

        case 'ClassDeclaration':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.class,
          })
          break

        case 'FieldDeclaration':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.property,
          })
          break

        // @ts-expect-error SyntheticHierarchyNode
        case 'SyntheticHierarchyNode':
          acceptor({
            node: element,
            property: 'entity',
            type: SemanticTokenTypes.namespace,
          })
          break

        case 'ValueParameter':
          // dynamic member
          acceptor({
            node: element,
            property: 'entity',
            type: isStringType(this.typeComputer.inferType(element.entity.ref)) ? SemanticTokenTypes.string : SemanticTokenTypes.variable,
          })
          break
      }
    },

    FunctionDeclaration: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.function,
      })
    },

    ClassDeclaration: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.class,
      })
    },

    TypeParameter: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.typeParameter,
      })
    },

    FieldDeclaration: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.property,
      })
    },

    VariableDeclaration: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.variable,
        modifier: READONLY_PREFIX.includes(element.variance) ? SemanticTokenModifiers.readonly : undefined,
      })
    },
  })
}
