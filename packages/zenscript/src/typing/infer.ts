import type { AstNode } from 'langium'
import type { BracketExpression, ConditionalExpression, Expression, FunctionExpression, InfixExpression, LiteralExpression, LocalVariable, PrefixExpression, TypeReference } from '../generated/ast'
import { isArrayLiteral, isArrayType, isAssignment, isBooleanLiteral, isBracketExpression, isClassDeclaration, isConditionalExpression, isExpression, isFunctionExpression, isFunctionType, isInfixExpression, isInstanceofExpression, isIntersectionType, isListType, isLiteralExpression, isLocalVariable, isMapLiteral, isMapType, isNullLiteral, isNumberLiteral, isParenthesizedExpression, isParenthesizedType, isPrefixExpression, isPrimitiveType, isReferenceType, isStringLiteral, isStringTemplate, isTypeCastExpression, isTypeReference, isUnionType, isVariableDeclaration } from '../generated/ast'

import { ClassTypeDescription, type TypeDescription } from './description'

import { createAnyType, createArrayType, createClassType, createFunctionType, createIntersectionType, createListType, createMapType, createPrimitiveType, createUnionType } from './factory'

export interface TypeInferrer {
  inferType: (node: AstNode) => TypeDescription | undefined
}

export class ZenScriptTypeInferrer implements TypeInferrer {
  public inferType(node: AstNode): TypeDescription | undefined {
    if (isExpression(node)) {
      return this.inferExpressionType(node)
    }

    if (isTypeReference(node)) {
      return this.resolveTypeReference(node)
    }

    if (isVariableDeclaration(node)) {
      if (node.typeRef) {
        return this.resolveTypeReference(node.typeRef)
      }
      if (node.initializer) {
        return this.inferType(node.initializer)
      }
    }

    if (isClassDeclaration(node)) {
      return new ClassTypeDescription(node)
    }
  }

  public resolveTypeReference(type: TypeReference): TypeDescription | undefined {
    if (isPrimitiveType(type)) {
      return createPrimitiveType(type.value)
    }

    if (isListType(type)) {
      const elementType = this.resolveTypeReference(type.value) || createAnyType()
      return createListType(elementType)
    }

    if (isArrayType(type)) {
      const elementType = this.resolveTypeReference(type.value) || createAnyType()
      return createListType(elementType)
    }

    if (isMapType(type)) {
      const keyType = this.resolveTypeReference(type.key) || createAnyType()
      const valueType = this.resolveTypeReference(type.value) || createAnyType()
      return createMapType(keyType, valueType)
    }

    if (isUnionType(type)) {
      const elementTypes = type.values.map(t => this.resolveTypeReference(t) || createAnyType())
      return createUnionType(...elementTypes)
    }

    if (isIntersectionType(type)) {
      const elementTypes = type.values.map(t => this.resolveTypeReference(t) || createAnyType())
      return createIntersectionType(...elementTypes)
    }

    if (isParenthesizedType(type)) {
      return this.resolveTypeReference(type.value)
    }

    if (isFunctionType(type)) {
      const paramTypes = type.params.map(t => this.resolveTypeReference(t) || createAnyType())
      const returnType = this.resolveTypeReference(type.returnType) || createAnyType()
      return createFunctionType(paramTypes, returnType)
    }

    if (isReferenceType(type)) {
      return new ClassTypeDescription(type.ref)
    }
  }

  // #region Expression
  inferExpressionType(node: Expression): TypeDescription | undefined {
    if (isAssignment(node)) {
      return this.inferType(node.right)
    }

    if (isConditionalExpression(node)) {
      return this.inferConditionalExpressionType(node)
    }

    if (isInfixExpression(node)) {
      return this.inferInfixExpressionType(node)
    }

    if (isTypeCastExpression(node)) {
      const ref = node.typeRef
      return this.resolveTypeReference(ref)
    }

    if (isInstanceofExpression(node)) {
      return createPrimitiveType('bool')
    }

    if (isPrefixExpression(node)) {
      return this.inferPrefixExpressionType(node)
    }

    if (isParenthesizedExpression(node)) {
      return this.inferType(node.expr)
    }

    if (isBracketExpression(node)) {
      return this.inferBracketExpressionType(node)
    }

    if (isFunctionExpression(node)) {
      return this.inferFunctionExpressionType(node)
    }

    if (isLiteralExpression(node)) {
      return this.inferLiteralExpressionType(node)
    }

    if (isLocalVariable(node)) {
      return this.inferLocalVariableType(node)
    }
  }

  private inferLocalVariableType(node: LocalVariable): TypeDescription | undefined {
    const ref = node.ref.ref
    if (!ref) {
      return
    }

    return this.inferType(ref)
  }

  private inferLiteralExpressionType(node: LiteralExpression): TypeDescription | undefined {
    if (isArrayLiteral(node)) {
      const elementType = (node.values.length > 0 && this.inferExpressionType(node.values[0]))
        || createAnyType()
      return createArrayType(elementType)
    }

    if (isBooleanLiteral(node)) {
      return createPrimitiveType('bool')
    }

    if (isMapLiteral(node)) {
      const keyType = (node.entries.length > 0 && this.inferExpressionType(node.entries[0].key))
        || createAnyType()
      const valueType = (node.entries.length > 0 && this.inferExpressionType(node.entries[0].value))
        || createAnyType()
      return createMapType(keyType, valueType)
    }

    if (isNullLiteral(node)) {
      // return createPrimitiveType('null')
      // TODO: what is the type of null?
    }

    if (isNumberLiteral(node)) {
      return createPrimitiveType('int')
    }

    if (isStringLiteral(node) || isStringTemplate(node)) {
      return createPrimitiveType('string')
    }
  }

  private inferFunctionExpressionType(node: FunctionExpression): TypeDescription | undefined {
    const paramTypes = node.parameters.map((p) => {
      const ref = p.typeRef
      return (ref && this.resolveTypeReference(ref)) || createAnyType()
    })

    const returnType = (node.returnTypeRef && this.resolveTypeReference(node.returnTypeRef)) || createAnyType()

    return createFunctionType(paramTypes, returnType)
  }

  private inferBracketExpressionType(node: BracketExpression): TypeDescription | undefined {
    const _ = node.value
    // TODO: 解析尖括号
    return createClassType('unknown bracket type')
  }

  private inferConditionalExpressionType(node: ConditionalExpression): TypeDescription | undefined {
    // TODO: 运算符重载
    const _ = node
    return createPrimitiveType('bool')
  }

  private inferPrefixExpressionType(node: PrefixExpression): TypeDescription {
    const op = node.op
    switch (op) {
      case '-':
        return createPrimitiveType('int')
      case '!':
        return createPrimitiveType('bool')
    }
  }

  private inferInfixExpressionType(node: InfixExpression): TypeDescription | undefined {
    // TODO: 运算符重载
    const op = node.op
    switch (op) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '%':
        return createPrimitiveType('int')
      case '<':
      case '>':
      case '<=':
      case '>=':
        return createPrimitiveType('bool')
      case '==':
      case '!=':
        return createPrimitiveType('bool')
      case '&&':
      case '||':
        return createPrimitiveType('bool')
      case 'has':
      case 'in':
        return createPrimitiveType('bool')
      case '&':
      case '|':
      case '^':
        return createPrimitiveType('int')
      case '~':
        return createPrimitiveType('string')
      case 'to':
      case '..':
        return createClassType('internal.IntRange') // TODO: IntRange 是个什么类型
    }
  }

  // #endregion
}
