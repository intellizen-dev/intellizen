import type { AstNode } from 'langium'
import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { BracketManager } from '../workspace/bracket-manager'
import type { PackageManager } from '../workspace/package-manager'
import type { BuiltinTypes, Type, TypeParameterSubstitutions } from './type-description'
import { stream } from 'langium'
import { isAssignment, isCallExpression, isClassDeclaration, isConstructorDeclaration, isExpression, isFunctionDeclaration, isFunctionExpression, isIndexExpression, isMemberAccess, isOperatorFunctionDeclaration, isReferenceExpression, isTypeParameter, isVariableDeclaration } from '../generated/ast'
import { defineRules } from '../utils/rule'
import { ClassType, CompoundType, FunctionType, IntersectionType, isAnyType, isClassType, isFunctionType, TypeVariable } from './type-description'

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
    this.packageManager = services.shared.workspace.PackageManager
    this.bracketManager = services.shared.workspace.BracketManager
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
    ArrayType: (source) => {
      const arrayType = this.classTypeOf('Array')
      const T = arrayType.declaration.typeParams[0]
      arrayType.substitutions.set(T, this.inferType(source.value) ?? this.classTypeOf('any'))
      return arrayType
    },

    ListType: (source) => {
      const listType = this.classTypeOf('List')
      const T = listType.declaration.typeParams[0]
      listType.substitutions.set(T, this.inferType(source.value) ?? this.classTypeOf('any'))
      return listType
    },

    MapType: (source) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParams[0]
      const V = mapType.declaration.typeParams[1]
      mapType.substitutions.set(K, this.inferType(source.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(source.value) ?? this.classTypeOf('any'))
      return mapType
    },

    CompoundType: (source) => {
      const types = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new CompoundType(types)
    },

    ParenthesizedType: (source) => {
      return this.inferType(source.value)
    },

    FunctionType: (source) => {
      const paramTypes = source.params.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.retType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    NamedType: (source) => {
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
      if (source.type) {
        return this.inferType(source.type) ?? this.classTypeOf('any')
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    },

    FunctionDeclaration: (source) => {
      const paramTypes = source.params.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.retType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    FieldDeclaration: (source) => {
      if (source.type) {
        return this.inferType(source.type) ?? this.classTypeOf('any')
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    },

    LoopParameter: (source) => {
      const length = source.$container.params.length
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
        .filter(it => it.params.length === length)
        .head()

      let paramType = this.inferType(operator?.params.at(index))
      if (isClassType(rangeType)) {
        paramType = paramType?.substituteTypeParameters(rangeType.substitutions)
      }
      return paramType
    },

    ValueParameter: (source) => {
      if (source.type) {
        return this.inferType(source.type)
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
          expectingType = this.inferType(funcExpr.$container.type)
        }
        else if (isCallExpression(funcExpr.$container)) {
          const callArgIndex = funcExpr.$containerIndex!
          const receiverType = this.inferType(funcExpr.$container.receiver)
          expectingType = isFunctionType(receiverType) ? receiverType.paramTypes.at(callArgIndex) : receiverType
        }

        if (isAnyType(expectingType)) {
          return expectingType
        }
        else if (isFunctionType(expectingType)) {
          return expectingType.paramTypes.at(index)
        }
        else if (isClassType(expectingType)) {
          const lambdaDecl = this.memberProvider().streamMembers(expectingType)
            .filter(it => isFunctionDeclaration(it))
            .filter(it => it.prefix === 'lambda')
            .head()
          return this.inferType(lambdaDecl?.params.at(index))
        }
      }
    },
    // endregion

    // region Expression
    Assignment: (source) => {
      switch (source.op) {
        case '&=':
        case '|=':
        case '^=':
        case '+=':
        case '-=':
        case '*=':
        case '/=':
        case '%=':
        case '~=':{
          const leftType = this.inferType(source.left)
          const operator = this.memberProvider().streamOperators(leftType)
            .filter(it => it.op === source.op)
            .filter(it => it.params.length === 1)
            .head()
          let returnType = this.inferType(operator?.retType)
          if (isClassType(leftType)) {
            returnType = returnType?.substituteTypeParameters(leftType.substitutions)
          }
          return returnType
        }

        case '=': {
          if (isIndexExpression(source.left)) {
            const operator = this.memberProvider().streamOperators(source.left)
              .filter(it => it.op === '[]=')
              .filter(it => it.params.length === 2)
              .head()
            return this.inferType(operator?.retType)
          }
          else {
            return this.inferType(source.right)
          }
        }
      }
    },

    ConditionalExpression: (source) => {
      return this.inferType(source.thenBody) ?? this.inferType(source.elseBody)
    },

    PrefixExpression: (source) => {
      const exprType = this.inferType(source.expr)
      switch (source.op) {
        case '-':
        case '!': {
          const operator = this.memberProvider().streamOperators(exprType)
            .filter(it => it.op === source.op)
            .filter(it => it.params.length === 0)
            .head()
          return this.inferType(operator?.retType)
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
            .filter(it => it.params.length === 1)
            .head()
          return this.inferType(operator?.retType)
        }
        case 'has': // Containment
        case 'in': {
          const operator = this.memberProvider().streamOperators(leftType)
            .filter(it => it.op === 'has')
            .filter(it => it.params.length === 1)
            .head()
          return this.inferType(operator?.retType)
        }

        case '&&': // Logical
        case '||':
          return this.classTypeOf('bool')

        case '~': // String Concat
          return this.classTypeOf('string')
      }
    },

    IntRangeExpression: (source) => {
      const leftType = this.inferType(source.from)
      const operator = this.memberProvider().streamOperators(leftType)
        .filter(it => it.op === '..')
        .filter(it => it.params.length === 1)
        .head()
      return this.inferType(operator?.retType)
    },

    TypeCastExpression: (source) => {
      return this.inferType(source.type)
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
      const paramTypes = source.params.map(param => this.inferType(param) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.retType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    ReferenceExpression: (source) => {
      // dynamic this
      if (source.target.$refText === 'this' && isClassDeclaration(source.target.ref)) {
        return new ClassType(source.target.ref, new Map())
      }

      // dynamic arguments
      if (isCallExpression(source.$container) && source.$containerProperty === 'arguments' && isFunctionDeclaration(source.target.ref)) {
        return this.inferType(source.target.ref.retType)
      }

      return this.inferType(source.target.ref) ?? this.classTypeOf('any')
    },

    MemberAccess: (source) => {
      const receiverType = this.inferType(source.receiver)

      // Recursive Guard
      const _ref = (source.target as any)._ref
      if (typeof _ref === 'symbol' && _ref.description === 'ref_resolving') {
        return this.classTypeOf('any')
      }

      const targetContainer = source.target.ref?.$container
      if (isOperatorFunctionDeclaration(targetContainer) && targetContainer.op === '.') {
        let dynamicTargetType = this.inferType(targetContainer.retType)
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

    IndexExpression: (source) => {
      const receiverType = this.inferType(source.receiver)
      if (isAnyType(receiverType)) {
        return receiverType
      }

      const operator = this.memberProvider().streamOperators(source.receiver)
        .filter(it => it.op === '[]')
        .filter(it => it.params.length === 1)
        .head()
      let returnType = this.inferType(operator?.retType)
      if (isClassType(receiverType)) {
        returnType = returnType?.substituteTypeParameters(receiverType.substitutions)
      }
      return returnType
    },

    CallExpression: (source) => {
      if (isReferenceExpression(source.receiver) || isMemberAccess(source.receiver)) {
        const receiver = source.receiver.target.ref
        if (!receiver) {
          return
        }
        if (isConstructorDeclaration(receiver)) {
          return new ClassType(receiver.$container, new Map())
        }
      }
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

    FloatLiteral: (source) => {
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
      const T = arrayType.declaration.typeParams[0]
      arrayType.substitutions.set(T, this.inferType(source.values[0]) ?? this.classTypeOf('any'))
      return arrayType
    },

    MapLiteral: (source) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParams[0]
      const V = mapType.declaration.typeParams[1]
      mapType.substitutions.set(K, this.inferType(source.entries[0]?.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(source.entries[0]?.value) ?? this.classTypeOf('any'))
      return mapType
    },

    SyntheticStringLiteral: () => {
      return this.classTypeOf('string')
    },
    // endregion
  })
}
