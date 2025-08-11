import type { AstNode } from 'langium'
import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { ZenScriptSyntheticAstType } from '../reference/synthetic'
import type { BracketManager } from '../workspace/bracket-manager'
import type { PackageManager } from '../workspace/package-manager'
import type { BuiltinTypes, Type, TypeParameterSubstitutions } from './type-description'
import { AstUtils, stream } from 'langium'
import { isAssignment, isCallExpression, isClassDeclaration, isConstructorDeclaration, isExpression, isFunctionDeclaration, isFunctionExpression, isIndexExpression, isMemberAccess, isOperatorFunctionDeclaration, isReferenceExpression, isTypeParameter, isVariableDeclaration } from '../generated/ast'
import { defineRules } from '../utils/rule'
import { ClassType, CompoundType, FunctionType, IntersectionType, isAnyType, isClassType, isFunctionType, TypeVariable } from './type-description'

export interface TypeComputer {
  inferType: (node: AstNode | undefined) => Type | undefined
}

type RuleSpec = ZenScriptAstType & ZenScriptSyntheticAstType
type RuleMap = { [K in keyof RuleSpec]?: (element: RuleSpec[K]) => Type | undefined }

export class ZenScriptTypeComputer implements TypeComputer {
  private readonly bracketManager: BracketManager
  private readonly packageManager: () => PackageManager
  private readonly memberProvider: () => MemberProvider

  constructor(services: ZenScriptServices) {
    this.bracketManager = services.shared.workspace.BracketManager
    this.packageManager = () => services.references.PackageManager
    this.memberProvider = () => services.references.MemberProvider
  }

  public inferType(node: AstNode | undefined): Type | undefined {
    return this.inferRules(node?.$type)?.call(this, node)
  }

  private classTypeOf(className: BuiltinTypes | string, substitutions: TypeParameterSubstitutions = new Map()): ClassType {
    const classDecl = this.classDeclOf(className)
    if (!classDecl) {
      throw new Error(`Class "${className}" is not defined.`)
    }
    return new ClassType(classDecl, substitutions)
  }

  private classDeclOf(className: BuiltinTypes | string): ClassDeclaration | undefined {
    return stream(this.packageManager().find(className)).find(isClassDeclaration)
  }

  private readonly inferRules = defineRules<RuleMap>({
    ArrayType: (element) => {
      const arrayType = this.classTypeOf('Array')
      const T = arrayType.declaration.typeParams[0]
      arrayType.substitutions.set(T, this.inferType(element.value) ?? this.classTypeOf('any'))
      return arrayType
    },

    ListType: (element) => {
      const listType = this.classTypeOf('List')
      const T = listType.declaration.typeParams[0]
      listType.substitutions.set(T, this.inferType(element.value) ?? this.classTypeOf('any'))
      return listType
    },

    MapType: (element) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParams[0]
      const V = mapType.declaration.typeParams[1]
      mapType.substitutions.set(K, this.inferType(element.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(element.value) ?? this.classTypeOf('any'))
      return mapType
    },

    CompoundType: (element) => {
      const types = element.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new CompoundType(types)
    },

    ParenthesizedType: (element) => {
      return this.inferType(element.value)
    },

    FunctionType: (element) => {
      const paramTypes = element.params.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(element.retType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    NamedType: (element) => {
      const ref = element.path.at(-1)?.ref
      if (isTypeParameter(ref)) {
        return new TypeVariable(ref)
      }
      else if (isClassDeclaration(ref)) {
        return new ClassType(ref, new Map())
      }
    },

    VariableDeclaration: (element) => {
      if (element.type) {
        return this.inferType(element.type) ?? this.classTypeOf('any')
      }
      else if (element.initializer) {
        return this.inferType(element.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    },

    FunctionDeclaration: (element) => {
      const paramTypes = element.params.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(element.retType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    FieldDeclaration: (element) => {
      if (element.type) {
        return this.inferType(element.type) ?? this.classTypeOf('any')
      }
      else if (element.initializer) {
        return this.inferType(element.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    },

    LoopParameter: (element) => {
      const length = element.$container.params.length
      const index = element.$containerIndex
      if (index === undefined) {
        return
      }
      const rangeType = this.inferType(element.$container.range)
      if (!rangeType) {
        return
      }

      const operator = this.memberProvider()
        .streamMembers(rangeType).filter(isOperatorFunctionDeclaration)
        .filter(it => it.operator === 'for')
        .filter(it => it.params.length === length)
        .head()

      let paramType = this.inferType(operator?.params.at(index))
      if (isClassType(rangeType)) {
        paramType = paramType?.substituteTypeParameters(rangeType.substitutions)
      }
      return paramType
    },

    ValueParameter: (element) => {
      if (element.type) {
        return this.inferType(element.type)
      }

      if (element.defaultValue && isExpression(element.defaultValue)) {
        return this.inferType(element.defaultValue)
      }

      if (isFunctionExpression(element.$container)) {
        const funcExpr = element.$container
        const index = element.$containerIndex!

        let expected: Type | undefined
        if (isAssignment(funcExpr.$container) && funcExpr.$container.operator === '=') {
          expected = this.inferType(funcExpr.$container.left)
        }
        else if (isVariableDeclaration(funcExpr.$container)) {
          expected = this.inferType(funcExpr.$container.type)
        }
        else if (isCallExpression(funcExpr.$container)) {
          const callArgIndex = funcExpr.$containerIndex!
          const receiverType = this.inferType(funcExpr.$container.receiver)
          expected = isFunctionType(receiverType) ? receiverType.paramTypes.at(callArgIndex) : receiverType
        }

        if (isAnyType(expected)) {
          return expected
        }
        else if (isFunctionType(expected)) {
          return expected.paramTypes.at(index)
        }
        else if (isClassType(expected)) {
          const lambdaDecl = this.memberProvider()
            .streamMembers(expected)
            .filter(isFunctionDeclaration)
            .filter(it => it.variance === 'lambda')
            .head()
          return this.inferType(lambdaDecl?.params.at(index))
        }
      }
    },

    Assignment: (element) => {
      switch (element.operator) {
        case '&=':
        case '|=':
        case '^=':
        case '+=':
        case '-=':
        case '*=':
        case '/=':
        case '%=':
        case '~=':{
          const leftType = this.inferType(element.left)
          const operator = this.memberProvider()
            .streamMembers(leftType)
            .filter(isOperatorFunctionDeclaration)
            .filter(it => it.operator === element.operator)
            .filter(it => it.params.length === 1)
            .head()
          let returnType = this.inferType(operator?.retType)
          if (isClassType(leftType)) {
            returnType = returnType?.substituteTypeParameters(leftType.substitutions)
          }
          return returnType
        }

        case '=': {
          if (isIndexExpression(element.left)) {
            const operator = this.memberProvider()
              .streamMembers(element.left)
              .filter(isOperatorFunctionDeclaration)
              .filter(it => it.operator === '[]=')
              .filter(it => it.params.length === 2)
              .head()
            return this.inferType(operator?.retType)
          }
          else {
            return this.inferType(element.right)
          }
        }
      }
    },

    ConditionalExpression: (element) => {
      return this.inferType(element.thenBody) ?? this.inferType(element.elseBody)
    },

    PrefixExpression: (element) => {
      const exprType = this.inferType(element.expr)
      switch (element.operator) {
        case '-':
        case '!': {
          const operator = this.memberProvider()
            .streamMembers(exprType)
            .filter(isOperatorFunctionDeclaration)
            .filter(it => it.operator === element.operator)
            .filter(it => it.params.length === 0)
            .head()
          return this.inferType(operator?.retType)
        }
      }
    },

    InfixExpression: (element) => {
      const leftType = this.inferType(element.left)
      switch (element.operator) {
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
          const operator = this.memberProvider()
            .streamMembers(leftType)
            .filter(isOperatorFunctionDeclaration)
            .filter(it => it.operator === element.operator)
            .filter(it => it.params.length === 1)
            .head()
          return this.inferType(operator?.retType)
        }
        case 'has': // Containment
        case 'in': {
          const operator = this.memberProvider()
            .streamMembers(leftType)
            .filter(isOperatorFunctionDeclaration)
            .filter(it => it.operator === 'has')
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

    IntRangeExpression: (element) => {
      const leftType = this.inferType(element.from)
      const operator = this.memberProvider()
        .streamMembers(leftType)
        .filter(isOperatorFunctionDeclaration)
        .filter(it => it.operator === '..')
        .filter(it => it.params.length === 1)
        .head()
      return this.inferType(operator?.retType)
    },

    TypeCastExpression: (element) => {
      return this.inferType(element.type)
    },

    InstanceofExpression: () => {
      return this.classTypeOf('bool')
    },

    ParenthesizedExpression: (element) => {
      return this.inferType(element.expr)
    },

    BracketExpression: (element) => {
      const id = element.path.map(it => it.$cstNode?.text).join(':')
      const type = this.bracketManager.findType(id)
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

    FunctionExpression: (element) => {
      const paramTypes = element.params.map(param => this.inferType(param) ?? this.classTypeOf('any'))
      const returnType = this.inferType(element.retType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    },

    ReferenceExpression: (element) => {
      // dynamic this
      if (element.entity.$refText === 'this' && isClassDeclaration(element.entity.ref)) {
        return new ClassType(element.entity.ref, new Map())
      }

      // dynamic arguments
      if (isCallExpression(element.$container) && element.$containerProperty === 'arguments' && isFunctionDeclaration(element.entity.ref)) {
        return this.inferType(element.entity.ref.retType)
      }

      return this.inferType(element.entity.ref) ?? this.classTypeOf('any')
    },

    MemberAccess: (element) => {
      const receiverType = this.inferType(element.receiver)

      // Recursive Guard
      const _ref = (element.entity as any)._ref
      if (typeof _ref === 'symbol' && _ref.description === 'ref_resolving') {
        return this.classTypeOf('any')
      }

      const targetContainer = element.entity.ref?.$container
      if (isOperatorFunctionDeclaration(targetContainer) && targetContainer.operator === '.') {
        let dynamicTargetType = this.inferType(targetContainer.retType)
        if (dynamicTargetType && isClassType(receiverType)) {
          dynamicTargetType = dynamicTargetType.substituteTypeParameters(receiverType.substitutions)
        }
        return dynamicTargetType
      }

      let targetType = this.inferType(element.entity.ref)
      if (targetType && isClassType(receiverType)) {
        targetType = targetType.substituteTypeParameters(receiverType.substitutions)
      }
      return targetType
    },

    IndexExpression: (element) => {
      const receiverType = this.inferType(element.receiver)
      if (isAnyType(receiverType)) {
        return receiverType
      }

      const operator = this.memberProvider()
        .streamMembers(element.receiver)
        .filter(isOperatorFunctionDeclaration)
        .filter(it => it.operator === '[]')
        .filter(it => it.params.length === 1)
        .head()
      let returnType = this.inferType(operator?.retType)
      if (isClassType(receiverType)) {
        returnType = returnType?.substituteTypeParameters(receiverType.substitutions)
      }
      return returnType
    },

    CallExpression: (element) => {
      if (isReferenceExpression(element.receiver) || isMemberAccess(element.receiver)) {
        const receiver = element.receiver.entity.ref
        if (!receiver) {
          return
        }
        if (isConstructorDeclaration(receiver)) {
          const classDecl = AstUtils.getContainerOfType(receiver, isClassDeclaration)
          if (!classDecl) {
            return
          }
          return new ClassType(classDecl, new Map())
        }
      }
      const receiverType = this.inferType(element.receiver)
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

    IntegerLiteral: (element) => {
      switch (element.value.at(-1)) {
        case 'l':
        case 'L':
          return this.classTypeOf('long')

        default:
          return this.classTypeOf('int')
      }
    },

    FloatLiteral: (element) => {
      switch (element.value.at(-1)) {
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

    ArrayLiteral: (element) => {
      const arrayType = this.classTypeOf('Array')
      const T = arrayType.declaration.typeParams[0]
      arrayType.substitutions.set(T, this.inferType(element.values[0]) ?? this.classTypeOf('any'))
      return arrayType
    },

    MapLiteral: (element) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParams[0]
      const V = mapType.declaration.typeParams[1]
      mapType.substitutions.set(K, this.inferType(element.entries[0]?.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(element.entries[0]?.value) ?? this.classTypeOf('any'))
      return mapType
    },

    SyntheticAstNode: ({ content }) => {
      if ('$type' in content && content.$type === 'StringLiteral') {
        return this.classTypeOf('string')
      }
    },
  })
}
