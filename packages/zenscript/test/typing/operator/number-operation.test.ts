import type { ExpressionStatement } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe(`check operation of byte`, async () => {
  const document_byte_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'byte.zs'))
  const script_byte_zs = document_byte_zs.parseResult.value
  let line = 0

  it('syntax', () => {
    assertNoErrors(document_byte_zs)
  })

  it('unary', () => {
    const expr_neg = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_neg = services.typing.TypeComputer.inferType(expr_neg)
    expect(type_neg?.toString()).toBe('byte')

    const expr_not = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_not = services.typing.TypeComputer.inferType(expr_not)
    expect(type_not?.toString()).toBe('byte')
  })

  it('binary', () => {
    // region Arithmetic
    const expr_and = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_and = services.typing.TypeComputer.inferType(expr_and)
    expect(type_and?.toString()).toBe('byte')

    const expr_or = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_or = services.typing.TypeComputer.inferType(expr_or)
    expect(type_or?.toString()).toBe('byte')

    const expr_xor = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_xor = services.typing.TypeComputer.inferType(expr_xor)
    expect(type_xor?.toString()).toBe('byte')

    const expr_add = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_add = services.typing.TypeComputer.inferType(expr_add)
    expect(type_add?.toString()).toBe('byte')

    const expr_sub = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_sub = services.typing.TypeComputer.inferType(expr_sub)
    expect(type_sub?.toString()).toBe('byte')

    const expr_mul = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_mul = services.typing.TypeComputer.inferType(expr_mul)
    expect(type_mul?.toString()).toBe('byte')

    const expr_div = (script_byte_zs.statements[++line] as ExpressionStatement).expr
    const type_div = services.typing.TypeComputer.inferType(expr_div)
    expect(type_div?.toString()).toBe('byte')

    const expr_mod = (script_byte_zs.statements[10] as ExpressionStatement).expr
    const type_mod = services.typing.TypeComputer.inferType(expr_mod)
    expect(type_mod?.toString()).toBe('byte')
    // endregion

    // region Comparison
    const expr_lt = (script_byte_zs.statements[11] as ExpressionStatement).expr
    const type_lt = services.typing.TypeComputer.inferType(expr_lt)
    expect(type_lt?.toString()).toBe('bool')

    const expr_gt = (script_byte_zs.statements[12] as ExpressionStatement).expr
    const type_gt = services.typing.TypeComputer.inferType(expr_gt)
    expect(type_gt?.toString()).toBe('bool')

    const expr_le = (script_byte_zs.statements[13] as ExpressionStatement).expr
    const type_le = services.typing.TypeComputer.inferType(expr_le)
    expect(type_le?.toString()).toBe('bool')

    const expr_ge = (script_byte_zs.statements[14] as ExpressionStatement).expr
    const type_ge = services.typing.TypeComputer.inferType(expr_ge)
    expect(type_ge?.toString()).toBe('bool')

    const expr_eq = (script_byte_zs.statements[15] as ExpressionStatement).expr
    const type_eq = services.typing.TypeComputer.inferType(expr_eq)
    expect(type_eq?.toString()).toBe('bool')

    const expr_nq = (script_byte_zs.statements[16] as ExpressionStatement).expr
    const type_ne = services.typing.TypeComputer.inferType(expr_nq)
    expect(type_ne?.toString()).toBe('bool')
    // endregion
  })
})

describe(`check operation of short`, async () => {
  const document_short_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'short.zs'))
  const script_short_zs = document_short_zs.parseResult.value
  let line = 0

  it('syntax', () => {
    assertNoErrors(document_short_zs)
  })

  it('unary', () => {
    const expr_neg = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_neg = services.typing.TypeComputer.inferType(expr_neg)
    expect(type_neg?.toString()).toBe('short')

    const expr_not = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_not = services.typing.TypeComputer.inferType(expr_not)
    expect(type_not?.toString()).toBe('short')
  })

  it('binary', () => {
    // region Arithmetic
    const expr_and = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_and = services.typing.TypeComputer.inferType(expr_and)
    expect(type_and?.toString()).toBe('short')

    const expr_or = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_or = services.typing.TypeComputer.inferType(expr_or)
    expect(type_or?.toString()).toBe('short')

    const expr_xor = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_xor = services.typing.TypeComputer.inferType(expr_xor)
    expect(type_xor?.toString()).toBe('short')

    const expr_add = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_add = services.typing.TypeComputer.inferType(expr_add)
    expect(type_add?.toString()).toBe('short')

    const expr_sub = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_sub = services.typing.TypeComputer.inferType(expr_sub)
    expect(type_sub?.toString()).toBe('short')

    const expr_mul = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_mul = services.typing.TypeComputer.inferType(expr_mul)
    expect(type_mul?.toString()).toBe('short')

    const expr_div = (script_short_zs.statements[++line] as ExpressionStatement).expr
    const type_div = services.typing.TypeComputer.inferType(expr_div)
    expect(type_div?.toString()).toBe('short')

    const expr_mod = (script_short_zs.statements[10] as ExpressionStatement).expr
    const type_mod = services.typing.TypeComputer.inferType(expr_mod)
    expect(type_mod?.toString()).toBe('short')
    // endregion

    // region Comparison
    const expr_lt = (script_short_zs.statements[11] as ExpressionStatement).expr
    const type_lt = services.typing.TypeComputer.inferType(expr_lt)
    expect(type_lt?.toString()).toBe('bool')

    const expr_gt = (script_short_zs.statements[12] as ExpressionStatement).expr
    const type_gt = services.typing.TypeComputer.inferType(expr_gt)
    expect(type_gt?.toString()).toBe('bool')

    const expr_le = (script_short_zs.statements[13] as ExpressionStatement).expr
    const type_le = services.typing.TypeComputer.inferType(expr_le)
    expect(type_le?.toString()).toBe('bool')

    const expr_ge = (script_short_zs.statements[14] as ExpressionStatement).expr
    const type_ge = services.typing.TypeComputer.inferType(expr_ge)
    expect(type_ge?.toString()).toBe('bool')

    const expr_eq = (script_short_zs.statements[15] as ExpressionStatement).expr
    const type_eq = services.typing.TypeComputer.inferType(expr_eq)
    expect(type_eq?.toString()).toBe('bool')

    const expr_nq = (script_short_zs.statements[16] as ExpressionStatement).expr
    const type_ne = services.typing.TypeComputer.inferType(expr_nq)
    expect(type_ne?.toString()).toBe('bool')
    // endregion
  })
})

describe(`check operation of int`, async () => {
  const document_int_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'int.zs'))
  const script_int_zs = document_int_zs.parseResult.value
  let line = 0

  it('syntax', () => {
    assertNoErrors(document_int_zs)
  })

  it('unary', () => {
    const expr_neg = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_neg = services.typing.TypeComputer.inferType(expr_neg)
    expect(type_neg?.toString()).toBe('int')

    const expr_not = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_not = services.typing.TypeComputer.inferType(expr_not)
    expect(type_not?.toString()).toBe('int')
  })

  it('binary', () => {
    // region Arithmetic
    const expr_and = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_and = services.typing.TypeComputer.inferType(expr_and)
    expect(type_and?.toString()).toBe('int')

    const expr_or = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_or = services.typing.TypeComputer.inferType(expr_or)
    expect(type_or?.toString()).toBe('int')

    const expr_xor = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_xor = services.typing.TypeComputer.inferType(expr_xor)
    expect(type_xor?.toString()).toBe('int')

    const expr_add = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_add = services.typing.TypeComputer.inferType(expr_add)
    expect(type_add?.toString()).toBe('int')

    const expr_sub = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_sub = services.typing.TypeComputer.inferType(expr_sub)
    expect(type_sub?.toString()).toBe('int')

    const expr_mul = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_mul = services.typing.TypeComputer.inferType(expr_mul)
    expect(type_mul?.toString()).toBe('int')

    const expr_div = (script_int_zs.statements[++line] as ExpressionStatement).expr
    const type_div = services.typing.TypeComputer.inferType(expr_div)
    expect(type_div?.toString()).toBe('int')

    const expr_mod = (script_int_zs.statements[10] as ExpressionStatement).expr
    const type_mod = services.typing.TypeComputer.inferType(expr_mod)
    expect(type_mod?.toString()).toBe('int')
    // endregion

    // region Comparison
    const expr_lt = (script_int_zs.statements[11] as ExpressionStatement).expr
    const type_lt = services.typing.TypeComputer.inferType(expr_lt)
    expect(type_lt?.toString()).toBe('bool')

    const expr_gt = (script_int_zs.statements[12] as ExpressionStatement).expr
    const type_gt = services.typing.TypeComputer.inferType(expr_gt)
    expect(type_gt?.toString()).toBe('bool')

    const expr_le = (script_int_zs.statements[13] as ExpressionStatement).expr
    const type_le = services.typing.TypeComputer.inferType(expr_le)
    expect(type_le?.toString()).toBe('bool')

    const expr_ge = (script_int_zs.statements[14] as ExpressionStatement).expr
    const type_ge = services.typing.TypeComputer.inferType(expr_ge)
    expect(type_ge?.toString()).toBe('bool')

    const expr_eq = (script_int_zs.statements[15] as ExpressionStatement).expr
    const type_eq = services.typing.TypeComputer.inferType(expr_eq)
    expect(type_eq?.toString()).toBe('bool')

    const expr_nq = (script_int_zs.statements[16] as ExpressionStatement).expr
    const type_ne = services.typing.TypeComputer.inferType(expr_nq)
    expect(type_ne?.toString()).toBe('bool')
    // endregion
  })
})

describe(`check operation of long`, async () => {
  const document_long_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'long.zs'))
  const script_long_zs = document_long_zs.parseResult.value
  let line = 0

  it('syntax', () => {
    assertNoErrors(document_long_zs)
  })

  it('unary', () => {
    const expr_neg = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_neg = services.typing.TypeComputer.inferType(expr_neg)
    expect(type_neg?.toString()).toBe('long')

    const expr_not = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_not = services.typing.TypeComputer.inferType(expr_not)
    expect(type_not?.toString()).toBe('long')
  })

  it('binary', () => {
    // region Arithmetic
    const expr_and = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_and = services.typing.TypeComputer.inferType(expr_and)
    expect(type_and?.toString()).toBe('long')

    const expr_or = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_or = services.typing.TypeComputer.inferType(expr_or)
    expect(type_or?.toString()).toBe('long')

    const expr_xor = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_xor = services.typing.TypeComputer.inferType(expr_xor)
    expect(type_xor?.toString()).toBe('long')

    const expr_add = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_add = services.typing.TypeComputer.inferType(expr_add)
    expect(type_add?.toString()).toBe('long')

    const expr_sub = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_sub = services.typing.TypeComputer.inferType(expr_sub)
    expect(type_sub?.toString()).toBe('long')

    const expr_mul = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_mul = services.typing.TypeComputer.inferType(expr_mul)
    expect(type_mul?.toString()).toBe('long')

    const expr_div = (script_long_zs.statements[++line] as ExpressionStatement).expr
    const type_div = services.typing.TypeComputer.inferType(expr_div)
    expect(type_div?.toString()).toBe('long')

    const expr_mod = (script_long_zs.statements[10] as ExpressionStatement).expr
    const type_mod = services.typing.TypeComputer.inferType(expr_mod)
    expect(type_mod?.toString()).toBe('long')
    // endregion

    // region Comparison
    const expr_lt = (script_long_zs.statements[11] as ExpressionStatement).expr
    const type_lt = services.typing.TypeComputer.inferType(expr_lt)
    expect(type_lt?.toString()).toBe('bool')

    const expr_gt = (script_long_zs.statements[12] as ExpressionStatement).expr
    const type_gt = services.typing.TypeComputer.inferType(expr_gt)
    expect(type_gt?.toString()).toBe('bool')

    const expr_le = (script_long_zs.statements[13] as ExpressionStatement).expr
    const type_le = services.typing.TypeComputer.inferType(expr_le)
    expect(type_le?.toString()).toBe('bool')

    const expr_ge = (script_long_zs.statements[14] as ExpressionStatement).expr
    const type_ge = services.typing.TypeComputer.inferType(expr_ge)
    expect(type_ge?.toString()).toBe('bool')

    const expr_eq = (script_long_zs.statements[15] as ExpressionStatement).expr
    const type_eq = services.typing.TypeComputer.inferType(expr_eq)
    expect(type_eq?.toString()).toBe('bool')

    const expr_nq = (script_long_zs.statements[16] as ExpressionStatement).expr
    const type_ne = services.typing.TypeComputer.inferType(expr_nq)
    expect(type_ne?.toString()).toBe('bool')
    // endregion
  })
})

describe(`check operation of float`, async () => {
  const document_float_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'float.zs'))
  const script_float_zs = document_float_zs.parseResult.value
  let line = 0

  it('syntax', () => {
    assertNoErrors(document_float_zs)
  })

  it('unary', () => {
    const expr_neg = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_neg = services.typing.TypeComputer.inferType(expr_neg)
    expect(type_neg?.toString()).toBe('float')
  })

  it('binary', () => {
    // region Arithmetic
    const expr_add = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_add = services.typing.TypeComputer.inferType(expr_add)
    expect(type_add?.toString()).toBe('float')

    const expr_sub = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_sub = services.typing.TypeComputer.inferType(expr_sub)
    expect(type_sub?.toString()).toBe('float')

    const expr_mul = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_mul = services.typing.TypeComputer.inferType(expr_mul)
    expect(type_mul?.toString()).toBe('float')

    const expr_div = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_div = services.typing.TypeComputer.inferType(expr_div)
    expect(type_div?.toString()).toBe('float')

    const expr_mod = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_mod = services.typing.TypeComputer.inferType(expr_mod)
    expect(type_mod?.toString()).toBe('float')
    // endregion

    // region Comparison
    const expr_lt = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_lt = services.typing.TypeComputer.inferType(expr_lt)
    expect(type_lt?.toString()).toBe('bool')

    const expr_gt = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_gt = services.typing.TypeComputer.inferType(expr_gt)
    expect(type_gt?.toString()).toBe('bool')

    const expr_le = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_le = services.typing.TypeComputer.inferType(expr_le)
    expect(type_le?.toString()).toBe('bool')

    const expr_ge = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_ge = services.typing.TypeComputer.inferType(expr_ge)
    expect(type_ge?.toString()).toBe('bool')

    const expr_eq = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_eq = services.typing.TypeComputer.inferType(expr_eq)
    expect(type_eq?.toString()).toBe('bool')

    const expr_nq = (script_float_zs.statements[++line] as ExpressionStatement).expr
    const type_ne = services.typing.TypeComputer.inferType(expr_nq)
    expect(type_ne?.toString()).toBe('bool')
    // endregion
  })
})

describe(`check operation of double`, async () => {
  const document_double_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'double.zs'))
  const script_double_zs = document_double_zs.parseResult.value
  let line = 0

  it('syntax', () => {
    assertNoErrors(document_double_zs)
  })

  it('unary', () => {
    const expr_neg = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_neg = services.typing.TypeComputer.inferType(expr_neg)
    expect(type_neg?.toString()).toBe('double')
  })

  it('binary', () => {
    // region Arithmetic
    const expr_add = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_add = services.typing.TypeComputer.inferType(expr_add)
    expect(type_add?.toString()).toBe('double')

    const expr_sub = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_sub = services.typing.TypeComputer.inferType(expr_sub)
    expect(type_sub?.toString()).toBe('double')

    const expr_mul = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_mul = services.typing.TypeComputer.inferType(expr_mul)
    expect(type_mul?.toString()).toBe('double')

    const expr_div = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_div = services.typing.TypeComputer.inferType(expr_div)
    expect(type_div?.toString()).toBe('double')

    const expr_mod = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_mod = services.typing.TypeComputer.inferType(expr_mod)
    expect(type_mod?.toString()).toBe('double')
    // endregion

    // region Comparison
    const expr_lt = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_lt = services.typing.TypeComputer.inferType(expr_lt)
    expect(type_lt?.toString()).toBe('bool')

    const expr_gt = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_gt = services.typing.TypeComputer.inferType(expr_gt)
    expect(type_gt?.toString()).toBe('bool')

    const expr_le = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_le = services.typing.TypeComputer.inferType(expr_le)
    expect(type_le?.toString()).toBe('bool')

    const expr_ge = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_ge = services.typing.TypeComputer.inferType(expr_ge)
    expect(type_ge?.toString()).toBe('bool')

    const expr_eq = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_eq = services.typing.TypeComputer.inferType(expr_eq)
    expect(type_eq?.toString()).toBe('bool')

    const expr_nq = (script_double_zs.statements[++line] as ExpressionStatement).expr
    const type_ne = services.typing.TypeComputer.inferType(expr_nq)
    expect(type_ne?.toString()).toBe('bool')
    // endregion
  })
})
