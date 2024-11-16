import type { AstNodeDescription, AstNodeDescriptionProvider, LangiumDocument, NameProvider, Stream } from 'langium'
import type { ZenScriptServices } from '../module'
import type { Type } from '../typing/type-description'

import { AstUtils, DocumentState, MultiMap, stream } from 'langium'
import { type ClassDeclaration, isClassDeclaration, isOperatorFunctionDeclaration, type OperatorFunctionDeclaration } from '../generated/ast'
import { isClassType } from '../typing/type-description'
import { getClassChain, isStatic } from '../utils/ast'

export class ClassIndex {
  readonly memberDescriptions: MultiMap<string, AstNodeDescription>
  readonly staticMemberDescriptions: MultiMap<string, AstNodeDescription>
  readonly thisSymbol: AstNodeDescription

  private lazyClassChain: ClassDeclaration[] | undefined
  private lazyOperators: MultiMap<string, OperatorFunctionDeclaration> | undefined
  private readonly classDecl: ClassDeclaration
  private readonly currentOperators: MultiMap<string, OperatorFunctionDeclaration>
  private readonly indexManager: ZenScriptClassIndex

  constructor(classDecl: ClassDeclaration, indexManger: ZenScriptClassIndex, operators: MultiMap<string, OperatorFunctionDeclaration>, memberDescriptions: MultiMap<string, AstNodeDescription>, staticMemberDescriptions: MultiMap<string, AstNodeDescription>, thisSymbol: AstNodeDescription) {
    this.currentOperators = operators
    this.memberDescriptions = memberDescriptions
    this.staticMemberDescriptions = staticMemberDescriptions
    this.classDecl = classDecl
    this.indexManager = indexManger
    this.thisSymbol = thisSymbol
  }

  get classChain(): ClassDeclaration[] {
    if (!this.lazyClassChain) {
      this.lazyClassChain = getClassChain(this.classDecl)
    }
    return this.lazyClassChain
  }

  streamDescriptions(isStatic: boolean): Stream<AstNodeDescription> {
    return stream(this.classChain).flatMap((it) => {
      const index = this.indexManager.get(it)
      return isStatic ? index.staticMemberDescriptions.values() : index.memberDescriptions.values()
    })
  }

  get operators(): MultiMap<string, OperatorFunctionDeclaration> {
    if (!this.lazyOperators) {
      this.lazyOperators = new MultiMap()
      this.classChain.forEach((classDecl) => {
        this.indexManager.get(classDecl).currentOperators.forEach((op, decl) => {
          this.lazyOperators?.add(decl, op)
        })
      })
    }
    return this.lazyOperators
  }
}

export class ZenScriptClassIndex {
  private readonly classes: WeakMap<ClassDeclaration, ClassIndex> = new Map()
  private readonly documentMap: MultiMap<string, WeakRef<ClassDeclaration>> = new MultiMap()

  private readonly descriptions: AstNodeDescriptionProvider
  private readonly nameProvider: NameProvider

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.nameProvider = services.references.NameProvider

    services.shared.workspace.DocumentBuilder.onDocumentPhase(DocumentState.ComputedScopes, (document) => {
      this.addDocument(document)
    })

    services.shared.workspace.DocumentBuilder.onUpdate((changed, removed) => {
      const changedUris = changed.concat(removed).map(uri => uri.toString())
      changedUris.forEach(uri => this.clear(uri))
      this.clear('<synthetic-nodes>')
    })
  }

  get(classDecl: ClassDeclaration): ClassIndex {
    const ret = this.classes.get(classDecl)
    if (!ret) {
      throw new Error('ClassIndex not found for class declaration')
    }
    return ret
  }

  findOperators(classDecl: ClassDeclaration | Type | undefined, op: string): readonly OperatorFunctionDeclaration[] {
    if (isClassDeclaration(classDecl)) {
      return this.get(classDecl).operators.get(op)
    }

    if (isClassType(classDecl)) {
      return this.get(classDecl.declaration).operators.get(op)
    }

    return []
  }

  private add(classDecl: ClassDeclaration, document?: LangiumDocument): void {
    const lazyIndex = this.createIndex(classDecl, document)
    const uri = (document ?? AstUtils.findRootNode(classDecl)?.$document)?.uri?.toString() ?? '<synthetic-nodes>'
    this.classes.set(classDecl, lazyIndex)
    this.documentMap.add(uri, new WeakRef(classDecl))
  }

  private addDocument(document: LangiumDocument): void {
    // iterate all root nodes of the document
    AstUtils.streamContents(document.parseResult.value)
      .filter(isClassDeclaration)
      .forEach(classDecl => this.add(classDecl, document))
  }

  private clear(uri: string): void {
    for (const ref of this.documentMap.get(uri) ?? []) {
      const classDecl = ref.deref()
      if (classDecl) {
        this.classes.delete(classDecl)
      }
    }

    this.documentMap.delete(uri)
  }

  private createIndex(classDecl: ClassDeclaration, document?: LangiumDocument): ClassIndex {
    const operators = new MultiMap<string, OperatorFunctionDeclaration>()
    const memberDescriptions = new MultiMap<string, AstNodeDescription>()
    const staticMemberDescriptions = new MultiMap<string, AstNodeDescription>()

    for (const member of classDecl.members) {
      if (isOperatorFunctionDeclaration(member)) {
        operators.add(member.op, member)
        continue
      }

      const desc = this.descriptions.createDescription(member, undefined, document)
      const memberName = this.nameProvider.getName(member) ?? ''
      if (isStatic(member)) {
        staticMemberDescriptions.add(memberName, desc)
      }
      else {
        memberDescriptions.add(memberName, desc)
      }
    }

    const thisSymbol = this.descriptions.createDescription(classDecl, 'this', document)

    return new ClassIndex(classDecl, this, operators, memberDescriptions, staticMemberDescriptions, thisSymbol)
  }
}
