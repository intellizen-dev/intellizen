import { substringBeforeLast } from '@intellizen/shared'
import type { LangiumDocument } from 'langium'
import { UriUtils } from 'langium'
import type { Script } from '../generated/ast'

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
    const packageDecl = document.parseResult.value.package
    if (packageDecl) {
      return packageDecl.path.join('.')
    }

    const srcRootUri = document.srcRootUri
    if (srcRootUri) {
      const relatives = UriUtils.relative(document.srcRootUri, document.uri).split('/')
      return relatives.slice(0, -1).join('.')
    }
  }
}