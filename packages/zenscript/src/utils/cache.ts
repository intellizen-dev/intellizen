import type { LangiumSharedCoreServices } from 'langium'
import { ContextCache as LangiumContextCache } from 'langium'

export class ZenScriptDocumentCache<K, V> extends LangiumContextCache<URI | string, K, V, string> {
  private readonly lastDocumentVersion = new Map<string, number>()
  constructor(sharedServices: LangiumSharedCoreServices) {
    super(uri => uri.toString())

    this.onDispose(sharedServices.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
      const allChangedUris = new Set<string>()
      changed.forEach((uri) => {
        const lastDocumentVersion = this.lastDocumentVersion.get(uri.toString()) ?? 0
        const currentVersion = sharedServices.workspace.LangiumDocuments.getDocument(uri)?.textDocument?.version

        if (!currentVersion) {
          allChangedUris.add(uri.toString())
          return
        }

        if (lastDocumentVersion < currentVersion) {
          allChangedUris.add(uri.toString())
          this.lastDocumentVersion.set(uri.toString(), currentVersion)
        }
      })

      deleted.forEach((uri) => {
        const uriString = uri.toString()
        allChangedUris.add(uriString)
        this.lastDocumentVersion.delete(uriString)
      })

      if (allChangedUris.size === 0) {
        return
      }

      const indexManager = sharedServices.workspace.IndexManager
      sharedServices.workspace.LangiumDocuments.all.forEach((document) => {
        if (indexManager.isAffected(document, allChangedUris)) {
          this.clear(document.uri.toString())
        }
      })
    }))
  }
}
