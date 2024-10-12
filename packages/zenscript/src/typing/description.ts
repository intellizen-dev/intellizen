import type { Reference } from 'langium'
import type { ClassDeclaration } from '../generated/ast'

// region TypeDescription
export interface TypeDescConstants {
  function: FunctionTypeDescription
  class: ClassTypeDescription
  proper: ProperTypeDescription
  map: MapTypeDescription
  array: ArrayTypeDescription
  list: ListTypeDescription
  union: UnionTypeDescription
  intersection: IntersectionTypeDescription
  int_range: IntRangeTypeDescription
  package: PackageTypeDescription
}

export class TypeDescription<T extends keyof TypeDescConstants = keyof TypeDescConstants> {
  $type: T

  constructor($type: T) {
    this.$type = $type
  }
}

export class FunctionTypeDescription extends TypeDescription<'function'> {
  paramTypes: TypeDescription[]
  returnType: TypeDescription

  constructor(paramTypes: TypeDescription[], returnType: TypeDescription) {
    super('function')
    this.paramTypes = paramTypes
    this.returnType = returnType
  }
}

export class ClassTypeDescription extends TypeDescription<'class'> {
  className: string
  ref?: Reference<ClassDeclaration>

  constructor(className: string) {
    super('class')
    this.className = className
  }

  static ANY = new ClassTypeDescription('any')
  static BOOL = new ClassTypeDescription('bool')
  static BYTE = new ClassTypeDescription('byte')
  static SHORT = new ClassTypeDescription('short')
  static INT = new ClassTypeDescription('int')
  static LONG = new ClassTypeDescription('long')
  static FLOAT = new ClassTypeDescription('float')
  static DOUBLE = new ClassTypeDescription('double')
  static STRING = new ClassTypeDescription('string')
  static VOID = new ClassTypeDescription('void')
}

export class ProperTypeDescription extends TypeDescription<'proper'> {
  className: string
  ref?: Reference<ClassDeclaration>

  constructor(className: string) {
    super('proper')
    this.className = className
  }
}

export class MapTypeDescription extends TypeDescription<'map'> {
  keyType: TypeDescription
  valueType: TypeDescription

  constructor(keyType: TypeDescription, valueType: TypeDescription) {
    super('map')
    this.keyType = keyType
    this.valueType = valueType
  }
}

export class ArrayTypeDescription extends TypeDescription<'array'> {
  elementType: TypeDescription
  constructor(elementType: TypeDescription) {
    super('array')
    this.elementType = elementType
  }
}

export class ListTypeDescription extends TypeDescription<'list'> {
  elementType: TypeDescription
  constructor(elementType: TypeDescription) {
    super('list')
    this.elementType = elementType
  }
}

export class UnionTypeDescription extends TypeDescription<'union'> {
  elementTypes: TypeDescription[]
  constructor(elementTypes: TypeDescription[]) {
    super('union')
    this.elementTypes = elementTypes
  }
}

export class IntersectionTypeDescription extends TypeDescription<'intersection'> {
  elementTypes: TypeDescription[]
  constructor(elementTypes: TypeDescription[]) {
    super('intersection')
    this.elementTypes = elementTypes
  }
}

export class IntRangeTypeDescription extends TypeDescription<'int_range'> {
  constructor() {
    super('int_range')
  }
}

export class PackageTypeDescription extends TypeDescription<'package'> {
  packageName: string
  constructor(packageName: string) {
    super('package')
    this.packageName = packageName
  }
}

// endregion

// region Predicates
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

export function isProperTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is ProperTypeDescription {
  return typeDesc instanceof ProperTypeDescription
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

export function isPackageTypeDescription(typeDesc: TypeDescription | undefined): typeDesc is PackageTypeDescription {
  return typeDesc instanceof PackageTypeDescription
}
// endregion
