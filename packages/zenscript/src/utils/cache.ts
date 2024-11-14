import { ContextCache as LangiumContextCache, WorkspaceCache as LangiumWorkspaceCache } from 'langium'

export class ContextCache extends LangiumContextCache<object, any, any> {}

export class WorkspaceCache extends LangiumWorkspaceCache<object, ContextCache> {
  get(key: object): ContextCache {
    return super.get(key, () => new ContextCache())
  }
}
