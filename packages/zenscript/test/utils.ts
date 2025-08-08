import type { AstNode, LangiumDocument, WorkspaceFolder } from 'langium'
import type { Expression, NamedType, ReferenceExpression, Script, Type, VariableDeclaration } from '../src/generated/ast'
import type { ZenScriptServices } from '../src/module'
import { URI, UriUtils } from 'langium'
import { NodeFileSystem } from 'langium/node'
import { expect } from 'vitest'
import { isNamedType, isVariableDeclaration } from '../src/generated/ast'
import { createZenScriptServices } from '../src/module'

export function createTestParser() {
  const services = createZenScriptServices(NodeFileSystem)
  const documentBuilder = services.shared.workspace.DocumentBuilder
  let nextDocumentId = 0
  return async (input: string, options?: { ext?: string, rule?: string, validation?: boolean }) => {
    const { ext = services.LanguageMetaData.fileExtensions[0], rule, validation = false } = options ?? {}
    const uri = URI.parse(`file:///${nextDocumentId++}${ext}`)
    const document = services.shared.workspace.LangiumDocumentFactory.fromString(input, uri, { rule })
    services.shared.workspace.LangiumDocuments.addDocument(document)
    await documentBuilder.build([document], { validation })
    return document
  }
}

export async function createTestServicesWithWorkspace(testingPath: string) {
  const service = createZenScriptServices(NodeFileSystem)
  const testingUri = URI.file(testingPath)
  const folder = {
    uri: testingUri.toString(),
    name: UriUtils.basename(testingUri),
  }
  await service.shared.workspace.WorkspaceManager.initializeWorkspace([folder as WorkspaceFolder])
  return service
}

export async function getDocument(services: ZenScriptServices, docPath: string) {
  return services.shared.workspace.LangiumDocuments.getDocument(URI.file(docPath)) as LangiumDocument<Script>
}

export async function assertNoErrors(model: LangiumDocument<Script>) {
  expect(model).toBeDefined()
  if (model.parseResult.lexerErrors.length > 0)
    console.error(model.parseResult.lexerErrors)
  expect(model.parseResult.lexerErrors).toHaveLength(0)

  if (model.parseResult.parserErrors.length > 0)
    console.error(model.parseResult.parserErrors)
  expect(model.parseResult.parserErrors).toHaveLength(0)

  if (model.diagnostics?.[0]?.data?.code !== 'linking-error') {
    if (model.diagnostics?.length)
      console.error(model.diagnostics)
    expect(model.diagnostics ?? []).toHaveLength(0)
  }
}

export function assertClassTypeReference(type: Type | undefined, qualifiedName: string) {
  expect(isNamedType(type))
  expect((type as NamedType).path.map(p => p.$refText).join('.')).toBe(qualifiedName)
}

export function assertVariableDeclaration(astNode: AstNode, options: {
  variance: VariableDeclaration['variance']
  name: string
}) {
  const variableDecl = astNode as VariableDeclaration
  expect(isVariableDeclaration(variableDecl))
  expect(variableDecl.variance).toBe(options.variance)
  expect(variableDecl.name).toBe(options.name)
}

export function assertReferenceExpressionText(expr: Expression, matches: string | RegExp) {
  expect(expr.$type).toBe('ReferenceExpression')
  if (typeof matches === 'string')
    expect((expr as ReferenceExpression).entity.$refText).toBe(matches)
  else
    expect((expr as ReferenceExpression).entity.$refText).toMatch(matches)
}
