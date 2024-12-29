import type { BuildOptions, LangiumDocument, URI } from 'langium'
import { DefaultDocumentBuilder, DocumentState, interruptAndCheck, stream } from 'langium'
import { CancellationToken } from 'vscode-languageserver'

export class ZenScriptDocumentBuilder extends DefaultDocumentBuilder {
  /* eslint-disable no-console */
  protected async buildDocuments(documents: LangiumDocument[], options: BuildOptions, cancelToken: CancellationToken): Promise<void> {
    console.log(`Building ${documents.length} documents`)
    console.group()

    console.time('Prepare done')
    this.prepareBuild(documents, options)
    console.timeEnd('Prepare done')

    console.time('Parse done')
    await this.runCancelable(documents, DocumentState.Parsed, cancelToken, doc =>
      this.langiumDocumentFactory.update(doc, cancelToken))
    console.timeEnd('Parse done')

    console.time('Compute exports done')
    await this.runCancelable(documents, DocumentState.IndexedContent, cancelToken, doc =>
      this.indexManager.updateContent(doc, cancelToken))
    console.timeEnd('Compute exports done')

    console.time('Compute scope done')
    await this.runCancelable(documents, DocumentState.ComputedScopes, cancelToken, async (doc) => {
      const scopeComputation = this.serviceRegistry.getServices(doc.uri).references.ScopeComputation
      doc.precomputedScopes = await scopeComputation.computeLocalScopes(doc, cancelToken)
    })
    console.timeEnd('Compute scope done')

    console.time('Link done')
    await this.runCancelable(documents, DocumentState.Linked, cancelToken, (doc) => {
      const linker = this.serviceRegistry.getServices(doc.uri).references.Linker
      return linker.link(doc, cancelToken)
    })
    console.timeEnd('Link done')

    console.time('Index references done')
    await this.runCancelable(documents, DocumentState.IndexedReferences, cancelToken, doc =>
      this.indexManager.updateReferences(doc, cancelToken))
    console.timeEnd('Index references done')

    console.time('Validation done')
    const toBeValidated = documents.filter(doc => this.shouldValidate(doc))
    await this.runCancelable(toBeValidated, DocumentState.Validated, cancelToken, doc =>
      this.validate(doc, cancelToken))
    console.timeEnd('Validation done')

    console.groupEnd()

    // If we've made it to this point without being cancelled, we can mark the build state as completed.
    for (const doc of documents) {
      const state = this.buildState.get(doc.uri.toString())
      if (state) {
        state.completed = true
      }
    }
  }

  async update(changed: URI[], deleted: URI[], cancelToken = CancellationToken.None): Promise<void> {
    this.currentState = DocumentState.Changed
    // Remove all metadata of documents that are reported as deleted
    for (const deletedUri of deleted) {
      this.langiumDocuments.deleteDocument(deletedUri)
      this.buildState.delete(deletedUri.toString())
      this.indexManager.remove(deletedUri)
    }
    // Set the state of all changed documents to `Changed` so they are completely rebuilt
    for (const changedUri of changed) {
      const invalidated = this.langiumDocuments.invalidateDocument(changedUri)
      if (!invalidated) {
        // We create an unparsed, invalid document.
        // This will be parsed as soon as we reach the first document builder phase.
        // This allows to cancel the parsing process later in case we need it.
        const newDocument = this.langiumDocumentFactory.fromModel({ $type: 'INVALID' }, changedUri)
        newDocument.state = DocumentState.Changed
        this.langiumDocuments.addDocument(newDocument)
      }
      this.buildState.delete(changedUri.toString())
    }
    // Set the state of all documents that should be relinked (if not already lower)
    console.time('Relink done')
    const changedUris = stream(changed, deleted).map(uri => uri.toString()).toSet()
    const linkedDocs = this.langiumDocuments.all.filter(doc => doc.state >= DocumentState.Linked)
    for (const doc of linkedDocs) {
      const linker = this.serviceRegistry.getServices(doc.uri).references.Linker
      linker.relink(doc, changedUris)
    }
    console.timeEnd('Relink done')

    // Notify listeners of the update
    await this.emitUpdate(changed, deleted)
    // Only allow interrupting the execution after all state changes are done
    await interruptAndCheck(cancelToken)

    // Collect and sort all documents that we should rebuild
    const rebuildDocuments = this.sortDocuments(
      this.langiumDocuments.all
        .filter(doc =>
        // This includes those that were reported as changed and those that we selected for relinking
          doc.state <= DocumentState.Linked
          // This includes those for which a previous build has been cancelled
          || !this.buildState.get(doc.uri.toString())?.completed,
        )
        .toArray(),
    )
    await this.buildDocuments(rebuildDocuments, this.updateBuildOptions, cancelToken)
  }
}
