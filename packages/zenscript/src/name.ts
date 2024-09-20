import { type AstNode, AstUtils, type CstNode, GrammarUtils, type NameProvider, isNamed } from 'langium'
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
      const fileName = node.$document?.uri?.path?.split('/')?.at(-1)
      if (fileName) {
        return substringBeforeLast(fileName, '.')
      }
    }
    else if (isImportDeclaration(node)) {
      return node.alias || node.ref?.$refText.split('.').at(-1)
    }
    else if (isNamed(node)) {
      return node.name
    }
  }

  getNameNode(node: AstNode): CstNode | undefined {
    return GrammarUtils.findNodeForProperty(node.$cstNode, 'name')
  }

  getQualifiedName(node: AstNode): string | undefined {
    if (isScript(node)) {
      const path = node.$document?.uri?.path?.split('/')
      if (!path) {
        return
      }

      const scriptsIndex = path.indexOf('scripts')
      if (scriptsIndex === -1) {
        return
      }

      const fileName = path.at(-1)
      if (!fileName) {
        return
      }

      const fileNameWithoutExt = substringBeforeLast(fileName, '.')
      const names = path.slice(scriptsIndex, -1)
      names.push(fileNameWithoutExt)
      return names.join('.')
    }
    else if (isToplevel(node)) {
      if (isVariableDeclaration(node) || isFunctionDeclaration(node) || isClassDeclaration(node)) {
        return concat(this.getScriptQualifiedName(node), node.name)
      }
    }
  }

  private getScriptQualifiedName(node: AstNode): string | undefined {
    const root = AstUtils.findRootNode(node)
    if (isScript(root)) {
      return this.getQualifiedName(root)
    }
  }
}

function concat(qualifiedName: string | undefined, name: string): string | undefined {
  const names = qualifiedName?.split('.')
  if (names) {
    names.push(name)
    return names.join('.')
  }
}
