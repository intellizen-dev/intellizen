import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { TypeComputer } from './type-computer'
import type { Type, ZenScriptType } from './type-description'
import { stream } from 'langium'
import { isOperatorFunctionDeclaration } from '../generated/ast'
import { getClassChain } from '../utils/ast'
import { defineRules } from '../utils/rule'
import { isAnyType, isClassType, isCompoundType, isFunctionType, isIntersectionType, isTypeVariable, isUnionType } from './type-description'

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

export type TypeFeatures = TypeAssignability & TypeEquality & TypeConversion & SubType

type SourceMap = ZenScriptType
type RuleMap = { [K in keyof SourceMap]?: (self: SourceMap[K], other: Type) => boolean }

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
    else if (this.typeEqualityRules(first.$type).call(first, second)) {
      return true
    }

    // ask the second type
    else if (this.typeEqualityRules(second.$type).call(second, first)) {
      return true
    }

    return false
  }

  private readonly typeEqualityRules = defineRules<RuleMap>(this, {
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
  })

  isConvertible(from: Type, to: Type): boolean {
    return this.typeConversionRules(from.$type).call(from, to) ?? false
  }

  private readonly typeConversionRules = defineRules<RuleMap>(this, {
    ClassType: (from, to) => {
      if (isAnyType(from) || isAnyType(to)) {
        return true
      }

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
  })

  isSubType(subType: Type, superType: Type): boolean {
    // ask the subtype
    if (this.subTypeRules(subType.$type).call(subType, superType)) {
      return true
    }

    // ask the supertype
    else if (this.superTypeRules(superType.$type).call(superType, subType)) {
      return true
    }

    return false
  }

  private readonly subTypeRules = defineRules<RuleMap>(this, {
    ClassType: (subType, superType) => {
      return isClassType(superType) && getClassChain(superType.declaration).includes(subType.declaration)
    },
  })

  private readonly superTypeRules = defineRules<RuleMap>(this, {
    ClassType: (superType, subType) => {
      return isClassType(subType) && getClassChain(subType.declaration).includes(superType.declaration)
    },

    IntersectionType: (superType, subType) => {
      return superType.types.some(it => this.isSubType(subType, it))
    },
  })
}
