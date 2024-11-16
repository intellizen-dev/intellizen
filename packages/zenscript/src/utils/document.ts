import type { AstNode, AstNodeDescription, LangiumDocument } from 'langium'
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

export function getPrecomputedDescription(document: LangiumDocument, astNode: AstNode): AstNodeDescription {
  const container = astNode.$container
  if (!container) {
    throw new Error(`could not find container for node: ${astNode}`)
  }
  const precomputed = document.precomputedScopes

  if (!precomputed) {
    throw new Error(`no precomputed scopes found for document ${document.uri}`)
  }

  const descriptions = precomputed.get(container)
  const ret = descriptions?.find(desc => desc.node === astNode)

  if (!ret) {
    throw new Error(`could not find description for node: ${astNode}`)
  }

  return ret
}
