import type { ZenScriptServices } from '../module'
import type { MemberProvider } from '../reference/member-provider'
import type { TypeComputer } from './type-computer'
import type { Type, ZenScriptType } from './type-description'
import { isFunctionDeclaration, isOperatorFunctionDeclaration } from '../generated/ast'
import { streamClassChain } from '../utils/ast'
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

  isAssignable(target: Type | undefined, source: Type | undefined): boolean {
    if (target === undefined || source === undefined) {
      return false
    }

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

  areTypesEqual(first: Type | undefined, second: Type | undefined): boolean {
    if (first === undefined || second === undefined) {
      return false
    }

    if (first === second) {
      return true
    }

    // ask the first type
    else if (this.typeEqualityRules(first.$type)?.call(this, first, second)) {
      return true
    }

    // ask the second type
    else if (this.typeEqualityRules(second.$type)?.call(this, second, first)) {
      return true
    }

    return false
  }

  private readonly typeEqualityRules = defineRules<RuleMap>({
    ClassType: (self, other) => {
      if (!isClassType(other)) {
        return false
      }

      if (self.declaration !== other.declaration) {
        return false
      }

      if (self.declaration.typeParams.length !== other.declaration.typeParams.length) {
        return false
      }

      const selfSubstitutions = self.declaration.typeParams.map(it => self.substitutions.get(it)).filter(it => !!it)
      const otherSubstitutions = other.declaration.typeParams.map(it => other.substitutions.get(it)).filter(it => !!it)
      return selfSubstitutions.every((type, index) => this.areTypesEqual(type, otherSubstitutions[index]))
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

  isConvertible(from: Type | undefined, to: Type | undefined): boolean {
    if (from === undefined || to === undefined) {
      return false
    }
    return this.typeConversionRules(from.$type)?.call(this, from, to) ?? false
  }

  private readonly typeConversionRules = defineRules<RuleMap>({
    ClassType: (from, to) => {
      if (isAnyType(from) || isAnyType(to)) {
        return true
      }

      return this.memberProvider.streamMembers(from)
        .filter(isOperatorFunctionDeclaration)
        .filter(it => it.op === 'as')
        .map(it => this.typeComputer.inferType(it.retType))
        .nonNullable()
        .some(it => this.isSubType(to, it))
    },

    FunctionType: (from, to) => {
      if (isAnyType(to)) {
        return true
      }

      let toFuncType: Type | undefined
      if (isFunctionType(to)) {
        toFuncType = to
      }
      else if (isClassType(to)) {
        const lambdaDecl = this.memberProvider.streamMembers(to)
          .filter(isFunctionDeclaration)
          .filter(it => it.prefix === 'lambda')
          .head()
        toFuncType = this.typeComputer.inferType(lambdaDecl)
      }

      if (!isFunctionType(toFuncType)) {
        return false
      }

      return from.paramTypes.length === toFuncType.paramTypes.length
        && this.isConvertible(from.returnType, toFuncType.returnType)
        && from.paramTypes.every((param, index) => this.isConvertible(param, toFuncType.paramTypes[index]))
    },

    CompoundType: (from, to) => {
      return from.types.some(it => this.isAssignable(to, it))
    },
  })

  isSubType(subType: Type | undefined, superType: Type | undefined): boolean {
    if (subType === undefined || superType === undefined) {
      return false
    }

    // ask the subtype
    if (this.subTypeRules(subType.$type)?.call(this, subType, superType)) {
      return true
    }

    // ask the supertype
    else if (this.superTypeRules(superType.$type)?.call(this, superType, subType)) {
      return true
    }

    return false
  }

  private readonly subTypeRules = defineRules<RuleMap>({
    ClassType: (subType, superType) => {
      return isClassType(superType) && streamClassChain(superType.declaration).includes(subType.declaration)
    },
  })

  private readonly superTypeRules = defineRules<RuleMap>({
    ClassType: (superType, subType) => {
      return isClassType(subType) && streamClassChain(subType.declaration).includes(superType.declaration)
    },

    IntersectionType: (superType, subType) => {
      return superType.types.some(it => this.isSubType(subType, it))
    },

    CompoundType: (superType, subType) => {
      return superType.types.some(it => this.isSubType(subType, it))
    },
  })
}
