export function substringAfterLast(str: string, delimiter: string): string {
  return str.substring(str.lastIndexOf(delimiter) + 1)
}

export function substringBeforeLast(str: string, delimiter: string): string {
  return str.substring(0, str.lastIndexOf(delimiter))
}
