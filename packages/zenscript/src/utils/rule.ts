type RestParameters<T> = T extends (first: any, ...rest: infer U) => any ? U : never
type RuleFunctionMatches = { [K in string]: (...args: any) => any }
type MemberType<T> = T extends { [K in string]: infer V } ? (V extends (...args: any) => any ? V : never) : never
type UncheckedRuleFunction<T extends RuleFunctionMatches> = (source: any, ...rest: RestParameters<MemberType<T>>) => ReturnType<MemberType<T>> | undefined

export function defineRules<T extends RuleFunctionMatches>(
  thisObj: any,
  rules: Partial<T>,
): ($type: string | undefined) => { call: UncheckedRuleFunction<T> } {
  // rules is a map of lambdas, assign each lambda a name to be able to call it
  // this is a bit of a hack, but it works
  for (const [$type, rule] of Object.entries(rules)) {
    Object.defineProperty(rule, 'name', { value: $type, writable: false })
  }

  return (type?: string) => ({
    call: (source, ...rest) => {
      const rule = rules[type as keyof T]
      return rule?.call(thisObj, source, ...rest)
    },
  })
}
