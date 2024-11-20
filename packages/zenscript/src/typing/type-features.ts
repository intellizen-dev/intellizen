import type { Type } from './type-description'

export interface TypeAssignability {
  // target := source
  isAssignable: (target: Type, source: Type) => boolean
}

export interface TypeEquality {
  areTypesEqual: (first: Type, second: Type) => boolean
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

export type TypeFeatures = TypeAssignability & TypeEquality & TypeConversion & SubType & TypeDisplaying

export class ZenScriptTypeFeatures implements TypeFeatures {
  isAssignable(target: Type, source: Type): boolean {
    // 1. are both types equal?
    if (this.areTypesEqual(source, target)) {
      return true
    }

    // 2. implicit conversion from source to target possible?
    if (this.isConvertible(source, target)) {
      return true
    }

    // 3. is the source a subtype of the target?
    if (this.isSubType(source, target)) {
      return true
    }

    return false
  }

  areTypesEqual(first: Type, second: Type): boolean {
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
