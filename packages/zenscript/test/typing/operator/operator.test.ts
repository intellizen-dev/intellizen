import type { ExpressionStatement } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it, suite } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)
const inferType = services.typing.TypeComputer.inferType.bind(services.typing.TypeComputer)

describe('check operation of bool', async () => {
  const document_bool_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'bool.zs'))
  const script_bool_zs = document_bool_zs.parseResult.value
  let line = 0
  const next = () => (script_bool_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_bool_zs)
  })

  suite('logical', () => {
    it('!', () => {
      const type_not = inferType(next())
      expect(type_not?.toString()).toBe('bool')
    })
  })

  suite('bitwise', () => {
    it('&', () => {
      const type_and = inferType(next())
      expect(type_and?.toString()).toBe('bool')
    })

    it('|', () => {
      const type_or = inferType(next())
      expect(type_or?.toString()).toBe('bool')
    })

    it('^', () => {
      const type_xor = inferType(next())
      expect(type_xor?.toString()).toBe('bool')
    })
  })

  suite('comparison', () => {
    it('==', () => {
      const type_eq = inferType(next())
      expect(type_eq?.toString()).toBe('bool')
    })

    it('!=', () => {
      const type_ne = inferType(next())
      expect(type_ne?.toString()).toBe('bool')
    })
  })
})

describe('check operation of string', async () => {
  const document_string_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'string.zs'))
  const script_string_zs = document_string_zs.parseResult.value
  let line = 0
  const next = () => (script_string_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_string_zs)
  })

  suite('binary', () => {
    it('+', () => {
      const type_has = inferType(next())
      expect(type_has?.toString()).toBe('string')
    })

    it('has', () => {
      const type_has = inferType(next())
      expect(type_has?.toString()).toBe('bool')
    })

    it('[]', () => {
      const type_index_get = inferType(next())
      expect(type_index_get?.toString()).toBe('string')
    })

    it('==', () => {
      const type_eq = inferType(next())
      expect(type_eq?.toString()).toBe('bool')
    })

    it('!=', () => {
      const type_ne = inferType(next())
      expect(type_ne?.toString()).toBe('bool')
    })
  })
})

describe(`check operation of byte`, async () => {
  const document_byte_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'byte.zs'))
  const script_byte_zs = document_byte_zs.parseResult.value
  let line = 0
  const next = () => (script_byte_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_byte_zs)
  })

  suite('unary', () => {
    it('-', () => {
      const type_neg = inferType(next())
      expect(type_neg?.toString()).toBe('byte')
    })

    it('!', () => {
      const type_not = inferType(next())
      expect(type_not?.toString()).toBe('byte')
    })
  })

  suite('binary', () => {
    suite('bitwise', () => {
      it('&', () => {
        const type_and = inferType(next())
        expect(type_and?.toString()).toBe('byte')
      })

      it('|', () => {
        const type_or = inferType(next())
        expect(type_or?.toString()).toBe('byte')
      })

      it('^', () => {
        const type_xor = inferType(next())
        expect(type_xor?.toString()).toBe('byte')
      })
    })

    suite('arithmetic', () => {
      it('+', () => {
        const type_add = inferType(next())
        expect(type_add?.toString()).toBe('byte')
      })

      it('-', () => {
        const type_sub = inferType(next())
        expect(type_sub?.toString()).toBe('byte')
      })

      it('*', () => {
        const type_mul = inferType(next())
        expect(type_mul?.toString()).toBe('byte')
      })

      it('/', () => {
        const type_div = inferType(next())
        expect(type_div?.toString()).toBe('byte')
      })

      it('%', () => {
        const type_mod = inferType(next())
        expect(type_mod?.toString()).toBe('byte')
      })
    })

    suite('comparison', () => {
      it('<', () => {
        const type_lt = inferType(next())
        expect(type_lt?.toString()).toBe('bool')
      })

      it('>', () => {
        const type_gt = inferType(next())
        expect(type_gt?.toString()).toBe('bool')
      })

      it('<=', () => {
        const type_le = inferType(next())
        expect(type_le?.toString()).toBe('bool')
      })

      it('>=', () => {
        const type_ge = inferType(next())
        expect(type_ge?.toString()).toBe('bool')
      })

      it('==', () => {
        const type_eq = inferType(next())
        expect(type_eq?.toString()).toBe('bool')
      })

      it('!=', () => {
        const type_ne = inferType(next())
        expect(type_ne?.toString()).toBe('bool')
      })
    })
  })
})

describe(`check operation of short`, async () => {
  const document_short_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'short.zs'))
  const script_short_zs = document_short_zs.parseResult.value
  let line = 0
  const next = () => (script_short_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_short_zs)
  })

  suite('unary', () => {
    it('-', () => {
      const type_neg = inferType(next())
      expect(type_neg?.toString()).toBe('short')
    })

    it('!', () => {
      const type_not = inferType(next())
      expect(type_not?.toString()).toBe('short')
    })
  })

  suite('binary', () => {
    suite('bitwise', () => {
      it('&', () => {
        const type_and = inferType(next())
        expect(type_and?.toString()).toBe('short')
      })

      it('|', () => {
        const type_or = inferType(next())
        expect(type_or?.toString()).toBe('short')
      })

      it('^', () => {
        const type_xor = inferType(next())
        expect(type_xor?.toString()).toBe('short')
      })
    })

    suite('arithmetic', () => {
      it('+', () => {
        const type_add = inferType(next())
        expect(type_add?.toString()).toBe('short')
      })

      it('-', () => {
        const type_sub = inferType(next())
        expect(type_sub?.toString()).toBe('short')
      })

      it('*', () => {
        const type_mul = inferType(next())
        expect(type_mul?.toString()).toBe('short')
      })

      it('/', () => {
        const type_div = inferType(next())
        expect(type_div?.toString()).toBe('short')
      })

      it('%', () => {
        const type_mod = inferType(next())
        expect(type_mod?.toString()).toBe('short')
      })
    })

    suite('comparison', () => {
      it('<', () => {
        const type_lt = inferType(next())
        expect(type_lt?.toString()).toBe('bool')
      })

      it('>', () => {
        const type_gt = inferType(next())
        expect(type_gt?.toString()).toBe('bool')
      })

      it('<=', () => {
        const type_le = inferType(next())
        expect(type_le?.toString()).toBe('bool')
      })

      it('>=', () => {
        const type_ge = inferType(next())
        expect(type_ge?.toString()).toBe('bool')
      })

      it('==', () => {
        const type_eq = inferType(next())
        expect(type_eq?.toString()).toBe('bool')
      })

      it('!=', () => {
        const type_ne = inferType(next())
        expect(type_ne?.toString()).toBe('bool')
      })
    })
  })
})

describe(`check operation of int`, async () => {
  const document_int_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'int.zs'))
  const script_int_zs = document_int_zs.parseResult.value
  let line = 0
  const next = () => (script_int_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_int_zs)
  })

  suite('unary', () => {
    it('-', () => {
      const type_neg = inferType(next())
      expect(type_neg?.toString()).toBe('int')
    })

    it('!', () => {
      const type_not = inferType(next())
      expect(type_not?.toString()).toBe('int')
    })
  })

  suite('binary', () => {
    suite('bitwise', () => {
      it('&', () => {
        const type_and = inferType(next())
        expect(type_and?.toString()).toBe('int')
      })

      it('|', () => {
        const type_or = inferType(next())
        expect(type_or?.toString()).toBe('int')
      })

      it('^', () => {
        const type_xor = inferType(next())
        expect(type_xor?.toString()).toBe('int')
      })
    })

    suite('arithmetic', () => {
      it('+', () => {
        const type_add = inferType(next())
        expect(type_add?.toString()).toBe('int')
      })

      it('-', () => {
        const type_sub = inferType(next())
        expect(type_sub?.toString()).toBe('int')
      })

      it('*', () => {
        const type_mul = inferType(next())
        expect(type_mul?.toString()).toBe('int')
      })

      it('/', () => {
        const type_div = inferType(next())
        expect(type_div?.toString()).toBe('int')
      })

      it('%', () => {
        const type_mod = inferType(next())
        expect(type_mod?.toString()).toBe('int')
      })
    })

    suite('comparison', () => {
      it('<', () => {
        const type_lt = inferType(next())
        expect(type_lt?.toString()).toBe('bool')
      })

      it('>', () => {
        const type_gt = inferType(next())
        expect(type_gt?.toString()).toBe('bool')
      })

      it('<=', () => {
        const type_le = inferType(next())
        expect(type_le?.toString()).toBe('bool')
      })

      it('>=', () => {
        const type_ge = inferType(next())
        expect(type_ge?.toString()).toBe('bool')
      })

      it('==', () => {
        const type_eq = inferType(next())
        expect(type_eq?.toString()).toBe('bool')
      })

      it('!=', () => {
        const type_ne = inferType(next())
        expect(type_ne?.toString()).toBe('bool')
      })
    })
  })
})

describe(`check operation of long`, async () => {
  const document_long_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'long.zs'))
  const script_long_zs = document_long_zs.parseResult.value
  let line = 0
  const next = () => (script_long_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_long_zs)
  })

  suite('unary', () => {
    it('-', () => {
      const type_neg = inferType(next())
      expect(type_neg?.toString()).toBe('long')
    })

    it('!', () => {
      const type_not = inferType(next())
      expect(type_not?.toString()).toBe('long')
    })
  })

  suite('binary', () => {
    suite('bitwise', () => {
      it('&', () => {
        const type_and = inferType(next())
        expect(type_and?.toString()).toBe('long')
      })

      it('|', () => {
        const type_or = inferType(next())
        expect(type_or?.toString()).toBe('long')
      })

      it('^', () => {
        const type_xor = inferType(next())
        expect(type_xor?.toString()).toBe('long')
      })
    })

    suite('arithmetic', () => {
      it('+', () => {
        const type_add = inferType(next())
        expect(type_add?.toString()).toBe('long')
      })

      it('-', () => {
        const type_sub = inferType(next())
        expect(type_sub?.toString()).toBe('long')
      })

      it('*', () => {
        const type_mul = inferType(next())
        expect(type_mul?.toString()).toBe('long')
      })

      it('/', () => {
        const type_div = inferType(next())
        expect(type_div?.toString()).toBe('long')
      })

      it('%', () => {
        const type_mod = inferType(next())
        expect(type_mod?.toString()).toBe('long')
      })
    })

    suite('comparison', () => {
      it('<', () => {
        const type_lt = inferType(next())
        expect(type_lt?.toString()).toBe('bool')
      })

      it('>', () => {
        const type_gt = inferType(next())
        expect(type_gt?.toString()).toBe('bool')
      })

      it('<=', () => {
        const type_le = inferType(next())
        expect(type_le?.toString()).toBe('bool')
      })

      it('>=', () => {
        const type_ge = inferType(next())
        expect(type_ge?.toString()).toBe('bool')
      })

      it('==', () => {
        const type_eq = inferType(next())
        expect(type_eq?.toString()).toBe('bool')
      })

      it('!=', () => {
        const type_ne = inferType(next())
        expect(type_ne?.toString()).toBe('bool')
      })
    })
  })
})

describe(`check operation of float`, async () => {
  const document_float_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'float.zs'))
  const script_float_zs = document_float_zs.parseResult.value
  let line = 0
  const next = () => (script_float_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_float_zs)
  })

  suite('unary', () => {
    it('-', () => {
      const type_neg = inferType(next())
      expect(type_neg?.toString()).toBe('float')
    })
  })

  suite('binary', () => {
    suite('arithmetic', () => {
      it('+', () => {
        const type_add = inferType(next())
        expect(type_add?.toString()).toBe('float')
      })

      it('-', () => {
        const type_sub = inferType(next())
        expect(type_sub?.toString()).toBe('float')
      })

      it('*', () => {
        const type_mul = inferType(next())
        expect(type_mul?.toString()).toBe('float')
      })

      it('/', () => {
        const type_div = inferType(next())
        expect(type_div?.toString()).toBe('float')
      })

      it('%', () => {
        const type_mod = inferType(next())
        expect(type_mod?.toString()).toBe('float')
      })
    })

    suite('comparison', () => {
      it('<', () => {
        const type_lt = inferType(next())
        expect(type_lt?.toString()).toBe('bool')
      })

      it('>', () => {
        const type_gt = inferType(next())
        expect(type_gt?.toString()).toBe('bool')
      })

      it('<=', () => {
        const type_le = inferType(next())
        expect(type_le?.toString()).toBe('bool')
      })

      it('>=', () => {
        const type_ge = inferType(next())
        expect(type_ge?.toString()).toBe('bool')
      })

      it('==', () => {
        const type_eq = inferType(next())
        expect(type_eq?.toString()).toBe('bool')
      })

      it('!=', () => {
        const type_ne = inferType(next())
        expect(type_ne?.toString()).toBe('bool')
      })
    })
  })
})

describe(`check operation of double`, async () => {
  const document_double_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'double.zs'))
  const script_double_zs = document_double_zs.parseResult.value
  let line = 0
  const next = () => (script_double_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_double_zs)
  })

  suite('unary', () => {
    it('-', () => {
      const type_neg = inferType(next())
      expect(type_neg?.toString()).toBe('double')
    })
  })

  suite('binary', () => {
    suite('arithmetic', () => {
      it('+', () => {
        const type_add = inferType(next())
        expect(type_add?.toString()).toBe('double')
      })

      it('-', () => {
        const type_sub = inferType(next())
        expect(type_sub?.toString()).toBe('double')
      })

      it('*', () => {
        const type_mul = inferType(next())
        expect(type_mul?.toString()).toBe('double')
      })

      it('/', () => {
        const type_div = inferType(next())
        expect(type_div?.toString()).toBe('double')
      })

      it('%', () => {
        const type_mod = inferType(next())
        expect(type_mod?.toString()).toBe('double')
      })
    })

    suite('comparison', () => {
      it('<', () => {
        const type_lt = inferType(next())
        expect(type_lt?.toString()).toBe('bool')
      })

      it('>', () => {
        const type_gt = inferType(next())
        expect(type_gt?.toString()).toBe('bool')
      })

      it('<=', () => {
        const type_le = inferType(next())
        expect(type_le?.toString()).toBe('bool')
      })

      it('>=', () => {
        const type_ge = inferType(next())
        expect(type_ge?.toString()).toBe('bool')
      })

      it('==', () => {
        const type_eq = inferType(next())
        expect(type_eq?.toString()).toBe('bool')
      })

      it('!=', () => {
        const type_ne = inferType(next())
        expect(type_ne?.toString()).toBe('bool')
      })
    })
  })
})

describe('check operation of array', async () => {
  const document_array_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'array.zs'))
  const script_array_zs = document_array_zs.parseResult.value
  let line = 0
  const next = () => (script_array_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_array_zs)
  })

  suite('binary', () => {
    it('has', () => {
      const type_has = inferType(next())
      expect(type_has?.toString()).toBe('bool')
    })

    it('[]', () => {
      const type_index_get = inferType(next())
      expect(type_index_get?.toString()).toBe('long')
    })

    it('+=', () => {
      const type_add = inferType(next())
      expect(type_add?.toString()).toBe('void')
    })
  })

  suite('ternary', () => {
    it('[]=', () => {
      const type_index_set = inferType(next())
      expect(type_index_set?.toString()).toBe('void')
    })
  })
})

describe('check operation of list', async () => {
  const document_list_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'list.zs'))
  const script_list_zs = document_list_zs.parseResult.value
  let line = 0
  const next = () => (script_list_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_list_zs)
  })

  suite('binary', () => {
    it('has', () => {
      const type_has = inferType(next())
      expect(type_has?.toString()).toBe('bool')
    })

    it('[]', () => {
      const type_index_get = inferType(next())
      expect(type_index_get?.toString()).toBe('long')
    })

    it('+=', () => {
      const type_add = inferType(next())
      expect(type_add?.toString()).toBe('void')
    })
  })

  suite('ternary', () => {
    it('[]=', () => {
      const type_index_set = inferType(next())
      expect(type_index_set?.toString()).toBe('void')
    })
  })
})

describe('check operation of map', async () => {
  const document_map_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'map.zs'))
  const script_map_zs = document_map_zs.parseResult.value
  let line = 0
  const next = () => (script_map_zs.statements[++line] as ExpressionStatement).expr

  it('syntax', () => {
    assertNoErrors(document_map_zs)
  })

  suite('binary', () => {
    it('has', () => {
      const type_has = inferType(next())
      expect(type_has?.toString()).toBe('bool')
    })

    it('[]', () => {
      const type_index_get = inferType(next())
      expect(type_index_get?.toString()).toBe('long')
    })

    it('.', () => {
      const type_add = inferType(next())
      expect(type_add?.toString()).toBe('long')
    })
  })

  suite('ternary', () => {
    it('[]=', () => {
      const type_index_set = inferType(next())
      expect(type_index_set?.toString()).toBe('void')
    })
  })
})
