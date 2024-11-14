import type { ForStatement } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContextCache } from '../../../src/utils/cache'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe('check inferring for-array', async () => {
  const document_array_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'array.zs'))
  const script_array_zs = document_array_zs.parseResult.value
  const statement_for_value_in_array = script_array_zs.statements[1] as ForStatement
  const statement_for_index_value_in_array = script_array_zs.statements[2] as ForStatement

  it('should no errors', () => {
    assertNoErrors(document_array_zs)
  })

  it('check "for value in array"', () => {
    const parameter_value = statement_for_value_in_array.parameters[0]
    const type_value = services.typing.TypeComputer.inferType(parameter_value, new ContextCache())
    expect(type_value?.toString()).toBe('string')
  })

  it('check "for index, value in array"', () => {
    const parameter_index = statement_for_index_value_in_array.parameters[0]
    const parameter_value = statement_for_index_value_in_array.parameters[1]
    const type_index = services.typing.TypeComputer.inferType(parameter_index, new ContextCache())
    const type_value = services.typing.TypeComputer.inferType(parameter_value, new ContextCache())
    expect(type_index?.toString()).toBe('int')
    expect(type_value?.toString()).toBe('string')
  })
})

describe('check inferring for-list', async () => {
  const document_list_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'list.zs'))
  const script_list_zs = document_list_zs.parseResult.value
  const statement_for_value_in_list = script_list_zs.statements[1] as ForStatement
  const statement_for_index_value_in_list = script_list_zs.statements[2] as ForStatement

  it('should no errors', () => {
    assertNoErrors(document_list_zs)
  })

  it('check "for value in list"', () => {
    const parameter_value = statement_for_value_in_list.parameters[0]
    const type_value = services.typing.TypeComputer.inferType(parameter_value, new ContextCache())
    expect(type_value?.toString()).toBe('string')
  })

  it('check "for index, value in list"', () => {
    const parameter_index = statement_for_index_value_in_list.parameters[0]
    const parameter_value = statement_for_index_value_in_list.parameters[1]
    const type_index = services.typing.TypeComputer.inferType(parameter_index, new ContextCache())
    const type_value = services.typing.TypeComputer.inferType(parameter_value, new ContextCache())
    expect(type_index?.toString()).toBe('int')
    expect(type_value?.toString()).toBe('string')
  })
})

describe('check inferring for-map', async () => {
  const document_map_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'map.zs'))
  const script_map_zs = document_map_zs.parseResult.value
  const statement_for_key_in_map = script_map_zs.statements[1] as ForStatement
  const statement_for_key_value_in_map = script_map_zs.statements[2] as ForStatement

  it('should no errors', () => {
    assertNoErrors(document_map_zs)
  })

  it('check "for key in map" ', () => {
    const parameter_key = statement_for_key_in_map.parameters[0]
    const type_key = services.typing.TypeComputer.inferType(parameter_key, new ContextCache())
    expect(type_key?.toString()).toBe('string')
  })

  it('check "for key, value in map" ', () => {
    const parameter_key = statement_for_key_value_in_map.parameters[0]
    const parameter_value = statement_for_key_value_in_map.parameters[1]
    const type_key = services.typing.TypeComputer.inferType(parameter_key, new ContextCache())
    const type_value = services.typing.TypeComputer.inferType(parameter_value, new ContextCache())
    expect(type_key?.toString()).toBe('string')
    expect(type_value?.toString()).toBe('int')
  })
})
