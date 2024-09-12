import type { PrimitiveType } from '../generated/ast'

// region Internal
export type PrimitiveTypes = PrimitiveType['value']
export type MultiTypes = 'array' | 'list' | 'union' | 'intersection'
interface TypeFor<T> {
  $type: T
}
// endregion


export class TypeDescription {
  $type: string

  constructor($type: string) {
    this.$type = $type
  }
}

export class PrimitiveTypeDescription extends TypeDescription {
  constructor($type: PrimitiveTypes = 'any' as PrimitiveTypes) {
    super($type)
  }
}

export class FunctionTypeDescription extends TypeDescription {
  paramTypes: TypeDescription[]
  returnType: TypeDescription

  constructor(paramTypes: TypeDescription[], returnType: TypeDescription) {
    super('function')
    this.paramTypes = paramTypes
    this.returnType = returnType
  }
}

export class ClassTypeDescription extends TypeDescription {
  className: string

  constructor(className: string) {
    super('class')
    this.className = className
  }
}

export class MapTypeDescription extends TypeDescription {
  keyType: TypeDescription
  valueType: TypeDescription

  constructor(keyType: TypeDescription, valueType: TypeDescription) {
    super('map')
    this.keyType = keyType
    this.valueType = valueType
  }
}

export class ArrayTypeDescription extends TypeDescription {
  elementType: TypeDescription
  constructor(elementType: TypeDescription) {
    super('array')
    this.elementType = elementType
  }
}

export class ListTypeDescription extends TypeDescription {
  elementType: TypeDescription
  constructor(elementType: TypeDescription) {
    super('list')
    this.elementType = elementType
  }
}

export class UnionTypeDescription extends TypeDescription {
  elementTypes: TypeDescription[]
  constructor(elementTypes: TypeDescription[]) {
    super('union')
    this.elementTypes = elementTypes
  }
}

export class IntersectionTypeDescription extends TypeDescription {
  elementTypes: TypeDescription[]
  constructor(elementTypes: TypeDescription[]) {
    super('intersection')
    this.elementTypes = elementTypes
  }

}

// endregion

// region Predicates
export function isStringType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'string'
}

export function isAnyType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'any'
}

export function isBoolType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'bool'
}

export function isByteType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'byte'
}

export function isDoubleType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'double'
}

export function isFloatType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'float'
}

export function isIntType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'int'
}

export function isLongType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'long'
}

export function isShortType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'short'
}

export function isVoidType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc.$type === 'void'
}

export function isPrimitiveType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription {
  return typeDesc instanceof PrimitiveTypeDescription
}

export function isClassType(typeDesc: TypeDescription): typeDesc is ClassTypeDescription {
  return typeDesc instanceof ClassTypeDescription
}

export function isMapType(typeDesc: TypeDescription): typeDesc is MapTypeDescription {
  return typeDesc instanceof MapTypeDescription
}

export function isArrayType(typeDesc: TypeDescription): typeDesc is ArrayTypeDescription {
  return typeDesc instanceof ArrayTypeDescription
}

export function isListType(typeDesc: TypeDescription): typeDesc is ListTypeDescription {
  return typeDesc instanceof ListTypeDescription
}

export function isUnionType(typeDesc: TypeDescription): typeDesc is UnionTypeDescription {
  return typeDesc instanceof UnionTypeDescription
}

export function isIntersectionType(typeDesc: TypeDescription): typeDesc is IntersectionTypeDescription {
  return typeDesc instanceof IntersectionTypeDescription
}
// endregion
