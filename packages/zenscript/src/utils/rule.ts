type RuleMap = { [K in string]: (source: any, ...rest: any) => any }
type RuleFunction<T extends RuleMap> = (source: any, ...rest: RestParameters<MemberType<T>>) => ReturnType<MemberType<T>> | undefined
type MemberType<T> = T extends { [K in string]: infer V } ? (V extends (source: any, ...rest: any) => any ? V : never) : never
type RestParameters<T> = T extends (head: any, ...tail: infer U) => any ? U : never

export function defineRules<T extends RuleMap>(
  thisObj: unknown,
  rules: Partial<T>,
): ($type: string | undefined) => { call: RuleFunction<T> } {
  // rules is a map of lambdas, assign each lambda a name to be able to call it
  // this is a bit of a hack, but it works
  for (const [$type, rule] of Object.entries(rules)) {
    Object.defineProperty(rule, 'name', { value: $type, writable: false })
  }

  return $type => ({
    call: (source, ...rest) => {
      const rule = rules[$type as keyof T]
      return rule?.call(thisObj, source, ...rest)
    },
  })
}
