import type { IMultiModeLexerDefinition, TokenType, TokenVocabulary } from 'chevrotain'
import { DefaultTokenBuilder, type GrammarAST, isTokenTypeArray } from 'langium'

const REGULAR_MODE = 'regular_mode'
const TEMPLATE_MODE = 'template_mode'

export class CustomTokenBuilder extends DefaultTokenBuilder {
  override buildTokens(grammar: GrammarAST.Grammar, options?: { caseInsensitive?: boolean }): TokenVocabulary {
    const tokenTypes = super.buildTokens(grammar, options)

    if (isTokenTypeArray(tokenTypes)) {
      // Regular mode just drops template literal middle & end
      const regularModeTokens = tokenTypes
        .filter(token => !['TEMPLATE_LITERAL_MIDDLE', 'TEMPLATE_LITERAL_END'].includes(token.name))
      // Template mode needs to exclude the '}' keyword
      const templateModeTokens = tokenTypes
        .filter(token => !['}'].includes(token.name))

      const multiModeLexerDef: IMultiModeLexerDefinition = {
        modes: {
          [REGULAR_MODE]: regularModeTokens,
          [TEMPLATE_MODE]: templateModeTokens,
        },
        defaultMode: REGULAR_MODE,
      }
      return multiModeLexerDef
    }
    else {
      throw new Error('Invalid token vocabulary received from DefaultTokenBuilder!')
    }
  }

  protected override buildKeywordToken(
    keyword: GrammarAST.Keyword,
    terminalTokens: TokenType[],
    caseInsensitive: boolean,
  ): TokenType {
    const tokenType = super.buildKeywordToken(keyword, terminalTokens, caseInsensitive)

    if (tokenType.name === '}') {
      // The default } token will use [TEMPLATE_LITERAL_MIDDLE, TEMPLATE_LITERAL_END] as longer alts
      // We need to delete the LONGER_ALT, they are not valid for the regular lexer mode
      delete tokenType.LONGER_ALT
    }
    return tokenType
  }

  protected override buildTerminalToken(terminal: GrammarAST.TerminalRule): TokenType {
    const tokenType = super.buildTerminalToken(terminal)

    // Update token types to enter & exit template mode
    if (tokenType.name === 'TEMPLATE_LITERAL_START') {
      tokenType.PUSH_MODE = TEMPLATE_MODE
    }
    else if (tokenType.name === 'TEMPLATE_LITERAL_END') {
      tokenType.POP_MODE = true
    }
    return tokenType
  }
}
