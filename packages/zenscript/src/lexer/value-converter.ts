import type { CstNode, GrammarAST, ValueType } from 'langium'
import { DefaultValueConverter } from 'langium'

export class CustomValueConverter extends DefaultValueConverter {
  protected override runConverter(rule: GrammarAST.AbstractRule, input: string, cstNode: CstNode): ValueType {
    if (rule.name === 'TEMPLATE_LITERAL_START' || rule.name === 'TEMPLATE_LITERAL_MIDDLE') {
      return convertString(input, 1, 2)
    }
    if (rule.name.startsWith('TEMPLATE_LITERAL') || rule.name === 'STRING') {
      return convertString(input, 1, 1)
    }
    else {
      return super.runConverter(rule, input, cstNode)
    }
  }
}

function convertEscapeCharacter(char: string): string {
  switch (char) {
    case 'b': return '\b'
    case 'f': return '\f'
    case 'n': return '\n'
    case 'r': return '\r'
    case 't': return '\t'
    default: return char
  }
}

function convertUnicodeEscape(input: string, start: number): [string, number] {
  if (input.length < start + 4) {
    return ['', input.length]
  }
  const code = input.substring(start, start + 4)
  const charCode = Number.parseInt(code, 16)
  if (Number.isNaN(charCode)) {
    return ['', start + 4]
  }

  return [String.fromCharCode(charCode), start + 4]
}

function convertString(input: string, skipFirst: number, skipLast: number): string {
  let result = ''
  for (let i = skipFirst; i < input.length - skipLast; i++) {
    const c = input.charAt(i)
    if (c === '\\') {
      const c1 = input.charAt(++i)
      if (c1 === 'u') {
        const [unicodeChar, nextIndex] = convertUnicodeEscape(input, i + 1)
        result += unicodeChar
        i = nextIndex - 1
      }
      else {
        result += convertEscapeCharacter(c1)
      }
    }
    else {
      result += c
    }
  }
  return result
}
