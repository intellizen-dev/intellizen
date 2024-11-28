import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { BracketManager } from '../workspace/bracket-manager'
import type { PackageManager } from '../workspace/package-manager'
import type { BuiltinTypes, Type, TypeParameterSubstitutions } from './type-description'
import { type AstNode, stream } from 'langium'
import { isAssignment, isCallExpression, isClassDeclaration, isExpression, isFunctionDeclaration, isFunctionExpression, isOperatorFunctionDeclaration, isTypeParameter, isVariableDeclaration } from '../generated/ast'
import { defineRules } from '../utils/rule'
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
    return this.rules(node?.$type)?.call(this, node)
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

  private readonly rules = defineRules<RuleMap>({
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

      const operator = this.memberProvider().streamOperators(rangeType)
        .filter(it => it.op === 'for')
        .filter(it => it.parameters.length === length)
        .head()

      let paramType = this.inferType(operator?.parameters.at(index))
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
          const lambdaDecl = this.memberProvider().streamMembers(expectingType)
            .filter(it => isFunctionDeclaration(it))
            .filter(it => it.prefix === 'lambda')
            .head()
          return this.inferType(lambdaDecl?.parameters.at(index))
        }
      }
    },
    // endregion

    // region Expression
    Assignment: () => {
      return this.classTypeOf('void')
    },

    ConditionalExpression: (source) => {
      return this.inferType(source.second) ?? this.inferType(source.third)
    },

    PrefixExpression: (source) => {
      const exprType = this.inferType(source.expr)
      switch (source.op) {
        case '-':
        case '!': {
          const operator = this.memberProvider().streamOperators(exprType)
            .filter(it => it.op === source.op)
            .filter(it => it.parameters.length === 0)
            .head()
          return this.inferType(operator?.returnTypeRef)
        }
      }
    },

    InfixExpression: (source) => {
      const leftType = this.inferType(source.left)
      switch (source.op) {
        case '&': // Bitwise
        case '|':
        case '^':
        case '+': // Arithmetic
        case '-':
        case '*':
        case '/':
        case '%':
        case '<': // Comparison
        case '>':
        case '<=':
        case '>=':
        case '==':
        case '!=': {
          const operator = this.memberProvider().streamOperators(leftType)
            .filter(it => it.op === source.op)
            .filter(it => it.parameters.length === 1)
            .head()
          return this.inferType(operator?.returnTypeRef)
        }
        case 'has': // Containment
        case 'in': {
          const operator = this.memberProvider().streamOperators(leftType)
            .filter(it => it.op === 'has')
            .filter(it => it.parameters.length === 1)
            .head()
          return this.inferType(operator?.returnTypeRef)
        }
        case '..': // Range
        case 'to': {
          const operator = this.memberProvider().streamOperators(leftType)
            .filter(it => it.op === '..')
            .filter(it => it.parameters.length === 1)
            .head()
          return this.inferType(operator?.returnTypeRef)
        }

        case '&&': // Logical
        case '||':
          return this.classTypeOf('bool')

        case '~': // String Concat
          return this.classTypeOf('string')
      }
    },

    TypeCastExpression: (source) => {
      return this.inferType(source.typeRef)
    },

    InstanceofExpression: () => {
      return this.classTypeOf('bool')
    },

    ParenthesizedExpression: (source) => {
      return this.inferType(source.expr)
    },

    BracketExpression: (source) => {
      const id = source.path.map(it => it.$cstNode?.text).join(':')
      const type = this.bracketManager.type(id)
      if (!type) {
        return this.classTypeOf('any')
      }

      const types = type.split('&').map(it => this.classTypeOf(it.trim()))
      switch (types.length) {
        case 1:
          return types[0]

        default:
          return new IntersectionType(types)
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
      const receiverType = this.inferType(source.receiver)

      const targetContainer = source.target.ref?.$container
      if (isOperatorFunctionDeclaration(targetContainer) && targetContainer.op === '.') {
        let dynamicTargetType = this.inferType(targetContainer.returnTypeRef)
        if (dynamicTargetType && isClassType(receiverType)) {
          dynamicTargetType = dynamicTargetType.substituteTypeParameters(receiverType.substitutions)
        }
        return dynamicTargetType
      }

      let targetType = this.inferType(source.target.ref)
      if (targetType && isClassType(receiverType)) {
        targetType = targetType.substituteTypeParameters(receiverType.substitutions)
      }
      return targetType
    },

    IndexingExpression: (source) => {
      const receiverType = this.inferType(source.receiver)
      if (isAnyType(receiverType)) {
        return receiverType
      }

      const operator = this.memberProvider().streamOperators(source.receiver)
        .filter(it => it.op === '[]')
        .filter(it => it.parameters.length === 1)
        .head()
      let returnType = this.inferType(operator?.returnTypeRef)
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

    NullLiteral: () => {
      // does it make sense?
      return this.classTypeOf('any')
    },

    BooleanLiteral: () => {
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

    StringLiteral: () => {
      return this.classTypeOf('string')
    },

    UnquotedString: () => {
      return this.classTypeOf('string')
    },

    StringTemplate: () => {
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
  })
}
