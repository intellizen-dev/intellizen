import type { AstNode, ResolvedReference } from 'langium'
import type { BracketExpression, ClassDeclaration, ConditionalExpression, Declaration, Expression, FunctionExpression, ImportDeclaration, InfixExpression, LiteralExpression, LocalVariable, PrefixExpression, TypeReference, VariableDeclaration } from '../generated/ast'
import { isArrayLiteral, isArrayTypeReference, isAssignment, isBooleanLiteral, isBracketExpression, isClassDeclaration, isClassTypeReference, isConditionalExpression, isDeclaration, isExpression, isFloatingLiteral, isFunctionExpression, isFunctionTypeReference, isImportDeclaration, isInfixExpression, isInstanceofExpression, isIntegerLiteral, isIntersectionTypeReference, isListTypeReference, isLiteralExpression, isLocalVariable, isMapLiteral, isMapTypeReference, isNullLiteral, isParenthesizedExpression, isParenthesizedTypeReference, isPrefixExpression, isPrimitiveTypeReference, isStringLiteral, isStringTemplate, isTypeCastExpression, isTypeReference, isUnionTypeReference, isVariableDeclaration } from '../generated/ast'
import { ArrayTypeDescription, ClassTypeDescription, FunctionTypeDescription, IntRangeTypeDescription, IntersectionTypeDescription, ListTypeDescription, MapTypeDescription, PackageTypeDescription, PrimitiveTypeDescription, ProperTypeDescription, type TypeDescription, UnionTypeDescription } from './description'

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
    if (isPrimitiveTypeReference(type)) {
      return new PrimitiveTypeDescription(type.value)
    }

    if (isListTypeReference(type)) {
      const elementType = this.inferTypeReference(type.value) || PrimitiveTypeDescription.ANY
      return new ListTypeDescription(elementType)
    }

    if (isArrayTypeReference(type)) {
      const elementType = this.inferTypeReference(type.value) || PrimitiveTypeDescription.ANY
      return new ListTypeDescription(elementType)
    }

    if (isMapTypeReference(type)) {
      const keyType = this.inferTypeReference(type.key) || PrimitiveTypeDescription.ANY
      const valueType = this.inferTypeReference(type.value) || PrimitiveTypeDescription.ANY
      return new MapTypeDescription(keyType, valueType)
    }

    if (isUnionTypeReference(type)) {
      const elementTypes = type.values.map(t => this.inferTypeReference(t) || PrimitiveTypeDescription.ANY)
      return new UnionTypeDescription(elementTypes)
    }

    if (isIntersectionTypeReference(type)) {
      const elementTypes = type.values.map(t => this.inferTypeReference(t) || PrimitiveTypeDescription.ANY)
      return new IntersectionTypeDescription(elementTypes)
    }

    if (isParenthesizedTypeReference(type)) {
      return this.inferTypeReference(type.value)
    }

    if (isFunctionTypeReference(type)) {
      const paramTypes = type.params.map(t => this.inferTypeReference(t) || PrimitiveTypeDescription.ANY)
      const returnType = this.inferTypeReference(type.returnType) || PrimitiveTypeDescription.ANY
      return new FunctionTypeDescription(paramTypes, returnType)
    }

    if (isClassTypeReference(type)) {
      const className = type.path.map(it => it.$refText).join('.')
      const typeDesc = new ClassTypeDescription(className)
      const ref = type.path.at(-1)
      if (isClassDeclaration(ref?.ref)) {
        typeDesc.ref = ref as ResolvedReference<ClassDeclaration>
      }
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
      return PrimitiveTypeDescription.ANY
    }
  }

  private inferClassDeclaration(node: ClassDeclaration): TypeDescription | undefined {
    const typeDesc = new ProperTypeDescription(node.name)
    typeDesc.ref = { ref: node } as ResolvedReference<ClassDeclaration>
    return typeDesc
  }

  private inferImportDeclaration(node: ImportDeclaration): TypeDescription | undefined {
    return new PackageTypeDescription(node.path.at(-1)!.$refText)
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
      return PrimitiveTypeDescription.BOOL
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
    const ref = node.refer.ref
    if (!ref) {
      return
    }

    return this.inferType(ref)
  }

  private inferLiteralExpression(node: LiteralExpression): TypeDescription | undefined {
    if (isArrayLiteral(node)) {
      const elementType = (node.values.length > 0 && this.inferExpression(node.values[0]))
        || PrimitiveTypeDescription.ANY
      return new ArrayTypeDescription(elementType)
    }

    if (isBooleanLiteral(node)) {
      return PrimitiveTypeDescription.BOOL
    }

    if (isMapLiteral(node)) {
      const keyType = (node.entries.length > 0 && this.inferExpression(node.entries[0].key))
        || PrimitiveTypeDescription.ANY
      const valueType = (node.entries.length > 0 && this.inferExpression(node.entries[0].value))
        || PrimitiveTypeDescription.ANY
      return new MapTypeDescription(keyType, valueType)
    }

    if (isNullLiteral(node)) {
      // TODO: does it make sense?
      return PrimitiveTypeDescription.ANY
    }

    if (isIntegerLiteral(node)) {
      switch (node.value.at(-1)) {
        case 'l':
        case 'L':
          return PrimitiveTypeDescription.LONG

        default:
          return PrimitiveTypeDescription.INT
      }
    }

    if (isFloatingLiteral(node)) {
      switch (node.value.at(-1)) {
        case 'f':
        case 'F':
          return PrimitiveTypeDescription.FLOAT

        case 'd':
        case 'D':
          return PrimitiveTypeDescription.DOUBLE

        default:
          return PrimitiveTypeDescription.DOUBLE
      }
    }

    if (isStringLiteral(node) || isStringTemplate(node)) {
      return PrimitiveTypeDescription.STRING
    }
  }

  private inferFunctionExpression(node: FunctionExpression): TypeDescription | undefined {
    const paramTypes = node.parameters.map((p) => {
      const ref = p.typeRef
      return (ref && this.inferTypeReference(ref)) || PrimitiveTypeDescription.ANY
    })

    const returnType = (node.returnTypeRef && this.inferTypeReference(node.returnTypeRef)) || PrimitiveTypeDescription.ANY

    return new FunctionTypeDescription(paramTypes, returnType)
  }

  private inferBracketExpression(node: BracketExpression): TypeDescription | undefined {
    const _ = node.value
    // TODO: 解析尖括号
    return new ClassTypeDescription('unknown bracket type')
  }

  private inferConditionalExpression(node: ConditionalExpression): TypeDescription | undefined {
    // TODO: 运算符重载
    const _ = node
    return PrimitiveTypeDescription.BOOL
  }

  private inferPrefixExpression(node: PrefixExpression): TypeDescription {
    const op = node.op
    switch (op) {
      case '-':
        return PrimitiveTypeDescription.INT
      case '!':
        return PrimitiveTypeDescription.BOOL
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
        return PrimitiveTypeDescription.INT
      case '<':
      case '>':
      case '<=':
      case '>=':
        return PrimitiveTypeDescription.BOOL
      case '==':
      case '!=':
        return PrimitiveTypeDescription.BOOL
      case '&&':
      case '||':
        return PrimitiveTypeDescription.BOOL
      case 'has':
      case 'in':
        return PrimitiveTypeDescription.BOOL
      case '&':
      case '|':
      case '^':
        return PrimitiveTypeDescription.INT
      case '~':
        return PrimitiveTypeDescription.STRING
      case 'to':
      case '..':
        return new IntRangeTypeDescription()
    }
  }
  // endregion
}
