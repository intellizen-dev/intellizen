import type { AstNode, CstNode, NameProvider } from 'langium'
import { AstUtils, GrammarUtils, isNamed } from 'langium'
import type { Script } from './generated/ast'
import { isClassDeclaration, isFunctionDeclaration, isImportDeclaration, isScript, isVariableDeclaration } from './generated/ast'
import { isToplevel } from './utils/ast'
import { getName, getQualifiedName } from './utils/document'

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
    const document = AstUtils.getDocument<Script>(node)
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
  return [...qualifiedName.split('.'), name].join('.')
}

