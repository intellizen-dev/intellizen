type RuleMap = { [K in string]: (source: any, ...rest: any) => any }
type RuleFunction<T extends RuleMap> = (source: any, ...rest: RestParameters<MemberType<T>>) => ReturnType<MemberType<T>> | undefined
type MemberType<T> = T extends { [K in string]: infer V } ? (V extends (source: any, ...rest: any) => any ? V : never) : never
type RestParameters<T> = T extends (head: any, ...tail: infer U) => any ? U : never
type RuleGetter<M extends RuleMap> = ($type: string | undefined) => RuleFunction<M> | undefined

export function defineRules<M extends RuleMap>(
  rules: Partial<M>,
): RuleGetter<M> {
  for (const [$type, ruleFn] of Object.entries(rules)) {
    // assign the name for anonymous rule function
    if (!('name' in ruleFn)) {
      Object.defineProperty(ruleFn, 'name', { value: $type, writable: false })
    }
  }

  return $type => rules[$type as keyof M]
}
