import { expect } from 'vitest'

import { NodeFileSystem } from 'langium/node'
import { parseHelper } from 'langium/test'
import type { AstNode, LangiumDocument } from 'langium'

import { createIntelliZenServices } from '../src/module'
import type { ClassType, Expression, LocalVariable, PrimitiveType, Script, TypeReference, VariableDeclaration } from '../src/generated/ast'

export function createParseHelper() {
  const service = createIntelliZenServices(NodeFileSystem)
  return parseHelper<Script>(service.intelliZen)
}

export async function assertNoErrors(model: LangiumDocument<Script>) {
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

export function assertTypeRef(matches: string, type?: TypeReference) {
  if (type?.$type === 'PrimitiveType') {
    expect((type as PrimitiveType).value).toBe(matches)
  }
  else if (type?.$type === 'ClassType') {
    expect((type as ClassType).refer.$refText).toBe(matches)
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
  expect(variableDeclaration.name).toBe(name)
  if (type) {
    assertTypeRef(type, variableDeclaration.typeRef)
  }
}

export function assertLocalVariableText(expr: Expression, matches: string | RegExp) {
  expect(expr.$type).toBe('LocalVariable')
  if (typeof matches === 'string')
    expect((expr as LocalVariable).refer.$refText).toBe(matches)
  else
    expect((expr as LocalVariable).refer.$refText).toMatch(matches)
}
