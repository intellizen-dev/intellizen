import { type AstNode, type CstNode, GrammarUtils, type LangiumDocument, type NameProvider, isNamed } from 'langium'
import { type Script, isScript } from './generated/ast'

export interface QualifiedNameProvider {
  getQualifiedName: (node: AstNode) => string | undefined
}

export class ZenScriptNameProvider implements NameProvider, QualifiedNameProvider {
  getName(node: AstNode): string | undefined {
    if (isScript(node)) {
      return getName(node)
    }
    if (isNamed(node)) {
      return node.name
    }
  }

  getNameNode(node: AstNode): CstNode | undefined {
    return GrammarUtils.findNodeForProperty(node.$cstNode, 'name')
  }

  getQualifiedName(node: AstNode): string | undefined {
    if (isScript(node)) {
      return getQualifiedName(node)
    }
  }
}

function getName(node: Script): string | undefined {
  if (!node.$document) {
    return
  }

  const path = node.$document.uri.path
  const fileName = path[path.length - 1]
  const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))
  return fileNameWithoutExt
}

function getQualifiedName(node: Script): string | undefined {
  if (!node.$document) {
    return
  }

  const document: LangiumDocument = node.$document
  const pathStr = document.uri.path

  // iterate over parent dir to find 'scripts' dir and return the relative path
  const path = pathStr.split('/')
  const found = path.findIndex(e => e === 'scripts')
  let qualifiedName = 'scripts'
  if (found !== -1) {
    const fileName = path[path.length - 1]
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))

    const directory = path.slice(found + 1, path.length - 1)
    if (directory.length === 0) {
      qualifiedName = `scripts.${fileNameWithoutExt}`
    }
    else {
      qualifiedName = `scripts.${directory.join('.')}.${fileNameWithoutExt}`
    }
  }

  return qualifiedName
}
