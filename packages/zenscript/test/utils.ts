import { expect } from 'vitest'

import { NodeFileSystem } from 'langium/node'
import { parseHelper } from 'langium/test'
import type { AstNode, LangiumDocument } from 'langium'
import { createZenScriptServices } from '../src/module'
import type { ClassTypeReference, Expression, ReferenceExpression, Script, TypeReference, VariableDeclaration } from '../src/generated/ast'
import { isClassTypeReference, isVariableDeclaration } from '../src/generated/ast'

export function createParseHelper() {
  const service = createZenScriptServices(NodeFileSystem)
  return parseHelper<Script>(service)
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

export function assertClassTypeReference(type: TypeReference | undefined, qualifiedName: string) {
  expect(isClassTypeReference(type))
  expect((type as ClassTypeReference).path.map(p => p.$refText).join('.')).toBe(qualifiedName)
}

export function assertVariableDeclaration(astNode: AstNode, options: {
  prefix: VariableDeclaration['prefix']
  name: string
}) {
  const variableDecl = astNode as VariableDeclaration
  expect(isVariableDeclaration(variableDecl))
  expect(variableDecl.prefix).toBe(options.prefix)
  expect(variableDecl.name).toBe(options.name)
}

export function assertReferenceExpressionText(expr: Expression, matches: string | RegExp) {
  expect(expr.$type).toBe('ReferenceExpression')
  if (typeof matches === 'string')
    expect((expr as ReferenceExpression).target.$refText).toBe(matches)
  else
    expect((expr as ReferenceExpression).target.$refText).toMatch(matches)
}
