export class WorkspaceCache<C extends WeakKey = object, K extends WeakKey = object, V = any> {
  private readonly contexts: WeakMap<C, WeakMap<K, V>> = new WeakMap()

  get(context: C): WeakMap<K, V> {
    if (this.contexts.has(context)) {
      return this.contexts.get(context)!
    }
    else {
      const cache = new WeakMap()
      this.contexts.set(context, cache)
      return cache
    }
  }
}
