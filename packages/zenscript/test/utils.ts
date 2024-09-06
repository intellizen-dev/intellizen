import { NodeFileSystem } from 'langium/node'
import { parseHelper } from 'langium/test'

import { expect } from 'vitest'
import type { LangiumDocument } from 'langium'
import type { PrimitiveType, ReferenceType, Script, TypeReference } from '../src/generated/ast'
import { createIntelliZenServices } from '../src/module'

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
