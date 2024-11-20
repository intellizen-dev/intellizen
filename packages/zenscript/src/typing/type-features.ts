import type { Type } from './type-description'

export interface TypeEquality {
  areTypesEqual: (first: Type, second: Type) => boolean
}

export interface TypeAssignability {
  // target := source;
  isAssignable: (target: Type, source: Type) => boolean
}

export interface TypeConversion {
  isConvertible: (from: Type, to: Type) => boolean
}

export interface SubType {
  isSubType: (subType: Type, superType: Type) => boolean
}

export interface TypeDisplaying {
  toString: (type: Type) => string
  toSimpleString: (type: Type) => string
}

export type TypeFeatures = TypeEquality & TypeAssignability & TypeConversion & SubType & TypeDisplaying

export class ZenScriptTypeFeatures implements TypeFeatures {
  areTypesEqual(first: Type, second: Type): boolean {
    return false
  }

  isAssignable(target: Type, source: Type): boolean {
    return false
  }

  isConvertible(from: Type, to: Type): boolean {
    return false
  }

  isSubType(subType: Type, superType: Type): boolean {
    return false
  }

  toString(type: Type): string {
    return ''
  }

  toSimpleString(type: Type): string {
    return ''
  }
}
