import type { LangiumDocument } from 'langium'
import type { ClassDeclaration, ImportDeclaration, NamedType, Script, VariableDeclaration } from '../../../src/generated/ast'
import type { SyntheticAstNode } from '../../../src/reference/synthetic'
import type { NamespaceNode } from '../../../src/utils/namespace-tree'
import * as path from 'node:path'
import { URI } from 'langium'
import { describe, expect, it } from 'vitest'
import { isScript } from '../../../src/generated/ast'
import { isSyntheticAstNode } from '../../../src/reference/synthetic'
import { isNamespaceNode } from '../../../src/utils/namespace-tree'
import { assertNoErrors, createTestServicesWithWorkspace } from '../../utils'

const service = await createTestServicesWithWorkspace(__dirname)

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
    // import scripts.provider;
    // -- scripts
    const ref_scripts = import_scripts_provider.path[0].ref as unknown as SyntheticAstNode
    expect(isSyntheticAstNode(ref_scripts)).toBeTruthy()
    expect(isNamespaceNode(ref_scripts.content)).toBeTruthy()
    expect((ref_scripts.content as NamespaceNode<unknown>).name).toBe('scripts')

    // -- provider
    const ref_provider = import_scripts_provider.path[1].ref as Script
    expect(isScript(ref_provider)).toBeTruthy()
    expect(ref_provider).toBe(script_provider)

    // var script_be_imported as provider.Alpha;
    // -- provider
    const ref_provider_imp = (var_script_be_imported.type as NamedType).path[0].ref as ImportDeclaration
    expect(ref_provider_imp).toBe(import_scripts_provider)

    // -- Alpha
    const ref_alpha = (var_script_be_imported.type as NamedType).path[1].ref as ClassDeclaration
    expect(ref_alpha).toBe(zenclass_alpha)
  })

  it('script be imported as alias', () => {
    // import scripts.provider as supplier;
    // -- scripts
    const ref_scripts = import_scripts_provider_as_supplier.path[0].ref as unknown as SyntheticAstNode
    expect(isSyntheticAstNode(ref_scripts)).toBeTruthy()
    expect(isNamespaceNode(ref_scripts.content)).toBeTruthy()
    expect((ref_scripts.content as NamespaceNode<unknown>).name).toBe('scripts')

    // -- provider
    const ref_provider = import_scripts_provider_as_supplier.path[1].ref as Script
    expect(isScript(ref_provider)).toBeTruthy()
    expect(ref_provider).toBe(script_provider)

    // var script_be_imported_as_alias as supplier.Alpha;
    // -- supplier
    const ref_supplier = (var_script_be_imported_as_alias.type as NamedType).path[0].ref
    expect(ref_supplier).toBe(import_scripts_provider_as_supplier)

    // -- Alpha
    const ref_alpha = (var_script_be_imported_as_alias.type as NamedType).path[1].ref
    expect(ref_alpha).toBe(zenclass_alpha)
  })

  it('class be imported', () => {
    // import scripts.provider.Alpha;
    // -- scripts
    const ref_scripts = import_scripts_provider_alpha.path[0].ref as unknown as SyntheticAstNode
    expect(isSyntheticAstNode(ref_scripts)).toBeTruthy()
    expect(isNamespaceNode(ref_scripts.content)).toBeTruthy()
    expect((ref_scripts.content as NamespaceNode<unknown>).name).toBe('scripts')

    // -- provider
    const ref_provider = import_scripts_provider_alpha.path[1].ref
    expect(isScript(ref_provider)).toBeTruthy()
    expect(ref_provider).toBe(script_provider)

    // -- Alpha
    const ref_alpha = import_scripts_provider_alpha.path[2].ref
    expect(ref_alpha).toBe(zenclass_alpha)

    // var class_be_imported as Alpha;
    // -- Alpha
    const ref_alpha_imp = (var_class_be_imported.type as NamedType).path[0].ref as ImportDeclaration
    expect(ref_alpha_imp).toBe(import_scripts_provider_alpha)
  })

  it('class be imported as alias', () => {
    // import scripts.provider.Alpha as Beta;
    // -- scripts
    const ref_scripts = import_scripts_provider_alpha.path[0].ref as unknown as SyntheticAstNode
    expect(isSyntheticAstNode(ref_scripts)).toBeTruthy()
    expect(isNamespaceNode(ref_scripts.content)).toBeTruthy()
    expect((ref_scripts.content as NamespaceNode<unknown>).name).toBe('scripts')

    // -- provider
    const ref_provider = import_scripts_provider_alpha.path[1].ref
    expect(isScript(ref_provider)).toBeTruthy()
    expect(ref_provider).toBe(script_provider)

    // -- Alpha
    const ref_alpha = import_scripts_provider_alpha.path[2].ref
    expect(ref_alpha).toBe(zenclass_alpha)

    // var class_be_imported_as_alias as Beta;
    // -- Beta
    const ref_beta = (var_class_be_imported_as_alias.type as NamedType).path[0].ref
    expect(ref_beta).toBe(import_scripts_provider_alpha_as_beta)
  })
})
