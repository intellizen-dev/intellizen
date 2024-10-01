import { describe, expect, it } from 'vitest'

import { createParseHelper } from '../utils'

const parse = createParseHelper()

async function parseModel(input: string) {
  return parse(input, { validation: true })
}

describe('check error with ZenScript', () => {
  it('missing semicolon', async () => {
    const model = await parseModel('val a as int')
    expect(model.parseResult.lexerErrors).toHaveLength(0)
    expect(model.parseResult.parserErrors).toHaveLength(1)
  })
})
