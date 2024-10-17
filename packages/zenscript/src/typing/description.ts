import type { Reference } from 'langium'
import type { ClassDeclaration } from '../generated/ast'

// region TypeDescription
export interface TypeDescConstants {
  function: FunctionTypeDescription
  class: ClassTypeDescription
  map: MapTypeDescription
  array: ArrayTypeDescription
  list: ListTypeDescription
  union: UnionTypeDescription
  intersection: IntersectionTypeDescription
  int_range: IntRangeTypeDescription
}

export type BuiltinTypes = 'any' | 'bool' | 'byte' | 'short' | 'int' | 'long' | 'float' | 'double' | 'string' | 'void'

export class TypeDescription {
  $type: string
  constructor($type: keyof TypeDescConstants) {
    this.$type = $type
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
  ref?: Reference<ClassDeclaration>
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

export class IntRangeTypeDescription extends TypeDescription {
  constructor() {
    super('int_range')
  }
}
// endregion

// region Predicates
export function isFunctionTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is FunctionTypeDescription {
  return typeDesc instanceof FunctionTypeDescription
}

export function isStringType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'string'
}

export function isAnyType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'any'
}

export function isBoolType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'bool'
}

export function isByteType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'byte'
}

export function isDoubleType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'double'
}

export function isFloatType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'float'
}

export function isIntType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'int'
}

export function isLongType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'long'
}

export function isShortType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'short'
}

export function isVoidType(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return isClassTypeDescription(typeDesc) && typeDesc.className === 'void'
}

export function isClassTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return typeDesc instanceof ClassTypeDescription
}

export function isMapTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is MapTypeDescription {
  return typeDesc instanceof MapTypeDescription
}

export function isArrayTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is ArrayTypeDescription {
  return typeDesc instanceof ArrayTypeDescription
}

export function isListTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is ListTypeDescription {
  return typeDesc instanceof ListTypeDescription
}

export function isUnionTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is UnionTypeDescription {
  return typeDesc instanceof UnionTypeDescription
}

export function isIntersectionTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is IntersectionTypeDescription {
  return typeDesc instanceof IntersectionTypeDescription
}
// endregion
