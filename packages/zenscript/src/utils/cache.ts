import { ContextCache, SimpleCache } from 'langium'

export class WorkspaceCache extends SimpleCache<object, ContextCache<object, any, any>> {
  constructor() {
    super()
    // @ts-expect-error replace with WeakMap
    this.cache = new WeakMap()
  }

  get(key: object) {
    return super.get(key, () => new ContextCache())
  }
}
