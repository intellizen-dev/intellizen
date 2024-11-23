type RuleMap = { [K in string]: (source: any, ...rest: any) => any }
type RuleGetter<M extends RuleMap> = ($type: string | undefined) => RuleFunction<M> | undefined
type RuleFunction<M extends RuleMap> = (source: any, ...rest: RestParameters<RuleFunctionType<M>>) => ReturnType<RuleFunctionType<M>>

type RestParameters<T> = T extends (source: any, ...rest: infer U) => any ? U : never
type RuleFunctionType<T> = T extends { [K in string]: infer V } ? (V extends (source: any, ...rest: any) => any ? V : never) : never

export function defineRules<M extends RuleMap>(rules: Partial<M>): RuleGetter<M> {
  // assign the name for anonymous rule function
  for (const [$type, ruleFn] of Object.entries(rules)) {
    if (!('name' in ruleFn)) {
      Object.defineProperty(ruleFn, 'name', { value: $type, writable: false })
    }
  }

  return $type => rules[$type as keyof M]
}
