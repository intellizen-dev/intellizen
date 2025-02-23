import type { AstNode, AstNodeDescription, LangiumDocument } from 'langium'
import type { ClassDeclaration, FunctionDeclaration, ImportDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptDescriptionCache } from './description-cache'
import { AstUtils, CstUtils, DefaultAstNodeDescriptionProvider, stream, URI } from 'langium'
import { isClassDeclaration, isFunctionDeclaration, isScript } from '../generated/ast'
import { getDocumentUri, isStatic } from '../utils/ast'

declare module 'langium' {
  interface AstNodeDescriptionProvider extends DescriptionCreator {}
}

export interface DescriptionCreator {
  getOrCreateDescription: (astNode: AstNode) => AstNodeDescription
  getOrCreateThisDescription: (classDecl: ClassDeclaration) => AstNodeDescription
  createDynamicDescription: (astNode: AstNode, name: string) => AstNodeDescription
  createImportedDescriptions: (importDecl: ImportDeclaration) => AstNodeDescription[]
  createDescriptionWithUri: (node: AstNode, uri: URI | undefined, name?: string) => AstNodeDescription
}

export class ZenScriptDescriptionCreator extends DefaultAstNodeDescriptionProvider {
  private readonly descriptionCache: ZenScriptDescriptionCache

  constructor(services: ZenScriptServices) {
    super(services)
    this.descriptionCache = services.shared.workspace.DescriptionCache
  }

  public getOrCreateDescription(astNode: AstNode): AstNodeDescription {
    return this.descriptionCache.getOrCreateDescription(astNode, (node) => {
      const uri = getDocumentUri(node)
      return this.createDescriptionWithUri(node, uri)
    })
  }

  public getOrCreateThisDescription(classDecl: ClassDeclaration): AstNodeDescription {
    return this.descriptionCache.getOrCreateThisDescription(classDecl, (node) => {
      const uri = getDocumentUri(node)
      return this.createDescriptionWithUri(node, uri)
    })
  }

  public createDynamicDescription(astNode: AstNode, name: string): AstNodeDescription {
    const existing = this.descriptionCache.astDescriptions.get(astNode)
    if (existing?.name === name) {
      return existing
    }
    const originalUri = existing?.documentUri
    return this.createDescriptionWithUri(astNode, originalUri, name)
  }

  public createImportedDescriptions(importDecl: ImportDeclaration): AstNodeDescription[] {
    const targetRef = importDecl.path.at(-1)
    if (!targetRef) {
      return [this.getOrCreateDescription(importDecl)]
    }

    const target = targetRef.ref
    if (!target) {
      return [this.getOrCreateDescription(importDecl)]
    }

    // TODO: Workaround for function overloading, may rework after langium supports multi-target references
    if (isFunctionDeclaration(target)) {
      const parent = importDecl.path.at(-2)?.ref

      let members: FunctionDeclaration[]
      if (isClassDeclaration(parent)) {
        members = parent.members.filter(isFunctionDeclaration).filter(isStatic)
      }
      else if (isScript(parent)) {
        members = parent.functions
      }
      else {
        return []
      }

      return stream(members)
        .filter(it => it.name === target.name)
        .map(it => this.createDynamicDescription(it, importDecl.alias ?? it.name))
        .toArray()
    }

    const targetDescription = targetRef.$nodeDescription
    if (!importDecl.alias && targetDescription) {
      return [targetDescription]
    }

    const targetUri = targetDescription?.documentUri
    const alias = this.nameProvider.getName(importDecl)
    return [this.createDescriptionWithUri(target, targetUri, alias)]
  }

  public createDescriptionWithUri(
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

  override createDescription(node: AstNode, name: string | undefined, document?: LangiumDocument): AstNodeDescription {
    const uri = document?.uri ?? AstUtils.getDocument(node).uri
    return this.createDescriptionWithUri(node, uri, name)
  }
}
