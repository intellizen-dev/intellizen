import type { AstNode, AstNodeDescription, LangiumDocument } from 'langium'
import type { ClassDeclaration, FunctionDeclaration, ImportDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import { AstUtils, CstUtils, DefaultAstNodeDescriptionProvider, stream, URI } from 'langium'
import { isClassDeclaration, isFunctionDeclaration, isScript } from '../generated/ast'
import { getDocumentUri, isStatic } from '../utils/ast'

declare module 'langium' {
  interface AstNodeDescriptionProvider extends DescriptionCreator {}
}

export interface DescriptionCreator {
  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>
  getOrCreateDescription: (astNode: AstNode) => AstNodeDescription
  getOrCreateThisDescription: (classDecl: ClassDeclaration) => AstNodeDescription
  createDynamicDescription: (astNode: AstNode, name: string) => AstNodeDescription
  createImportedDescriptions: (importDecl: ImportDeclaration) => AstNodeDescription[]
  createDescriptionWithUri: (node: AstNode, uri: URI | undefined, name?: string) => AstNodeDescription
}

export class ZenScriptDescriptionCreator extends DefaultAstNodeDescriptionProvider {
  readonly astDescriptions: WeakMap<AstNode, AstNodeDescription>
  readonly thisDescriptions: WeakMap<ClassDeclaration, AstNodeDescription>

  constructor(services: ZenScriptServices) {
    super(services)
    this.astDescriptions = new WeakMap()
    this.thisDescriptions = new WeakMap()
  }

  public getOrCreateDescription(astNode: AstNode): AstNodeDescription {
    if (!this.astDescriptions.has(astNode)) {
      const uri = getDocumentUri(astNode)
      const desc = this.createDescriptionWithUri(astNode, uri)
      this.astDescriptions.set(astNode, desc)
    }
    return this.astDescriptions.get(astNode)!
  }

  public getOrCreateThisDescription(classDecl: ClassDeclaration): AstNodeDescription {
    if (!this.thisDescriptions.has(classDecl)) {
      const uri = getDocumentUri(classDecl)
      const desc = this.createDescriptionWithUri(classDecl, uri, 'this')
      this.thisDescriptions.set(classDecl, desc)
    }
    return this.thisDescriptions.get(classDecl)!
  }

  public createDynamicDescription(astNode: AstNode, name: string): AstNodeDescription {
    const existing = this.astDescriptions.get(astNode)
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
