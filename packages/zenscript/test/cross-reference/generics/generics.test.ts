import path from 'node:path'
import { NodeFileSystem } from 'langium/node'
import type { LangiumDocument, WorkspaceFolder } from 'langium'
import { URI } from 'langium'
import { describe, it } from 'vitest'
import { createZenScriptServices } from '../../../src/module'
import type { Script } from '../../../src/generated/ast'
import { assertNoErrors } from '../../utils'

const service = createZenScriptServices(NodeFileSystem)

await service.shared.workspace.WorkspaceManager.initializeWorkspace([{
  uri: URI.file(__dirname).toString(),
  name: 'class-type-test',
} as WorkspaceFolder])

function getDocument(docPath: string) {
  return service.shared.workspace.LangiumDocuments.getDocument(URI.file(docPath)) as LangiumDocument<Script>
}

const document_test_zs = getDocument(path.resolve(__dirname, 'scripts', 'test.zs'))

describe('generics', () => {
  it('test', () => {
    assertNoErrors(document_test_zs)
  })
})
