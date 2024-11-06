import type { Stream } from 'langium'
import { stream } from 'langium'

export function generateStream<T>(seed: T | undefined, nextFunction: (currentValue: T) => T | undefined): Stream<T> {
  const generator = function* (seed: T | undefined, nextFunction: (currentValue: T) => T | undefined) {
    let current = seed
    while (current !== undefined) {
      yield current
      current = nextFunction(current)
    }
  }
  return stream(generator(seed, nextFunction))
}
