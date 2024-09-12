import type { PrimitiveType } from '../generated/ast'

// region Internal
export type PrimitiveTypes = PrimitiveType['value']
export type MultiTypes = 'array' | 'list' | 'union' | 'intersection'
interface TypeFor<T> {
  $type: T
}
// endregion

// region TypeDescription
export type TypeDescription = FunctionTypeDescription | ClassTypeDescription | MapTypeDescription | PrimitiveTypeDescription<PrimitiveTypes> | MultiTypeDescription<MultiTypes>

export interface PrimitiveTypeDescription<T extends PrimitiveTypes = 'any'> extends TypeFor<T> { }

export interface FunctionTypeDescription<
  P extends TypeDescription[] = TypeDescription[],
  R extends TypeDescription = TypeDescription,
> extends TypeFor<'function'> {
  paramTypes: P
  returnType: R
}

export interface ClassTypeDescription extends TypeFor<'class'> {
  className: string
}

export interface MapTypeDescription<
  K extends TypeDescription = TypeDescription,
  V extends TypeDescription = TypeDescription,
> extends TypeFor<'map'> {
  keyType: K
  valueType: V
}

export interface MultiTypeDescription<
  N extends MultiTypes,
  T = N extends Extract<MultiTypes, 'array' | 'list'> ? TypeDescription : TypeDescription[],
> extends TypeFor<N> {
  elementType: T
}
// endregion

// region Predicates
export function isStringType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'string'> {
  return typeDesc.$type === 'string'
}

export function isAnyType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'any'> {
  return typeDesc.$type === 'any'
}

export function isBoolType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'bool'> {
  return typeDesc.$type === 'bool'
}

export function isByteType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'byte'> {
  return typeDesc.$type === 'byte'
}

export function isDoubleType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'double'> {
  return typeDesc.$type === 'double'
}

export function isFloatType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'float'> {
  return typeDesc.$type === 'float'
}

export function isIntType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'int'> {
  return typeDesc.$type === 'int'
}

export function isLongType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'long'> {
  return typeDesc.$type === 'long'
}

export function isShortType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'short'> {
  return typeDesc.$type === 'short'
}

export function isVoidType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<'void'> {
  return typeDesc.$type === 'void'
}

export function isPrimitiveType(typeDesc: TypeDescription): typeDesc is PrimitiveTypeDescription<PrimitiveTypes> {
  return ['string', 'any', 'bool', 'byte', 'double', 'float', 'int', 'long', 'short', 'void'].includes(typeDesc.$type)
}

export function isClassType(typeDesc: TypeDescription): typeDesc is ClassTypeDescription {
  return typeDesc.$type === 'class'
}

export function isMapType(typeDesc: TypeDescription): typeDesc is MapTypeDescription {
  return typeDesc.$type === 'map'
}

export function isArrayType(typeDesc: TypeDescription): typeDesc is MultiTypeDescription<'array'> {
  return typeDesc.$type === 'array'
}

export function isListType(typeDesc: TypeDescription): typeDesc is MultiTypeDescription<'list'> {
  return typeDesc.$type === 'list'
}

export function isUnionType(typeDesc: TypeDescription): typeDesc is MultiTypeDescription<'union'> {
  return typeDesc.$type === 'union'
}

export function isIntersectionType(typeDesc: TypeDescription): typeDesc is MultiTypeDescription<'intersection'> {
  return typeDesc.$type === 'intersection'
}
// endregion
