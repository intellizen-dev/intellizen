import type { CstNode, GrammarAST, ValueType } from 'langium'
import { DefaultValueConverter, ValueConverter } from 'langium'

export class CustomValueConverter extends DefaultValueConverter {
  protected override runConverter(rule: GrammarAST.AbstractRule, input: string, cstNode: CstNode): ValueType {
    if (rule.name.startsWith('TEMPLATE_LITERAL')) {
      // 'convertString' simply removes the first and last character of the input
      return ValueConverter.convertString(input)
    }
    else {
      return super.runConverter(rule, input, cstNode)
    }
  }
}
