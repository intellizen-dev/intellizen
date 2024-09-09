import { describe, expectTypeOf, it } from 'vitest'
import type { TypeDescription } from '../../src/type-system/descriptions'

describe('type description test', () => {
  it('default type should be any', () => {
    type Type = TypeDescription<'PrimitiveType'>
    expectTypeOf<Type['type']>().toMatchTypeOf<'any'>()
  })

  it('single type should be match', () => {
    type Type = TypeDescription<'PrimitiveType', 'string'>
    expectTypeOf<Type['type']>().toMatchTypeOf<'string'>()
  })

  it('union type should be any', () => {
    type Type = TypeDescription<'PrimitiveType', 'string' | 'long'>
    expectTypeOf<Type['type']>().toMatchTypeOf<'any'>()
  })
})
