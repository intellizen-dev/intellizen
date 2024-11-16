export function cache<This = unknown, Args extends [WeakKey | undefined, ...any[]] = any>(
  target: (this: This, ...args: Args) => any,
) {
  const cache = new WeakMap<WeakKey, any>()
  return function (this: This, ...args: Args) {
    const [key] = args
    if (key && cache.has(key)) {
      return cache.get(key)
    }
    else {
      const result = target.call(this, ...args)
      if (key && result) {
        cache.set(key, result)
      }
      return result
    }
  }
}
