export function* generateSequence<T>(seed: T | undefined, nextFunction: (currentValue: T) => T | undefined) {
  let current = seed
  while (current !== undefined) {
    yield current
    current = nextFunction(current)
  }
}
