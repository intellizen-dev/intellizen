import type { AstNode, AstNodeDescription } from 'langium'
import { CstUtils, DefaultAstNodeDescriptionProvider, URI } from 'langium'

declare module 'langium' {
  interface AstNodeDescriptionProvider extends DescriptionCreator {}
}

export interface DescriptionCreator {
  createDescriptionWithUri: (node: AstNode, uri: URI | undefined, name?: string) => AstNodeDescription
}

export class ZenScriptDescriptionCreator extends DefaultAstNodeDescriptionProvider {
  createDescriptionWithUri(
    node: AstNode,
    uri = URI.from({ scheme: 'unknown' }),
    name = this.nameProvider.getName(node) ?? 'unknown',
  ) {
    const nameProvider = this.nameProvider
    const astNodeLocator = this.astNodeLocator
    return {
      node,
      name,
      get nameSegment() {
        const nameNode = nameProvider.getNameNode(node) ?? node.$cstNode
        const _nameSegment = CstUtils.toDocumentSegment(nameNode)
        Object.defineProperty(this, 'nameSegment', { value: _nameSegment })
        return _nameSegment
      },
      get selectionSegment() {
        const _selectionSegment = CstUtils.toDocumentSegment(node.$cstNode)
        Object.defineProperty(this, 'selectionSegment', { value: _selectionSegment })
        return _selectionSegment
      },
      type: node.$type,
      documentUri: uri,
      get path() {
        const _path = astNodeLocator.getAstNodePath(node)
        Object.defineProperty(this, 'path', { value: _path })
        return _path
      },
    }
  }
}
