import type { Reference } from 'langium'
import type { ClassDeclaration, PrimitiveType } from '../generated/ast'

// region TypeDescription
export class TypeDescription {
  $type: string

  constructor($type: string) {
    this.$type = $type
  }
}

export class PrimitiveTypeDescription extends TypeDescription {
  constructor($type: PrimitiveType['value']) {
    super($type)
  }

  static ANY = new PrimitiveTypeDescription('any')
  static BOOL = new PrimitiveTypeDescription('bool')
  static BYTE = new PrimitiveTypeDescription('byte')
  static SHORT = new PrimitiveTypeDescription('short')
  static INT = new PrimitiveTypeDescription('int')
  static LONG = new PrimitiveTypeDescription('long')
  static FLOAT = new PrimitiveTypeDescription('float')
  static DOUBLE = new PrimitiveTypeDescription('double')
  static STRING = new PrimitiveTypeDescription('string')
  static VOID = new PrimitiveTypeDescription('void')
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

export class ProperTypeDescription extends TypeDescription {
  className: string
  ref?: Reference<ClassDeclaration>

  constructor(className: string) {
    super('proper')
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

export class PackageTypeDescription extends TypeDescription {
  packageName: string
  constructor(packageName: string) {
    super('package')
    this.packageName = packageName
  }
}

// endregion

// region Predicates
export function isStringTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'string'
}

export function isAnyTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'any'
}

export function isBoolTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'bool'
}

export function isByteTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'byte'
}

export function isDoubleTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'double'
}

export function isFloatTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'float'
}

export function isIntTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'int'
}

export function isLongTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'long'
}

export function isShortTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'short'
}

export function isVoidTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc?.$type === 'void'
}

export function isPrimitiveTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PrimitiveTypeDescription {
  return typeDesc instanceof PrimitiveTypeDescription
}

export function isClassTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is ClassTypeDescription {
  return typeDesc instanceof ClassTypeDescription
}

export function isProperTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is ProperTypeDescription {
  return typeDesc instanceof ProperTypeDescription
}

export function isMapTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is MapTypeDescription {
  return typeDesc instanceof MapTypeDescription
}

export function isArrayTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is ArrayTypeDescription {
  return typeDesc instanceof ArrayTypeDescription
}

export function isListTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is ListTypeDescription {
  return typeDesc instanceof ListTypeDescription
}

export function isUnionTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is UnionTypeDescription {
  return typeDesc instanceof UnionTypeDescription
}

export function isIntersectionTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is IntersectionTypeDescription {
  return typeDesc instanceof IntersectionTypeDescription
}

export function isPackageTypeDesc(typeDesc: TypeDescription | undefined): typeDesc is PackageTypeDescription {
  return typeDesc instanceof PackageTypeDescription
}
// endregion
