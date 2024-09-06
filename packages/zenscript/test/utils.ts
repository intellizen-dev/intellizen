import { expect } from 'vitest'

import { NodeFileSystem } from 'langium/node'
import { parseHelper } from 'langium/test'
import type { AstNode, LangiumDocument } from 'langium'

import { createIntelliZenServices } from '../src/module'
import type { PrimitiveType, ReferenceType, Script, TypeReference, VariableDeclaration } from '../src/generated/ast'

export function createParseHelper() {
  const service = createIntelliZenServices(NodeFileSystem)
  return parseHelper<Script>(service.intelliZen)
}

export async function assertNoErrors(model: LangiumDocument<Script>) {
  expect(model.parseResult.lexerErrors).toHaveLength(0)
  expect(model.parseResult.parserErrors).toHaveLength(0)

  if (model.diagnostics?.[0]?.data?.code !== 'linking-error') {
    expect(model.diagnostics ?? []).toHaveLength(0)
  }
}

export function expectTypeToBe(matches: string, type?: TypeReference) {
  if (type?.$type === 'PrimitiveType') {
    expect((type as PrimitiveType).value).toBe(matches)
  }
  else if (type?.$type === 'ReferenceType') {
    expect((type as ReferenceType).ref.$refText).toBe(matches)
  }
}

export function assertVariableDeclaration(
  astNode: AstNode,
  prefix: VariableDeclaration['prefix'],
  name: string,
  type?: string,
) {
  expect(astNode.$type).toBe('VariableDeclaration')
  const variableDeclaration = astNode as VariableDeclaration
  expect(variableDeclaration.prefix).toBe(prefix)
  expect(variableDeclaration.name).toBeDefined()
  if (type) {
    expectTypeToBe(type, variableDeclaration.typeRef)
  }
}
