import type { Type, ZenScriptType } from './type-description'
import { stream } from 'langium'

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

type SourceMap = ZenScriptType
type RuleMap<R> = { [K in keyof SourceMap]: (source: SourceMap[K]) => R }

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
    // @ts-expect-error allowed index type
    return this.toStringRules[type.$type].call(this, type)
  }

  private readonly toStringRules: RuleMap<string> = {
    ClassType: (source) => {
      let result = source.declaration.name
      if (source.substitutions.size) {
        result += '<'
        result += stream(source.substitutions.values()).map(this.toString).join(', ')
        result += '>'
      }
      return result
    },

    FunctionType: (source) => {
      let result = 'function('
      if (source.paramTypes.length) {
        result += source.paramTypes.map(this.toString).join(',')
      }
      result += ')'
      result += this.toString(source.returnType)
      return result
    },

    TypeVariable: source => source.declaration.name,
    UnionType: source => source.types.map(this.toString).join(' | '),
    IntersectionType: source => source.types.map(this.toString).join(' & '),
    CompoundType: source => source.types.map(this.toString).join(', '),
  }

  toSimpleString(type: Type): string {
    // @ts-expect-error allowed index type
    return this.toSimpleStringRules[type.$type].call(this, type)
  }

  private readonly toSimpleStringRules: RuleMap<string> = {
    ClassType: (source) => {
      let result = source.declaration.name
      if (source.substitutions.size) {
        result += '<'
        result += stream(source.substitutions.values()).map(this.toSimpleString).join(', ')
        result += '>'
      }
      return result
    },

    FunctionType: (source) => {
      let result = 'function('
      if (source.paramTypes.length) {
        result += source.paramTypes.map(it => this.toSimpleString(it)).join(',')
      }
      result += ')'
      result += this.toSimpleString(source.returnType)
      return result
    },

    TypeVariable: source => source.declaration.name,
    UnionType: source => source.types.map(this.toSimpleString).join(' | '),
    IntersectionType: source => source.types.map(this.toSimpleString).join(' & '),
    CompoundType: source => source.types.map(this.toSimpleString).join(', '),
  }
}
