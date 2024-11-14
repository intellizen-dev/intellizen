import type { AstNode, LangiumSharedCoreServices } from 'langium'
import { AstUtils, ContextCache as LangiumContextCache, stream } from 'langium'

export class ZenScriptDocumentCache<K, V> extends LangiumContextCache<URI | string, K, V, string> {
  constructor(sharedServices: LangiumSharedCoreServices) {
    super(uri => uri.toString())
    this.onDispose(sharedServices.workspace.DocumentBuilder.onUpdate((changed, deleted) => {
      const allChangedUris = stream(changed).concat(deleted).map(uri => uri.toString()).toSet()
      const indexManager = sharedServices.workspace.IndexManager
      sharedServices.workspace.LangiumDocuments.all.forEach((document) => {
        if (indexManager.isAffected(document, allChangedUris)) {
          this.clear(document.uri.toString())
        }
      })

    }))
  }
}

export function getAstCache<V>(cache: ZenScriptDocumentCache<AstNode, V>, node: AstNode | undefined, provider: (node: AstNode | undefined) => V): V {
  if(!node) {
    return provider(node)
  }
  const uri = AstUtils.findRootNode(node)?.$document?.uri?.toString()
  if (!uri) {
    return provider(node)
  }
  
  if(!cache.has(uri, node)) {
    cache.set(uri, node, provider(node))
  }

  return cache.get(uri, node)!
}
