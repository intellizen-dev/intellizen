import type { Reference } from 'langium'
import type { ClassDeclaration, TypeParameter } from '../generated/ast'

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

export type BuiltinTypes = 'any' | 'bool' | 'byte' | 'short' | 'int' | 'long' | 'float' | 'double' | 'string' | 'void' | 'Array' | 'List' | 'Map'

export type TypeParameterSubstitutions = Map<TypeParameter, TypeDescription>

export abstract class TypeDescription {
  $type: string
  protected constructor($type: keyof TypeDescConstants) {
    this.$type = $type
  }

  abstract substituteTypeParameters(substitutions: TypeParameterSubstitutions): void
}

export class FunctionTypeDescription extends TypeDescription {
  paramTypes: TypeDescription[]
  returnType: TypeDescription
  constructor(paramTypes: TypeDescription[], returnType: TypeDescription) {
    super('function')
    this.paramTypes = paramTypes
    this.returnType = returnType
  }

  substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    this.paramTypes.forEach(it => it.substituteTypeParameters(substitutions))
    this.returnType.substituteTypeParameters(substitutions)
  }
}

export class ClassTypeDescription extends TypeDescription {
  className: string
  substitutions?: TypeParameterSubstitutions
  refer?: Reference<ClassDeclaration | TypeParameter>
  constructor(className: string) {
    super('class')
    this.className = className
  }

  substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    if (this.substitutions) {
      throw new Error(`Type parameters have already been substituted for "${this.className}".`)
    }
    this.substitutions = substitutions
  }
}

export class ArrayTypeDescription extends ClassTypeDescription {
  constructor() {
    super('Array')
  }
}

export class ListTypeDescription extends ClassTypeDescription {
  constructor() {
    super('List')
  }
}

export class MapTypeDescription extends ClassTypeDescription {
  constructor() {
    super('Map')
  }
}

export class UnionTypeDescription extends TypeDescription {
  elementTypes: TypeDescription[]
  constructor(elementTypes: TypeDescription[]) {
    super('union')
    this.elementTypes = elementTypes
  }

  substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    this.elementTypes.forEach(it => it.substituteTypeParameters(substitutions))
  }
}

export class IntersectionTypeDescription extends TypeDescription {
  elementTypes: TypeDescription[]
  constructor(elementTypes: TypeDescription[]) {
    super('intersection')
    this.elementTypes = elementTypes
  }

  substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    this.elementTypes.forEach(it => it.substituteTypeParameters(substitutions))
  }
}

export class IntRangeTypeDescription extends TypeDescription {
  constructor() {
    super('int_range')
  }

  substituteTypeParameters(_: TypeParameterSubstitutions) {}
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
