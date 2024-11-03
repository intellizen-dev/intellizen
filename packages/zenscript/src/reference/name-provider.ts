import type { AstNode, CstNode, NameProvider } from 'langium'
import { AstUtils, GrammarUtils, isNamed } from 'langium'
import type { Script } from '../generated/ast'
import { isClassDeclaration, isFunctionDeclaration, isImportDeclaration, isOperatorFunctionDeclaration, isScript } from '../generated/ast'
import { isImportable, isStatic, isToplevel } from '../utils/ast'
import { getName, getQualifiedName } from '../utils/document'

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
    else if (isOperatorFunctionDeclaration(node)) {
      return node.op
    }
    else if (isFunctionDeclaration(node)) {
      return node.name || 'lambda function'
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
      return
    }

    if (isScript(node)) {
      return getQualifiedName(document)
    }
    else if (isToplevel(node) && isImportable(node)) {
      return concat(getQualifiedName(document), this.getName(node))
    }
    else if (isClassDeclaration(node.$container) && isStatic(node)) {
      return concat(this.getQualifiedName(node.$container!), this.getName(node))
    }
  }
}

function concat(qualifiedName: string | undefined, name: string | undefined): string | undefined {
  if (qualifiedName === undefined || name === undefined) {
    return
  }
  if (qualifiedName === '') {
    return name
  }
  return [...qualifiedName.split('.'), name].join('.')
}
