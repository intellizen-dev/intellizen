export class WorkspaceCache {
  private readonly contexts: WeakMap<object, WeakMap<any, any>> = new WeakMap()

  get(context: object): WeakMap<any, any> {
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
