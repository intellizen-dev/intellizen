import type { AstNode, AstNodeDescription, AstNodeDescriptionProvider, Stream } from 'langium'
import type { ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from '../typing/type-computer'
import type { ZenScriptClassIndex } from '../workspace/class-index'
import type { PackageManager } from '../workspace/package-manager'
import type { ZenScriptSyntheticAstType } from './synthetic'
import { AstUtils, stream } from 'langium'
import { isClassDeclaration, isVariableDeclaration } from '../generated/ast'
import { ClassType, isAnyType, isClassType, isFunctionType, type Type, type ZenScriptType } from '../typing/type-description'
import { getPrecomputedDescription } from '../utils/document'
import { isSyntheticAstNode } from './synthetic'

export interface MemberProvider {
  getMembers: (source: AstNode | Type | undefined) => Stream<AstNodeDescription>
}

type SourceMap = ZenScriptAstType & ZenScriptType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => Stream<AstNodeDescription> }

export class ZenScriptMemberProvider implements MemberProvider {
  private readonly descriptions: AstNodeDescriptionProvider
  private readonly typeComputer: TypeComputer
  private readonly classIndex: ZenScriptClassIndex
  private readonly packageManager: PackageManager

  constructor(services: ZenScriptServices) {
    this.descriptions = services.workspace.AstNodeDescriptionProvider
    this.typeComputer = services.typing.TypeComputer
    this.classIndex = services.workspace.ClassIndex
    this.packageManager = services.workspace.PackageManager
  }

  getMembers(source: AstNode | Type | undefined): Stream<AstNodeDescription> {
    // @ts-expect-error allowed index type
    return this.rules[source?.$type]?.call(this, source) ?? stream()
  }

  private readonly rules: RuleMap = {
    SyntheticHierarchyNode: (source) => {
      const declarations = stream(source.children.values())
        .filter(it => it.isDataNode())
        .flatMap(it => it.data)
        .map((it) => {
          const document = AstUtils.getDocument(it)
          return getPrecomputedDescription(document, it)
        })
      const packages = stream(source.children.values())
        .filter(it => it.isInternalNode())
        .map(it => this.packageManager.syntheticDescriptionOf(it))
      return stream(declarations, packages)
    },

    Script: (source) => {
      const members: AstNode[] = []
      source.classes.forEach(it => members.push(it))
      source.functions.forEach(it => members.push(it))
      source.statements.filter(it => isVariableDeclaration(it))
        .filter(it => it.prefix === 'static')
        .forEach(it => members.push(it))
      return stream(members
        .map((it) => {
          const document = AstUtils.getDocument(it)
          return getPrecomputedDescription(document, it)
        }))
    },

    ImportDeclaration: (source) => {
      return this.getMembers(source.path.at(-1)?.ref)
    },

    ClassDeclaration: (source) => {
      const index = this.classIndex.get(source)

      return index.streamDescriptions(true)
    },

    VariableDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    LoopParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    ValueParameter: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    MemberAccess: (source) => {
      const target = source.target.ref
      if (!target) {
        return stream()
      }

      if (isSyntheticAstNode(target)) {
        return this.getMembers(target)
      }

      const receiverType = this.typeComputer.inferType(source.receiver)
      if (!receiverType) {
        return this.getMembers(target)
      }

      let type = this.typeComputer.inferType(source)
      if (isClassType(receiverType)) {
        type = type?.substituteTypeParameters(receiverType.substitutions)
      }
      return this.getMembers(type)
    },

    IndexingExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    ReferenceExpression: (source) => {
      if (source.target.$refText === 'this' && isClassDeclaration(source.target.ref)) {
        return this.getMembers(new ClassType(source.target.ref, new Map()))
      }
      return this.getMembers(source.target.ref)
    },

    CallExpression: (source) => {
      const receiverType = this.typeComputer.inferType(source.receiver)
      if (isFunctionType(receiverType)) {
        return this.getMembers(receiverType.returnType)
      }
      if (isAnyType(receiverType)) {
        return this.getMembers(receiverType)
      }
      return stream()
    },

    BracketExpression: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    FieldDeclaration: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    StringLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    StringTemplate: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    IntegerLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    FloatingLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    BooleanLiteral: (source) => {
      const type = this.typeComputer.inferType(source)
      return this.getMembers(type)
    },

    ClassType: (source) => {
      const index = this.classIndex.get(source.declaration)
      return index.streamDescriptions(false)
    },
  }
}
