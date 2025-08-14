import type { AstNode } from 'langium'
import type { SemanticTokenAcceptor } from 'langium/lsp'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import { stream } from 'langium'
import { AbstractSemanticTokenProvider } from 'langium/lsp'
import { SemanticTokenModifiers, SemanticTokenTypes } from 'vscode-languageserver'
import { isBracketLocation } from '../generated/ast'
import { isReadonly } from '../utils/ast'
import { firstTokenTypeName } from '../utils/cst'
import { isNamespaceNode } from '../utils/namespace-tree'
import { defineRules } from '../utils/rule'

type RuleSpec = ZenScriptAstType & ZenScriptSyntheticAstType
type HighlightRuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K], acceptor: SemanticTokenAcceptor) => void }
type SemanticReferenceRuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K]) => { type?: SemanticTokenTypes, modifier?: SemanticTokenModifiers } | undefined }

export class ZenScriptSemanticTokenProvider extends AbstractSemanticTokenProvider {
  constructor(services: ZenScriptServices) {
    super(services)
  }

  override highlightElement(element: AstNode, acceptor: SemanticTokenAcceptor): void {
    this.highlightRules(element.$type)?.call(this, element, acceptor)
  }

  private readonly highlightRules = defineRules<HighlightRuleMap>({
    ImportDeclaration: (element, acceptor) => {
      for (let i = 0; i < element.path.length; i++) {
        const part = element.path[i]
        const { type, modifier } = this.semanticReferenceRules(part.ref?.$type)?.call(this, part.ref) ?? {}
        if (type) {
          acceptor({
            node: element,
            property: 'path',
            index: i,
            type,
            modifier,
          })
        }
      }
    },

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
        modifier: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
      })
    },

    LoopParameter: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.variable,
        modifier: [SemanticTokenModifiers.declaration, SemanticTokenModifiers.readonly],
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
      const entity = element.entity.ref
      const { type, modifier } = this.semanticReferenceRules(entity?.$type)?.call(this, entity) ?? {}
      if (type) {
        acceptor({
          node: element,
          property: 'entity',
          type,
          modifier,
        })
      }
    },

    MemberAccess: (element, acceptor) => {
      const entity = element.entity.ref
      const { type, modifier } = this.semanticReferenceRules(entity?.$type)?.call(this, entity) ?? {}
      if (type) {
        acceptor({
          node: element,
          property: 'entity',
          type,
          modifier,
        })
      }
    },

    FunctionDeclaration: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.function,
        modifier: SemanticTokenModifiers.declaration,
      })
    },

    ClassDeclaration: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.class,
        modifier: SemanticTokenModifiers.declaration,
      })
    },

    TypeParameter: (element, acceptor) => {
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.typeParameter,
        modifier: SemanticTokenModifiers.declaration,
      })
    },

    FieldDeclaration: (element, acceptor) => {
      const modifier = [SemanticTokenModifiers.declaration]
      if (isReadonly(element)) {
        modifier.push(SemanticTokenModifiers.readonly)
      }
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.property,
        modifier,
      })
    },

    VariableDeclaration: (element, acceptor) => {
      const modifier = [SemanticTokenModifiers.declaration]
      if (isReadonly(element)) {
        modifier.push(SemanticTokenModifiers.readonly)
      }
      acceptor({
        node: element,
        property: 'name',
        type: SemanticTokenTypes.variable,
        modifier,
      })
    },
  })

  private readonly semanticReferenceRules = defineRules<SemanticReferenceRuleMap>({
    Script: () => ({
      type: SemanticTokenTypes.namespace,
    }),

    ValueParameter: () => ({
      type: SemanticTokenTypes.parameter,
      modifier: SemanticTokenModifiers.readonly,
    }),

    LoopParameter: () => ({
      type: SemanticTokenTypes.variable,
      modifier: SemanticTokenModifiers.readonly,
    }),

    FunctionDeclaration: () => ({
      type: SemanticTokenTypes.function,
    }),

    ClassDeclaration: () => ({
      type: SemanticTokenTypes.class,
    }),

    ConstructorDeclaration: () => ({
      type: SemanticTokenTypes.class,
    }),

    TypeParameter: () => ({
      type: SemanticTokenTypes.typeParameter,
    }),

    FieldDeclaration: element => ({
      type: SemanticTokenTypes.property,
      modifier: isReadonly(element) ? SemanticTokenModifiers.readonly : undefined,
    }),

    VariableDeclaration: element => ({
      type: SemanticTokenTypes.variable,
      modifier: isReadonly(element) ? SemanticTokenModifiers.readonly : undefined,
    }),

    SyntheticAstNode: ({ content }) => {
      if (isNamespaceNode(content)) {
        return { type: SemanticTokenTypes.namespace }
      }
      else {
        return { type: SemanticTokenTypes.variable }
      }
    },
  })
}
