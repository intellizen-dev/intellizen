type RestParameters<T> = T extends (first: any, ...rest: infer U) => any ? U : never

type RuleFunctionMatches = { [K in string]: (...args: any) => any }
type MemeberType<T> = T extends { [K in string]: infer V } ? (V extends (...args: any) => any ? V : never) : never

type UncheckedRuleFunction<T extends RuleFunctionMatches> = (source: any, ...rest: RestParameters<MemeberType<T>>) => ReturnType<MemeberType<T>> | undefined

export function defineRules<T extends RuleFunctionMatches>(
  thisObj: any,
  rules: Partial<T>,
): (type?: string) => { call: UncheckedRuleFunction<T> } {
  // rules is a map of lambdas, assign each lambda a name to be able to call it
  // this is a bit of a hack, but it works
  for (const [key, value] of Object.entries(rules)) {
    Object.defineProperty(value, 'name', { value: key, writable: false })
  }

  return (type?: string) => {
    return {
      call: (source, ...rest) => {
        const rule = rules[type as keyof T]
        return rule?.call(thisObj, source, ...rest)
      },
    }
  }
}
