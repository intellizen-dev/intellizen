import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { TypeComputer } from './type-computer'
import type { Type, ZenScriptType } from './type-description'
import { stream } from 'langium'
import { isOperatorFunctionDeclaration } from '../generated/ast'
import { getClassChain } from '../utils/ast'
import { isClassType, isCompoundType, isFunctionType, isIntersectionType, isTypeVariable, isUnionType } from './type-description'

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
type BiRuleMap<R> = { [K in keyof SourceMap]?: (self: SourceMap[K], other: Type) => R }

export class ZenScriptTypeFeatures implements TypeFeatures {
  private readonly typeComputer: TypeComputer
  private readonly memberProvider: MemberProvider

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
  }

  isAssignable(target: Type, source: Type): boolean {
    // 1. are both types equal?
    if (this.areTypesEqual(source, target)) {
      return true
    }

    // 2. implicit conversion from source to target possible?
    else if (this.isConvertible(source, target)) {
      return true
    }

    // 3. is the source a subtype of the target?
    else if (this.isSubType(source, target)) {
      return true
    }

    return false
  }

  areTypesEqual(first: Type, second: Type): boolean {
    if (first === second) {
      return true
    }

    // ask the first type
    else if (this.typeEqualityRules[first.$type].call(this, second)) {
      return true
    }

    // ask the second type
    else if (this.typeEqualityRules[second.$type].call(this, first)) {
      return true
    }

    return false
  }

  private readonly typeEqualityRules: BiRuleMap<boolean> = {
    ClassType: (self, other) => {
      return isClassType(other) && self.declaration === other.declaration
    },

    FunctionType: (self, other) => {
      return isFunctionType(other)
        && this.areTypesEqual(self.returnType, other.returnType)
        && self.paramTypes.every((it, index) => this.areTypesEqual(it, other.paramTypes[index]))
    },

    TypeVariable: (self, other) => {
      return isTypeVariable(other) && self.declaration === other.declaration
    },

    UnionType: (self, other) => {
      return isUnionType(other)
        && self.types.length === other.types.length
        && self.types.every((it, index) => this.areTypesEqual(it, other.types[index]))
    },

    IntersectionType: (self, other) => {
      return isIntersectionType(other)
        && self.types.length === other.types.length
        && self.types.every((it, index) => this.areTypesEqual(it, other.types[index]))
    },

    CompoundType: (self, other) => {
      return isCompoundType(other)
        && self.types.length === other.types.length
        && self.types.every((it, index) => this.areTypesEqual(it, other.types[index]))
    },
  }

  isConvertible(from: Type, to: Type): boolean {
    return this.typeConversionRules[from.$type].call(this, from, to) ?? false
  }

  private readonly typeConversionRules: BiRuleMap<boolean> = {
    ClassType: (from, to) => {
      return stream(this.memberProvider.getMembers(from))
        .map(it => it.node)
        .filter(isOperatorFunctionDeclaration)
        .filter(it => it.op === 'as')
        .map(it => this.typeComputer.inferType(it.returnTypeRef))
        .nonNullable()
        .some(it => this.isAssignable(to, it))
    },

    CompoundType: (from, to) => {
      return from.types.some(it => this.isAssignable(to, it))
    },
  }

  isSubType(subType: Type, superType: Type): boolean {
    // ask the subtype
    if (this.subTypeRules[subType.$type].call(this, subType, superType)) {
      return true
    }

    // ask the supertype
    else if (this.superTypeRules[superType.$type].call(this, superType, subType)) {
      return true
    }

    return false
  }

  private readonly subTypeRules: BiRuleMap<boolean> = {
    ClassType: (subType, superType) => {
      return isClassType(superType) && getClassChain(superType.declaration).includes(subType.declaration)
    },
  }

  private readonly superTypeRules: BiRuleMap<boolean> = {
    ClassType: (superType, subType) => {
      return isClassType(subType) && getClassChain(subType.declaration).includes(superType.declaration)
    },

    IntersectionType: (superType, subType) => {
      return superType.types.some(it => this.isSubType(subType, it))
    },
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
