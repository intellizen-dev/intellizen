import type { AstNode, AstNodeDescription, LangiumDocument } from 'langium'
import { CstUtils, DefaultAstNodeDescriptionProvider, URI } from 'langium'
import { generateStream } from '../utils/stream'

export class ZenScriptAstNodeDescriptionProvider extends DefaultAstNodeDescriptionProvider {
  override createDescription(node: AstNode, name: string | undefined, document?: LangiumDocument): AstNodeDescription {
    document ??= generateStream(node, it => it.$container)
      .map(it => it.$document)
      .nonNullable()
      .head()
    const nameProvider = this.nameProvider
    return {
      node,
      name: name ?? this.nameProvider.getName(node) ?? 'unknown',
      get nameSegment() {
        const nameNode = nameProvider.getNameNode(node) ?? node.$cstNode
        return CstUtils.toDocumentSegment(nameNode)
      },
      selectionSegment: CstUtils.toDocumentSegment(node.$cstNode),
      type: node.$type,
      documentUri: document?.uri ?? URI.from({ scheme: 'unknown' }),
      path: this.astNodeLocator.getAstNodePath(node),
    }
  }
}
