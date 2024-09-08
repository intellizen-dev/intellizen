import { type AstNode, AstUtils, type CstNode, GrammarUtils, type NameProvider, isNamed } from 'langium'
import { substringBeforeLast } from '@intellizen/shared'
import { isClassDeclaration, isFunctionDeclaration, isScript, isVariableDeclaration } from './generated/ast'
import { isToplevel } from './utils/ast'

export interface QualifiedNameProvider {
  getQualifiedName: (node: AstNode) => string | undefined
}

export class ZenScriptNameProvider implements NameProvider, QualifiedNameProvider {
  getName(node: AstNode): string | undefined {
    if (isScript(node)) {
      const fileName = node.$document?.uri?.path?.split('/')?.at(-1)
      if (fileName) {
        return substringBeforeLast(fileName, '.')
      }
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

      const directory = path.slice(scriptsIndex, -1)
      const fileNameWithoutExt = substringBeforeLast(fileName, '.')
      directory.push(fileNameWithoutExt)

      return directory.join('.')
    }

    if (isToplevel(node)) {
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
