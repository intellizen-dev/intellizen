import type { MapLiteral, UnquotedString, VariableDeclaration } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContextCache } from '../../../src/utils/cache'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe(`check unquoted string in map literal`, async () => {
  const document_map_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'map.zs'))
  const script_map_zs = document_map_zs.parseResult.value
  const statement_val_map = script_map_zs.statements[0] as VariableDeclaration
  const expression_map_literal = statement_val_map.initializer as MapLiteral

  it('should no errors', () => {
    assertNoErrors(document_map_zs)
  })

  it('check inferring unquoted string', () => {
    const unquotedString = expression_map_literal.entries[0].key as UnquotedString
    const type = services.typing.TypeComputer.inferType(unquotedString, new ContextCache())
    expect(type?.toString()).toBe('string')
  })
})
