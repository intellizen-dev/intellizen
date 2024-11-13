import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { BracketManager } from '../workspace/bracket-manager'
import type { PackageManager } from '../workspace/package-manager'
import type { BuiltinTypes, Type, TypeParameterSubstitutions } from './type-description'
import { type AstNode, stream } from 'langium'
import { isAssignment, isCallExpression, isClassDeclaration, isExpression, isFunctionDeclaration, isFunctionExpression, isOperatorFunctionDeclaration, isTypeParameter, isVariableDeclaration } from '../generated/ast'
import { ClassType, CompoundType, FunctionType, IntersectionType, isAnyType, isClassType, isFunctionType, TypeVariable, UnionType } from './type-description'

export interface TypeComputer {
  inferType: (node: AstNode | undefined) => Type | undefined
}

type SourceMap = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof SourceMap]?: (source: SourceMap[K]) => Type | undefined }

export class ZenScriptTypeComputer implements TypeComputer {
  private readonly packageManager: PackageManager
  private readonly bracketManager: BracketManager
  private readonly memberProvider: () => MemberProvider

  constructor(services: ZenScriptServices) {
    this.packageManager = services.workspace.PackageManager
    this.bracketManager = services.workspace.BracketManager
    this.memberProvider = () => services.references.MemberProvider
  }

  public inferType(node: AstNode | undefined): Type | undefined {
    // @ts-expect-error allowed index type
    return this.rules[node?.$type]?.call(this, node)
  }

  private classTypeOf(className: BuiltinTypes | string, substitutions: TypeParameterSubstitutions = new Map()): ClassType {
    const classDecl = this.classDeclOf(className)
    if (!classDecl) {
      throw new Error(`Class "${className}" is not defined.`)
    }
    return new ClassType(classDecl, substitutions)
  }

  private classDeclOf(className: BuiltinTypes | string): ClassDeclaration | undefined {
    return stream(this.packageManager.retrieve(className)).find(isClassDeclaration)
  }

  private readonly rules: RuleMap = {
    // region TypeReference
    ArrayTypeReference: (source) => {
      const arrayType = this.classTypeOf('Array')
      const T = arrayType.declaration.typeParameters[0]
      arrayType.substitutions.set(T, this.inferType(source.value) ?? this.classTypeOf('any'))
      return arrayType
    },

    ListTypeReference: (source) => {
      const listType = this.classTypeOf('List')
      const T = listType.declaration.typeParameters[0]
      listType.substitutions.set(T, this.inferType(source.value) ?? this.classTypeOf('any'))
      return listType
    },

    MapTypeReference: (source) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParameters[0]
      const V = mapType.declaration.typeParameters[1]
      mapType.substitutions.set(K, this.inferType(source.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(source.value) ?? this.classTypeOf('any'))
      return mapType
    },

    UnionTypeReference: (source) => {
      const types = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new UnionType(types)
    },

    IntersectionTypeReference: (source) => {
      const types = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new IntersectionType(types)
    },

    CompoundTypeReference: (source) => {
      const types = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new CompoundType(types)
    },

    ParenthesizedTypeReference: (source) => {
      return this.inferType(source.value)
    },

    FunctionTypeReference: (source) => {
      const paramTypes = source.params.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.returnType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    NamedTypeReference: (source) => {
      const ref = source.path.at(-1)?.ref
      if (isTypeParameter(ref)) {
        return new TypeVariable(ref)
      }
      else if (isClassDeclaration(ref)) {
        return new ClassType(ref, new Map())
      }
    },
    // endregion

    // region Declaration
    VariableDeclaration: (source) => {
      if (source.typeRef) {
        return this.inferType(source.typeRef) ?? this.classTypeOf('any')
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    },

    FunctionDeclaration: (source) => {
      const paramTypes = source.parameters.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.returnTypeRef) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    FieldDeclaration: (source) => {
      if (source.typeRef) {
        return this.inferType(source.typeRef) ?? this.classTypeOf('any')
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    },

    LoopParameter: (source) => {
      const length = source.$container.parameters.length
      const index = source.$containerIndex
      if (index === undefined) {
        return
      }
      const rangeType = this.inferType(source.$container.range)
      if (!rangeType) {
        return
      }

      const operatorDecl = this.memberProvider().getMember(rangeType)
        .map(it => it.node)
        .filter(it => isOperatorFunctionDeclaration(it))
        .filter(it => it.op === 'for')
        .filter(it => it.parameters.length === length)
        .at(0)

      let paramType = this.inferType(operatorDecl?.parameters.at(index))
      if (isClassType(rangeType)) {
        paramType = paramType?.substituteTypeParameters(rangeType.substitutions)
      }
      return paramType
    },

    ValueParameter: (source) => {
      if (source.typeRef) {
        return this.inferType(source.typeRef)
      }

      if (source.defaultValue && isExpression(source.defaultValue)) {
        return this.inferType(source.defaultValue)
      }

      if (isFunctionExpression(source.$container)) {
        const funcExpr = source.$container
        const index = source.$containerIndex!

        let expectingType: Type | undefined
        if (isAssignment(funcExpr.$container) && funcExpr.$container.op === '=') {
          expectingType = this.inferType(funcExpr.$container.left)
        }
        else if (isVariableDeclaration(funcExpr.$container)) {
          expectingType = this.inferType(funcExpr.$container.typeRef)
        }
        else if (isCallExpression(funcExpr.$container)) {
          const callArgIndex = funcExpr.$containerIndex!
          const receiverType = this.inferType(funcExpr.$container.receiver)
          expectingType = isFunctionType(receiverType) ? receiverType.paramTypes.at(callArgIndex) : undefined
        }

        if (isFunctionType(expectingType)) {
          return expectingType.paramTypes.at(index)
        }
        else if (isClassType(expectingType)) {
          const lambdaDecl = this.memberProvider().getMember(expectingType)
            .map(it => it.node)
            .filter(it => isFunctionDeclaration(it))
            .filter(it => it.prefix === 'lambda')
            .at(0)
          return this.inferType(lambdaDecl?.parameters.at(index))
        }
      }
    },
    // endregion

    // region Expression
    Assignment: (source) => {
      return this.inferType(source.right)
    },

    ConditionalExpression: (_) => {
      // TODO: operator overloading
      return this.classTypeOf('bool')
    },

    PrefixExpression: (source) => {
      switch (source.op) {
        case '-':
          return this.classTypeOf('int')
        case '!':
          return this.classTypeOf('bool')
      }
    },

    InfixExpression: (source) => {
      // TODO: operator overloading
      switch (source.op) {
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
          return this.classTypeOf('int')
        case '<':
        case '>':
        case '<=':
        case '>=':
          return this.classTypeOf('bool')
        case '==':
        case '!=':
          return this.classTypeOf('bool')
        case '&&':
        case '||':
          return this.classTypeOf('bool')
        case 'has':
        case 'in':
          return this.classTypeOf('bool')
        case '&':
        case '|':
        case '^':
          return this.classTypeOf('int')
        case '~':
          return this.classTypeOf('string')
        case 'to':
        case '..':
          return this.classTypeOf('stanhebben.zenscript.value.IntRange')
      }
    },

    TypeCastExpression: (source) => {
      return this.inferType(source.typeRef)
    },

    InstanceofExpression: (_) => {
      return this.classTypeOf('bool')
    },

    ParenthesizedExpression: (source) => {
      return this.inferType(source.expr)
    },

    BracketExpression: (source) => {
      const id = source.path.map(it => it.$cstNode?.text).join(':')
      const type = this.bracketManager.type(id)
      if (type) {
        return this.classTypeOf(type)
      }
      else {
        return this.classTypeOf('any')
      }
    },

    FunctionExpression: (source) => {
      const paramTypes = source.parameters.map(param => this.inferType(param) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.returnTypeRef) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    ReferenceExpression: (source) => {
      // dynamic this
      if (source.target.$refText === 'this' && isClassDeclaration(source.target.ref)) {
        return new ClassType(source.target.ref, new Map())
      }

      // dynamic arguments
      if (isCallExpression(source.$container) && source.$containerProperty === 'arguments' && isFunctionDeclaration(source.target.ref)) {
        return this.inferType(source.target.ref.returnTypeRef)
      }

      return this.inferType(source.target.ref) ?? this.classTypeOf('any')
    },

    MemberAccess: (source) => {
      const targetContainer = source.target.ref?.$container
      if (isOperatorFunctionDeclaration(targetContainer) && targetContainer.op === '.') {
        return this.inferType(targetContainer.returnTypeRef)
      }

      const receiverType = this.inferType(source.receiver)
      const memberType = this.inferType(source.target.ref)
      if (memberType && isClassType(receiverType)) {
        return memberType.substituteTypeParameters(receiverType.substitutions)
      }
      return memberType
    },

    IndexingExpression: (source) => {
      const receiverType = this.inferType(source.receiver)
      if (isAnyType(receiverType)) {
        return receiverType
      }

      const operatorDecl = this.memberProvider().getMember(source.receiver)
        .map(it => it.node)
        .filter(it => isOperatorFunctionDeclaration(it))
        .filter(it => it.op === '[]')
        .at(0)
      let returnType = this.inferType(operatorDecl?.returnTypeRef)
      if (isClassType(receiverType)) {
        returnType = returnType?.substituteTypeParameters(receiverType.substitutions)
      }
      return returnType
    },

    CallExpression: (source) => {
      const receiverType = this.inferType(source.receiver)
      if (isFunctionType(receiverType)) {
        return receiverType.returnType
      }
      if (isAnyType(receiverType)) {
        return receiverType
      }
    },

    NullLiteral: (_) => {
      // TODO: does it make sense?
      return this.classTypeOf('any')
    },

    BooleanLiteral: (_) => {
      return this.classTypeOf('bool')
    },

    IntegerLiteral: (source) => {
      switch (source.value.at(-1)) {
        case 'l':
        case 'L':
          return this.classTypeOf('long')

        default:
          return this.classTypeOf('int')
      }
    },

    FloatingLiteral: (source) => {
      switch (source.value.at(-1)) {
        case 'f':
        case 'F':
          return this.classTypeOf('float')

        case 'd':
        case 'D':
          return this.classTypeOf('double')

        default:
          return this.classTypeOf('double')
      }
    },

    StringLiteral: (_) => {
      return this.classTypeOf('string')
    },

    UnquotedString: (_) => {
      return this.classTypeOf('string')
    },

    StringTemplate: (_) => {
      return this.classTypeOf('string')
    },

    ArrayLiteral: (source) => {
      const arrayType = this.classTypeOf('Array')
      const T = arrayType.declaration.typeParameters[0]
      arrayType.substitutions.set(T, this.inferType(source.values[0]) ?? this.classTypeOf('any'))
      return arrayType
    },

    MapLiteral: (source) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParameters[0]
      const V = mapType.declaration.typeParameters[1]
      mapType.substitutions.set(K, this.inferType(source.entries[0]?.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(source.entries[0]?.value) ?? this.classTypeOf('any'))
      return mapType
    },
    // endregion
  }
}
