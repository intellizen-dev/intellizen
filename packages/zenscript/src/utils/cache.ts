import type { LangiumSharedCoreServices } from 'langium'
import { ContextCache, SimpleCache, stream } from 'langium'

export class WorkspaceCache extends SimpleCache<object, ContextCache<object, any, any>> {
  constructor(services: LangiumSharedCoreServices) {
    super()
    this.onDispose(services.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
      if (deleted.length > 0) {
        this.clear()
      }
      else if (stream(changed)
        .map(it => services.workspace.LangiumDocuments.getDocument(it)!)
        .some(it => it.textDocument.version > 1)) {
        this.clear()
      }
    }))
  }

  get(key: object) {
    return super.get(key, () => new ContextCache())
  }
}
