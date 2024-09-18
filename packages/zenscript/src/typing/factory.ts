import { ArrayTypeDescription, ClassTypeDescription, FunctionTypeDescription, IntRangeTypeDescription, IntersectionTypeDescription, ListTypeDescription, MapTypeDescription, PackageTypeDescription, PrimitiveTypeDescription, ProperTypeDescription, UnionTypeDescription } from './description'
import type { PrimitiveTypes, TypeDescription } from './description'

export function createPrimitiveType($type: PrimitiveTypes): PrimitiveTypeDescription {
  return new PrimitiveTypeDescription($type)
}

export function createAnyType(): PrimitiveTypeDescription {
  return createPrimitiveType('any')
}

export function createFunctionType(paramTypes: TypeDescription[], returnType: TypeDescription): FunctionTypeDescription {
  return new FunctionTypeDescription(paramTypes, returnType)
}

export function createClassType(className: string): ClassTypeDescription {
  return new ClassTypeDescription(className)
}

export function createProperType(className: string): ProperTypeDescription {
  return new ProperTypeDescription(className)
}

export function createMapType(keyType: TypeDescription, valueType: TypeDescription): MapTypeDescription {
  return new MapTypeDescription(keyType, valueType)
}

export function createArrayType(elementType: TypeDescription): ArrayTypeDescription {
  return new ArrayTypeDescription(elementType)
}

export function createListType(elementType: TypeDescription): ListTypeDescription {
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

export function createPackageType(): PackageTypeDescription {
  return new PackageTypeDescription()
}
