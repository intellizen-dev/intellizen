import type { LangiumDocument, WorkspaceFolder } from 'langium'
import type { ClassDeclaration, ImportDeclaration, NamedType, Script, VariableDeclaration } from '../../../src/generated/ast'
import * as path from 'node:path'
import { URI } from 'langium'
import { NodeFileSystem } from 'langium/node'
import { describe, expect, it } from 'vitest'
import { createZenScriptServices } from '../../../src/module'
import { assertNoErrors } from '../../utils'

const service = createZenScriptServices(NodeFileSystem)

await service.shared.workspace.WorkspaceManager.initializeWorkspace([{
  uri: URI.file(__dirname).toString(),
  name: 'class-type-test',
} as WorkspaceFolder])

function getDocument(docPath: string) {
  return service.shared.workspace.LangiumDocuments.getDocument(URI.file(docPath)) as LangiumDocument<Script>
}

const document_provider_zs = getDocument(path.resolve(__dirname, 'scripts', 'provider.zs'))
const document_user_zs = getDocument(path.resolve(__dirname, 'scripts', 'user.zs'))

const script_provider = document_provider_zs.parseResult.value
const zenclass_alpha = script_provider.classes[0] as ClassDeclaration

const script_user = document_user_zs.parseResult.value
const import_scripts_provider = script_user.imports[0] as ImportDeclaration
const import_scripts_provider_as_supplier = script_user.imports[1] as ImportDeclaration
const import_scripts_provider_alpha = script_user.imports[2] as ImportDeclaration
const import_scripts_provider_alpha_as_beta = script_user.imports[3] as ImportDeclaration
const var_script_be_imported = script_user.statements[0] as VariableDeclaration
const var_script_be_imported_as_alias = script_user.statements[1] as VariableDeclaration
const var_class_be_imported = script_user.statements[2] as VariableDeclaration
const var_class_be_imported_as_alias = script_user.statements[3] as VariableDeclaration

describe('check cross reference of class type', () => {
  it('should no errors', () => {
    assertNoErrors(document_provider_zs)
    assertNoErrors(document_user_zs)
  })

  it('script be imported', () => {
    expect(import_scripts_provider.path[0].ref).toSatisfy(ref => ref.name === 'scripts')
    expect(import_scripts_provider.path[1].ref).toBe(script_provider)
    expect((var_script_be_imported.type as NamedType).path[0].ref).toBe(script_provider)
    expect((var_script_be_imported.type as NamedType).path[1].ref).toBe(zenclass_alpha)
  })

  it('script be imported as alias', () => {
    expect(import_scripts_provider_as_supplier.path[0].ref).toSatisfy(ref => ref.name === 'scripts')
    expect(import_scripts_provider_as_supplier.path[1].ref).toBe(script_provider)
    expect((var_script_be_imported_as_alias.type as NamedType).path[0].ref).toBe(script_provider)
    expect((var_script_be_imported_as_alias.type as NamedType).path[1].ref).toBe(zenclass_alpha)
  })

  it('class be imported', () => {
    expect(import_scripts_provider_alpha.path[0].ref).toSatisfy(ref => ref.name === 'scripts')
    expect(import_scripts_provider_alpha.path[1].ref).toBe(script_provider)
    expect(import_scripts_provider_alpha.path[2].ref).toBe(zenclass_alpha)
    expect((var_class_be_imported.type as NamedType).path[0].ref).toBe(zenclass_alpha)
  })

  it('class be imported as alias', () => {
    expect(import_scripts_provider_alpha_as_beta.path[0].ref).toSatisfy(ref => ref.name === 'scripts')
    expect(import_scripts_provider_alpha_as_beta.path[1].ref).toBe(script_provider)
    expect(import_scripts_provider_alpha_as_beta.path[2].ref).toBe(zenclass_alpha)
    expect((var_class_be_imported_as_alias.type as NamedType).path[0].ref).toBe(zenclass_alpha)
  })
})
