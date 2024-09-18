import type { AstNode, ResolvedReference } from 'langium'
import type { BracketExpression, ClassDeclaration, ConditionalExpression, Declaration, Expression, FunctionExpression, ImportDeclaration, InfixExpression, LiteralExpression, LocalVariable, PrefixExpression, TypeReference, VariableDeclaration } from '../generated/ast'
import { isArrayLiteral, isArrayType, isAssignment, isBooleanLiteral, isBracketExpression, isClassDeclaration, isClassType, isConditionalExpression, isDeclaration, isExpression, isFloatingLiteral, isFunctionExpression, isFunctionType, isImportDeclaration, isInfixExpression, isInstanceofExpression, isIntegerLiteral, isIntersectionType, isListType, isLiteralExpression, isLocalVariable, isMapLiteral, isMapType, isNullLiteral, isParenthesizedExpression, isParenthesizedType, isPrefixExpression, isPrimitiveType, isStringLiteral, isStringTemplate, isTypeCastExpression, isTypeReference, isUnionType, isVariableDeclaration } from '../generated/ast'
import { ClassTypeDescription, type TypeDescription } from './description'
import { createAnyType, createArrayType, createClassType, createFunctionType, createIntRangeType, createIntersectionType, createListType, createMapType, createPackageType, createPrimitiveType, createProperType, createUnionType } from './factory'

export type TypeComputer = Pick<InstanceType<typeof ZenScriptTypeComputer>, 'inferType'>

export class ZenScriptTypeComputer {
  public inferType(node: AstNode): TypeDescription | undefined {
    if (isExpression(node)) {
      return this.inferExpression(node)
    }

    if (isTypeReference(node)) {
      return this.inferTypeReference(node)
    }

    if (isDeclaration(node)) {
      return this.inferDeclaration(node)
    }
  }

  // region TypeReference
  private inferTypeReference(type: TypeReference): TypeDescription | undefined {
    if (isPrimitiveType(type)) {
      return createPrimitiveType(type.value)
    }

    if (isListType(type)) {
      const elementType = this.inferTypeReference(type.value) || createAnyType()
      return createListType(elementType)
    }

    if (isArrayType(type)) {
      const elementType = this.inferTypeReference(type.value) || createAnyType()
      return createListType(elementType)
    }

    if (isMapType(type)) {
      const keyType = this.inferTypeReference(type.key) || createAnyType()
      const valueType = this.inferTypeReference(type.value) || createAnyType()
      return createMapType(keyType, valueType)
    }

    if (isUnionType(type)) {
      const elementTypes = type.values.map(t => this.inferTypeReference(t) || createAnyType())
      return createUnionType(...elementTypes)
    }

    if (isIntersectionType(type)) {
      const elementTypes = type.values.map(t => this.inferTypeReference(t) || createAnyType())
      return createIntersectionType(...elementTypes)
    }

    if (isParenthesizedType(type)) {
      return this.inferTypeReference(type.value)
    }

    if (isFunctionType(type)) {
      const paramTypes = type.params.map(t => this.inferTypeReference(t) || createAnyType())
      const returnType = this.inferTypeReference(type.returnType) || createAnyType()
      return createFunctionType(paramTypes, returnType)
    }

    if (isClassType(type)) {
      const typeDesc = new ClassTypeDescription(type.ref.$refText)
      typeDesc.ref = type.ref as ResolvedReference<ClassDeclaration>
      return typeDesc
    }
  }
  // endregion

  // region Declaration
  private inferDeclaration(node: Declaration): TypeDescription | undefined {
    if (isVariableDeclaration(node)) {
      return this.inferVariableDeclaration(node)
    }
    else if (isClassDeclaration(node)) {
      return this.inferClassDeclaration(node)
    }
    else if (isImportDeclaration(node)) {
      return this.inferImportDeclaration(node)
    }
  }

  private inferVariableDeclaration(node: VariableDeclaration): TypeDescription | undefined {
    if (node.typeRef) {
      return this.inferTypeReference(node.typeRef)
    }
    else if (node.initializer) {
      return this.inferExpression(node.initializer)
    }
    else {
      return createAnyType()
    }
  }

  private inferClassDeclaration(node: ClassDeclaration): TypeDescription | undefined {
    const typeDesc = createProperType(node.name)
    typeDesc.ref = { ref: node } as ResolvedReference<ClassDeclaration>
    return typeDesc
  }

  private inferImportDeclaration(node: ImportDeclaration): TypeDescription | undefined {
    const typeDesc = createPackageType()
    typeDesc.ref = { ref: node.ref.ref } as ResolvedReference<ImportDeclaration>
    return typeDesc
  }
  // endregion

  // region Expression
  private inferExpression(node: Expression): TypeDescription | undefined {
    if (isAssignment(node)) {
      return this.inferType(node.right)
    }

    if (isConditionalExpression(node)) {
      return this.inferConditionalExpression(node)
    }

    if (isInfixExpression(node)) {
      return this.inferInfixExpression(node)
    }

    if (isTypeCastExpression(node)) {
      const ref = node.typeRef
      return this.inferTypeReference(ref)
    }

    if (isInstanceofExpression(node)) {
      return createPrimitiveType('bool')
    }

    if (isPrefixExpression(node)) {
      return this.inferPrefixExpression(node)
    }

    if (isParenthesizedExpression(node)) {
      return this.inferType(node.expr)
    }

    if (isBracketExpression(node)) {
      return this.inferBracketExpression(node)
    }

    if (isFunctionExpression(node)) {
      return this.inferFunctionExpression(node)
    }

    if (isLiteralExpression(node)) {
      return this.inferLiteralExpression(node)
    }

    if (isLocalVariable(node)) {
      return this.inferLocalVariable(node)
    }
  }

  private inferLocalVariable(node: LocalVariable): TypeDescription | undefined {
    const ref = node.ref.ref
    if (!ref) {
      return
    }

    return this.inferType(ref)
  }

  private inferLiteralExpression(node: LiteralExpression): TypeDescription | undefined {
    if (isArrayLiteral(node)) {
      const elementType = (node.values.length > 0 && this.inferExpression(node.values[0]))
        || createAnyType()
      return createArrayType(elementType)
    }

    if (isBooleanLiteral(node)) {
      return createPrimitiveType('bool')
    }

    if (isMapLiteral(node)) {
      const keyType = (node.entries.length > 0 && this.inferExpression(node.entries[0].key))
        || createAnyType()
      const valueType = (node.entries.length > 0 && this.inferExpression(node.entries[0].value))
        || createAnyType()
      return createMapType(keyType, valueType)
    }

    if (isNullLiteral(node)) {
      // TODO: does it make sense?
      return createAnyType()
    }

    if (isIntegerLiteral(node)) {
      switch (node.value.at(-1)) {
        case 'l':
        case 'L':
          return createPrimitiveType('long')

        default:
          return createPrimitiveType('int')
      }
    }

    if (isFloatingLiteral(node)) {
      switch (node.value.at(-1)) {
        case 'f':
        case 'F':
          return createPrimitiveType('float')

        case 'd':
        case 'D':
          return createPrimitiveType('double')

        default:
          return createPrimitiveType('double')
      }
    }

    if (isStringLiteral(node) || isStringTemplate(node)) {
      return createPrimitiveType('string')
    }
  }

  private inferFunctionExpression(node: FunctionExpression): TypeDescription | undefined {
    const paramTypes = node.parameters.map((p) => {
      const ref = p.typeRef
      return (ref && this.inferTypeReference(ref)) || createAnyType()
    })

    const returnType = (node.returnTypeRef && this.inferTypeReference(node.returnTypeRef)) || createAnyType()

    return createFunctionType(paramTypes, returnType)
  }

  private inferBracketExpression(node: BracketExpression): TypeDescription | undefined {
    const _ = node.value
    // TODO: 解析尖括号
    return createClassType('unknown bracket type')
  }

  private inferConditionalExpression(node: ConditionalExpression): TypeDescription | undefined {
    // TODO: 运算符重载
    const _ = node
    return createPrimitiveType('bool')
  }

  private inferPrefixExpression(node: PrefixExpression): TypeDescription {
    const op = node.op
    switch (op) {
      case '-':
        return createPrimitiveType('int')
      case '!':
        return createPrimitiveType('bool')
    }
  }

  private inferInfixExpression(node: InfixExpression): TypeDescription | undefined {
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
        return createIntRangeType()
    }
  }
  // endregion
}
