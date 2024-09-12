import { ArrayTypeDescription, ClassTypeDescription, FunctionTypeDescription, IntRangeTypeDescription, IntersectionTypeDescription, ListTypeDescription, MapTypeDescription, PrimitiveTypeDescription, UnionTypeDescription } from './description'
import type { PrimitiveTypes, TypeDescription } from './description'

export function createPrimitiveType<
  T extends PrimitiveTypes = 'any',
>($type: T = 'any' as T): PrimitiveTypeDescription {
  return new PrimitiveTypeDescription($type)
}

export function createAnyType(): PrimitiveTypeDescription {
  return createPrimitiveType('any')
}

export function createFunctionType<
  P extends TypeDescription[],
  R extends TypeDescription,
>(paramTypes: P, returnType: R): FunctionTypeDescription {
  return new FunctionTypeDescription(paramTypes, returnType)
}

export function createClassType(className: string): ClassTypeDescription {
  return new ClassTypeDescription(className)
}

export function createMapType<
  K extends TypeDescription,
  V extends TypeDescription,
>(keyType: K, valueType: V): MapTypeDescription {
  return new MapTypeDescription(keyType, valueType)
}

export function createArrayType<E extends TypeDescription>(elementType: E): ArrayTypeDescription {
  return new ArrayTypeDescription(elementType)
}

export function createListType<E extends TypeDescription>(elementType: E): ListTypeDescription {
  return new ListTypeDescription(elementType)
}

export function createUnionType(...elementTypes: TypeDescription[]): UnionTypeDescription {
  return new UnionTypeDescription(elementTypes)
}

export function createIntersectionType(...elementTypes: TypeDescription[]): IntersectionTypeDescription {
  return new IntersectionTypeDescription(elementTypes)
}

export function createIntRangeType(): IntRangeTypeDescription {
  return new IntRangeTypeDescription()
}
