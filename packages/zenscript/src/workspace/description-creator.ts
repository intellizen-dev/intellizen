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
    const nameNode = this.nameProvider.getNameNode(node) ?? node.$cstNode
    return {
      node,
      name,
      nameSegment: CstUtils.toDocumentSegment(nameNode),
      selectionSegment: CstUtils.toDocumentSegment(node.$cstNode),
      type: node.$type,
      documentUri: uri,
      path: this.astNodeLocator.getAstNodePath(node),
    }
  }
}
