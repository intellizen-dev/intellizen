import type { Stream } from 'langium'
import { stream } from 'langium'
import { generateSequence } from '@intellizen/shared'

export function generateStream<T>(seed: T | undefined, nextFunction: (currentValue: T) => T | undefined): Stream<T> {
  return stream(generateSequence(seed, nextFunction))
}
