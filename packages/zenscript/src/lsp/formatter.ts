import type { DefaultNodeFormatter, FormattingAction, FormattingActionOptions } from 'langium/lsp'
import type { Expression, ZenScriptAstType } from '../generated/ast'
import { type AstNode, AstUtils, GrammarUtils } from 'langium'
import { AbstractFormatter, Formatting } from 'langium/lsp'
import { isAssignment, isBlockStatement, isClassDeclaration, isExpression, isIfStatement, isInfixExpression, isMemberAccess, isPrefixExpression } from '../generated/ast'

type SourceMap = ZenScriptAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K], formatter: DefaultNodeFormatter<SourceMap[K]>) => void }

function indentOnly(): FormattingAction {
  return {
    options: {},
    moves: [
      {
        characters: 0,
        tabs: 1,
      },
    ],
  }
}

export class ZenScriptFormatter extends AbstractFormatter {
  protected format(node: AstNode): void {
    const formatter = this.getNodeFormatter(node)
    // @ts-expect-error allowed index type
    const rule = this.rules[node.$type]

    if (rule) {
      rule.call(this, node as any, formatter)
      return
    }

    if (isExpression(node)) {
      this.formatExpression(node, formatter as DefaultNodeFormatter<Expression>)
    }
  }

  private formatExpression(node: Expression, formatter: DefaultNodeFormatter<Expression>): void {
    if (isInfixExpression(node)) {
      formatter.keyword(node.op).surround(Formatting.fit(Formatting.oneSpace(), Formatting.newLine()))
    }
    if (isAssignment(node)) {
      formatter.keyword(node.op).prepend(Formatting.oneSpace())
        .append(Formatting.fit(Formatting.oneSpace(), Formatting.indent()))
    }
    else if (isPrefixExpression(node)) {
      formatter.keyword(node.op).append(Formatting.noSpace())
    }
  }

  private readonly rules: RuleMap = {
    ImportDeclaration: (node, formatter) => {
      formatter.keywords('import').append(Formatting.oneSpace()).prepend(Formatting.noIndent())
      formatter.keyword(';').append(Formatting.newLine({ allowMore: true })).prepend(Formatting.noSpace())
    },
    FunctionDeclaration: (node, formatter) => {
      formatter.keywords('static', 'global', 'lambda', 'function', 'as')
        .append(Formatting.oneSpace())

      formatter.keyword('(').append(Formatting.noSpace()).prepend(Formatting.noSpace())
      formatter.keyword(')').prepend(Formatting.noSpace())

      formatter.keyword(',').surround(Formatting.oneSpace())
      formatter.keyword('as').surround(Formatting.oneSpace())

      const braceOpen = formatter.keyword('{')
      const braceClose = formatter.keyword('}')

      braceOpen.append(Formatting.newLine({ allowMore: true })).prepend(Formatting.oneSpace())
      braceClose.prepend(Formatting.newLine({ allowMore: true }))
      formatter.interior(braceOpen, braceClose).prepend(Formatting.indent())
    },

    ClassDeclaration: (node, formatter) => {
      formatter.keywords('zenClass').append(Formatting.oneSpace()).prepend(Formatting.noSpace())

      formatter.keyword(';').append(Formatting.newLine({ allowMore: true })).prepend(Formatting.noSpace())

      formatter.keyword(',').surround(Formatting.oneSpace())
      formatter.keyword('as').surround(Formatting.oneSpace())

      const braceOpen = formatter.keyword('{')
      const braceClose = formatter.keyword('}')

      braceOpen.append(Formatting.newLine({ allowMore: true })).prepend(Formatting.oneSpace())
      braceClose.prepend(Formatting.newLine({ allowMore: true }))
      formatter.interior(braceOpen, braceClose).prepend(Formatting.indent())
    },

    VariableDeclaration: (node, formatter) => {
      const prefix = formatter.keywords('var', 'val', 'static', 'global')

      prefix.append(Formatting.oneSpace())

      formatter.keyword(';').append(Formatting.newLine({ allowMore: true })).prepend(Formatting.noSpace())

      if (!isClassDeclaration(node.$container)) {
        prefix.prepend(Formatting.noIndent({ priority: -100 }))
      }
    },

    ExpressionStatement: (node, formatter) => {
      formatter.keyword(';').append(Formatting.newLine({ allowMore: true })).prepend(Formatting.noSpace())

      formatter.node(node).slice(0, 1).prepend(Formatting.noIndent({ priority: -100 }))
    },

    IfStatement: (node, formatter) => {
      formatter.keywords('if').append(Formatting.oneSpace()).prepend(Formatting.noIndent({ priority: -100 }))

      formatter.node(node.condition).append(Formatting.oneSpace()).prepend(Formatting.oneSpace())

      const elseKeyword = formatter.keyword('else')
      elseKeyword.append(Formatting.oneSpace())

      const ifBody = formatter.node(node.ifBody)

      if (isBlockStatement(node.ifBody)) {
        ifBody.prepend(Formatting.oneSpace({ priority: 10 }))
        elseKeyword.prepend(Formatting.fit(Formatting.newLine(), Formatting.oneSpace()))
      }
      else {
        ifBody.prepend(Formatting.fit(Formatting.indent(), Formatting.oneSpace()))
        elseKeyword.prepend(Formatting.newLine())
      }

      if (node.elseBody) {
        const elseBody = formatter.node(node.elseBody)
        if (isBlockStatement(node.elseBody)) {
          elseBody.prepend(Formatting.oneSpace({ priority: 10 }))
        }
        if (isIfStatement(node.elseBody)) {
          const ifCst = GrammarUtils.findNodeForKeyword(node.elseBody.$cstNode, 'if')
          if (ifCst) {
            formatter.cst([ifCst]).prepend(Formatting.oneSpace({ priority: 10 }))
          }
        }
        else {
          elseBody.prepend(Formatting.fit(Formatting.indent(), Formatting
            .oneSpace()))
        }
      }
    },

    WhileStatement: (node, formatter) => {
      formatter.keywords('while').append(Formatting.oneSpace()).prepend(Formatting.noIndent({ priority: -100 }))
    },

    ForStatement: (node, formatter) => {
      formatter.keywords('for').append(Formatting.oneSpace()).prepend(Formatting.noIndent({ priority: -100 }))

      formatter.keyword('in').surround(Formatting.oneSpace())

      formatter.keyword(',').prepend(Formatting.noSpace()).append(Formatting.oneSpace())

      formatter.keyword('{').append(Formatting.newLine({ allowMore: true })).prepend(Formatting.oneSpace())
      formatter.keyword('}').prepend(Formatting.newLine({ allowMore: true }))
      formatter.interior(formatter.keyword('{'), formatter.keyword('}')).prepend(Formatting.indent())
    },

    ReturnStatement: (node, formatter) => {
      const ret = formatter.keywords('return')
      if (node.expr) {
        ret.append(Formatting.oneSpace())
      }
      ret.prepend(Formatting.noIndent({ priority: -100 }))
      formatter.keyword(';').append(Formatting.newLine()).prepend(Formatting.noSpace())
    },

    BreakStatement: (node, formatter) => {
      formatter.keyword('break').append(Formatting.noSpace()).prepend(Formatting.noIndent({ priority: -100 }))
      formatter.keyword(';').append(Formatting.newLine()).prepend(Formatting.noSpace())
    },

    ContinueStatement: (node, formatter) => {
      formatter.keywords('continue').append(Formatting.noSpace()).prepend(Formatting.noIndent({ priority: -100 }))
      formatter.keyword(';').append(Formatting.newLine()).prepend(Formatting.noSpace())
    },

    BlockStatement: (node, formatter) => {
      const braceOpen = formatter.keyword('{')
      const braceClose = formatter.keyword('}')
      if (node.body.length === 0) {
        braceOpen.append(Formatting.noSpace())
        braceClose.prepend(Formatting.noSpace())
        return
      }
      braceOpen.append(Formatting.newLine({ allowMore: true })).prepend(Formatting.oneSpace())
      braceClose.prepend(Formatting.newLine({ allowMore: true }))

      formatter.interior(braceOpen, braceClose).prepend(Formatting.indent({ priority: -10 }))
    },

    ConstructorDeclaration: (node, formatter) => {
      formatter.keywords('zenConstructor').append(Formatting.oneSpace())

      formatter.keyword(';').append(Formatting.newLine({ allowMore: true })).prepend(Formatting.noSpace())

      formatter.keyword(',').prepend(Formatting.noSpace()).append(Formatting.oneSpace())
      formatter.keyword('as').surround(Formatting.oneSpace())

      formatter.keyword('(').append(Formatting.noSpace()).prepend(Formatting.noSpace())
      formatter.keyword(')').prepend(Formatting.noSpace())

      const braceOpen = formatter.keyword('{')
      const braceClose = formatter.keyword('}')

      braceOpen.append(Formatting.newLine({ allowMore: true })).prepend(Formatting.oneSpace())
      braceClose.prepend(Formatting.newLine({ allowMore: true }))
      formatter.interior(braceOpen, braceClose).prepend(Formatting.indent())
    },

    FieldDeclaration: (node, formatter) => {
      formatter.keywords('var', 'val', 'static').append(Formatting.oneSpace())

      formatter.keywords('as', '=').surround(Formatting.oneSpace())

      formatter.keyword(';').append(Formatting.newLine({ allowMore: true })).prepend(Formatting.noSpace())
    },

    ValueParameter: (node, formatter) => {
      formatter.keywords('as', '=').surround(Formatting.oneSpace())
      formatter.keyword('...').append(Formatting.noSpace())
    },

    FunctionExpression: (node, formatter) => {
      formatter.keywords('function').append(Formatting.noSpace())

      formatter.keyword('(').surround(Formatting.noSpace())
      formatter.keyword(')').prepend(Formatting.noSpace())

      formatter.keyword(',').prepend(Formatting.noSpace()).append(Formatting.oneSpace())
      formatter.keyword('as').surround(Formatting.oneSpace())

      const braceOpen = formatter.keyword('{')
      const braceClose = formatter.keyword('}')

      braceOpen.append(Formatting.newLine({ allowMore: true })).prepend(Formatting.oneSpace())
      braceClose.prepend(Formatting.newLine({ allowMore: true }))

      formatter.interior(braceOpen, braceClose).prepend(Formatting.indent({ priority: -10 }))
    },

    CallExpression: (node, formatter) => {
      if (node.arguments.length === 0) {
        formatter.keyword('(').append(Formatting.noSpace())
        formatter.keyword(')').prepend(Formatting.noSpace())
        return
      }

      formatter.keyword(',').prepend(Formatting.noSpace())

      formatter.node(node.arguments[0])
        .slice(0, 1).prepend(Formatting.fit(Formatting.indent({ priority: -10 }), Formatting.noSpace()))

      node.arguments.forEach((arg, index) => {
        if (index === 0) {
          return
        }
        formatter.node(arg).slice(0, 1).prepend(Formatting.fit(Formatting.indent({ priority: -10 }), Formatting.oneSpace()))
      })

      if (isMemberAccess(node.receiver)) {
        const recNode = node.receiver?.$cstNode
        const recCrossLine = recNode && recNode.range.end.line !== recNode.range.start.line
        if (recCrossLine) {
          formatter.keyword('(').append(Formatting.fit(Formatting.indent(), indentOnly()))
          formatter.keyword(')').prepend(Formatting.fit(Formatting.newLine(), Formatting.noSpace()))
          return
        }
      }

      formatter.keyword('(').append(Formatting.fit(Formatting.newLine(), Formatting.noSpace()))
      formatter.keyword(')').prepend(Formatting.fit(Formatting.newLine(), Formatting.noSpace()))
    },

    MemberAccess: (node, formatter) => {
      formatter.keyword('.').append(Formatting.noSpace())
        .prepend(Formatting.fit(Formatting.indent(), Formatting.noSpace()))
    },

    ParenthesizedExpression: (node, formatter) => {
      formatter.keyword('(').append(Formatting.noSpace())
      formatter.keyword(')').prepend(Formatting.noSpace())
    },

    ArrayLiteral: (node, formatter) => {
      // if the literal is empty, we don't want to add a space
      if (node.values.length === 0) {
        formatter.keyword('[').append(Formatting.noSpace())
        formatter.keyword(']').prepend(Formatting.noSpace())
        return
      }

      formatter.keyword(',').prepend(Formatting.noSpace())

      formatter.node(node.values[0])
        .slice(0, 1).prepend(Formatting.fit(Formatting.indent({ priority: -10 }), Formatting.noSpace()))

      node.values.forEach((value, index) => {
        if (index === 0) {
          return
        }
        formatter.node(value).slice(0, 1).prepend(Formatting.fit(Formatting.indent({ priority: -10 }), Formatting.oneSpace()))
      })

      formatter.keyword('[').append(Formatting.fit(Formatting.newLine(), Formatting.noSpace()))
      formatter.keyword(']').prepend(Formatting.fit(Formatting.newLine(), Formatting.noSpace()))
    },

    MapLiteral: (node, formatter) => {
      // if the literal is empty, we don't want to add a space
      if (node.entries.length === 0) {
        formatter.keyword('{').append(Formatting.noSpace())
        formatter.keyword('}').prepend(Formatting.noSpace())
        return
      }

      formatter.keyword(',').prepend(Formatting.noSpace())

      formatter.node(node.entries[0])
        .slice(0, 1).prepend(Formatting.fit(Formatting.indent({ priority: -10 }), Formatting.noSpace()))

      node.entries.forEach((entry, index) => {
        if (index === 0) {
          return
        }
        formatter.node(entry).slice(0, 1).prepend(Formatting.fit(Formatting.indent({ priority: -10 }), Formatting.oneSpace()))
      })

      formatter.keyword('{').append(Formatting.fit(Formatting.newLine(), Formatting.oneSpace()))
      formatter.keyword('}').prepend(Formatting.fit(Formatting.newLine(), Formatting.oneSpace()))
    },

    MapEntry: (node, formatter) => {
      formatter.keyword(':').prepend(Formatting.noSpace()).append(Formatting.oneSpace())
    },

  }
}
