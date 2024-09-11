import type { PrimitiveType } from '../generated/ast'

// region TypeDescription
export type PrimitiveTypes = PrimitiveType['value']
export type MultiTypes = 'array' | 'list' | 'union' | 'intersection'

interface TypeDefinition<T> {
  $type: T
}

export type TypeDescription = FunctionTypeDescription | ClassTypeDescription | MapTypeDescription | PrimitiveTypeDescription<PrimitiveTypes> | MultiTypeDescription<MultiTypes>

export interface PrimitiveTypeDescription<T extends PrimitiveTypes = 'any'> extends TypeDefinition<T> { }

export interface FunctionTypeDescription<
  P extends TypeDescription[] = TypeDescription[],
  R extends TypeDescription = TypeDescription,
> extends TypeDefinition<'function'> {
  paramTypes: P
  returnType: R
}

export interface ClassTypeDescription extends TypeDefinition<'class'> {
  className: string
}

export interface MapTypeDescription<
  K extends TypeDescription = TypeDescription,
  V extends TypeDescription = TypeDescription,
> extends TypeDefinition<'map'> {
  keyType: K
  valueType: V
}

export interface MultiTypeDescription<
  N extends MultiTypes = 'array',
  T = N extends Extract<MultiTypes, 'array' | 'list'> ? TypeDescription : TypeDescription[],
> extends TypeDefinition<N> {
  elementType: T
}
// end region

// region Predicates
export function isStringType(type: TypeDescription) {
  return type.$type === 'string'
}

export function isAnyType(type: TypeDescription) {
  return type.$type === 'any'
}

export function isBoolType(type: TypeDescription) {
  return type.$type === 'bool'
}

export function isByteType(type: TypeDescription) {
  return type.$type === 'byte'
}

export function isDoubleType(type: TypeDescription) {
  return type.$type === 'double'
}

export function isFloatType(type: TypeDescription) {
  return type.$type === 'float'
}

export function isIntType(type: TypeDescription) {
  return type.$type === 'int'
}

export function isLongType(type: TypeDescription) {
  return type.$type === 'long'
}

export function isShortType(type: TypeDescription) {
  return type.$type === 'short'
}

export function isVoidType(type: TypeDescription) {
  return type.$type === 'void'
}

export function isPrimitiveType(type: TypeDescription) {
  return ['string', 'any', 'bool', 'byte', 'double', 'float', 'int', 'long', 'short', 'void'].includes(type.$type)
}

export function isClassType(type: TypeDescription) {
  return type.$type === 'class'
}

export function isMapType(type: TypeDescription) {
  return type.$type === 'map'
}

export function isArrayType(type: TypeDescription) {
  return type.$type === 'array'
}

export function isListType(type: TypeDescription) {
  return type.$type === 'list'
}

export function isUnionType(type: TypeDescription) {
  return type.$type === 'union'
}

export function isIntersectionType(type: TypeDescription) {
  return type.$type === 'intersection'
}
// end region
