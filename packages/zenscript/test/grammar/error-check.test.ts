import { describe, expect, it } from 'vitest'
import { createTestParser } from '../utils'

const parse = createTestParser()

describe('check error with ZenScript', () => {
  it('missing semicolon', async () => {
    const model = await parse('val a as int', { validation: true })
    expect(model.parseResult.lexerErrors).toHaveLength(0)
    expect(model.parseResult.parserErrors).toHaveLength(1)
  })
})
