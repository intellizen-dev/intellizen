import type { AstNode, CstNode, LangiumDocument, NameProvider } from 'langium'
import { AstUtils, GrammarUtils, UriUtils, isNamed } from 'langium'
import { substringBeforeLast } from '@intellizen/shared'
import { isClassDeclaration, isFunctionDeclaration, isImportDeclaration, isScript, isVariableDeclaration } from './generated/ast'
import { isToplevel } from './utils/ast'

declare module 'langium' {
  interface NameProvider {
    getQualifiedName: (node: AstNode) => string | undefined
  }
}

export class ZenScriptNameProvider implements NameProvider {
  getName(node: AstNode): string | undefined {
    if (isScript(node)) {
      return node.$document ? getName(node.$document) : undefined
    }
    else if (isImportDeclaration(node)) {
      return node.alias || node.path.at(-1)?.$refText
    }
    else if (isNamed(node)) {
      return node.name
    }
  }

  getNameNode(node: AstNode): CstNode | undefined {
    return GrammarUtils.findNodeForProperty(node.$cstNode, 'name')
  }

  getQualifiedName(node: AstNode): string | undefined {
    const document = AstUtils.getDocument(node)
    if (!document) {
      return undefined
    }

    const dqName = getQualifiedName(document)
    if (!dqName) {
      return undefined
    }

    if (isScript(node)) {
      return dqName
    }
    else if (isToplevel(node)) {
      if (isVariableDeclaration(node) || isFunctionDeclaration(node) || isClassDeclaration(node)) {
        return concat(dqName, node.name)
      }
    }
  }
}

function concat(qualifiedName: string, name: string): string {
  if (!qualifiedName) {
    return name
  }
  const names = [...qualifiedName.split('.'), name]
  return names.join('.')
}

function getQualifiedName(document: LangiumDocument): string | undefined {
  if (!document.srcRootUri) {
    return undefined
  }

  const docName = getName(document)
  const relatives = UriUtils.relative(document.srcRootUri, document.uri).split('/')
  const names = ['scripts', ...relatives.slice(0, -1), docName]
  return names.join('.')
}

function getName(document: LangiumDocument): string {
  const baseName = UriUtils.basename(document.uri)
  return substringBeforeLast(baseName, '.')
}
