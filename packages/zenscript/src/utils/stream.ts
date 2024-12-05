import type { Stream } from 'langium'
import { stream } from 'langium'

export function generateStream<T>(seed: T | undefined, nextFunction: (currentValue: T) => T | undefined): Stream<T> {
  return toStream(function* () {
    let current = seed
    while (current !== undefined) {
      yield current
      current = nextFunction(current)
    }
  })
}

export function toStream<T>(fn: () => Generator<T>): Stream<T> {
  return stream({ [Symbol.iterator]: fn })
}
