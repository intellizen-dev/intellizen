import type { LangiumDocument } from 'langium'
import type { Script } from '../generated/ast'
import { substringBeforeLast } from '@intellizen/shared'
import { UriUtils } from 'langium'

export function isZs(document: LangiumDocument): boolean {
  return UriUtils.extname(document.uri) === '.zs'
}

export function isDzs(document: LangiumDocument): boolean {
  return UriUtils.extname(document.uri) === '.dzs'
}

export function getName(document: LangiumDocument): string {
  const baseName = UriUtils.basename(document.uri)
  return substringBeforeLast(baseName, '.')
}

export function getQualifiedName(document: LangiumDocument<Script>): string | undefined {
  if (isZs(document)) {
    const srcRootUri = document.srcRootUri
    if (srcRootUri) {
      const relatives = UriUtils.relative(srcRootUri, document.uri).split('/')
      const docName = getName(document)
      return ['scripts', ...relatives.slice(0, -1), docName].join('.')
    }
  }
  else if (isDzs(document)) {
    return document.parseResult.value.package?.path.join('.') ?? ''
  }
}
