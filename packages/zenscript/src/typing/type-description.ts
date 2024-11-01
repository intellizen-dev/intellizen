import { stream } from 'langium'
import type { ClassDeclaration, Declaration, TypeParameter } from '../generated/ast'

// region TypeDescription
export interface ZenScriptType {
  FunctionType: FunctionType
  ClassType: ClassType
  UnionType: UnionType
  IntersectionType: IntersectionType
  CompoundType: CompoundType
  TypeVariable: TypeVariable
}

export type BuiltinTypes = 'any' | 'bool' | 'byte' | 'short' | 'int' | 'long' | 'float' | 'double' | 'string' | 'void' | 'Array' | 'List' | 'Map' | 'IntRange'

export type TypeParameterSubstitutions = Map<TypeParameter, Type>

export abstract class Type {
  $type: string

  protected constructor($type: keyof ZenScriptType) {
    this.$type = $type
  }

  abstract substituteTypeParameters(substitutions: TypeParameterSubstitutions): Type
  abstract toString(): string
}

export abstract class NamedType<D extends Declaration> extends Type {
  declaration: D

  protected constructor($type: keyof ZenScriptType, declaration: D) {
    super($type)
    this.declaration = declaration
  }
}

export class ClassType extends NamedType<ClassDeclaration> {
  substitutions: TypeParameterSubstitutions
  constructor(declaration: ClassDeclaration, substitutions: TypeParameterSubstitutions) {
    super('ClassType', declaration)
    this.substitutions = substitutions
  }

  override substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    const newSubstitutions = new Map(stream(this.substitutions).map(([key, value]) => [key, value.substituteTypeParameters(substitutions)]))
    return new ClassType(this.declaration, newSubstitutions)
  }

  override toString(): string {
    let result = this.declaration.name
    if (this.substitutions.size) {
      result += '<'
      result += stream(this.substitutions.values()).map(it => it.toString()).join(', ')
      result += '>'
    }
    return result
  }
}

export class TypeVariable extends NamedType<TypeParameter> {
  constructor(declaration: TypeParameter) {
    super('TypeVariable', declaration)
  }

  override substituteTypeParameters(substitutions: TypeParameterSubstitutions): Type {
    return substitutions.get(this.declaration) ?? this
  }

  override toString(): string {
    return this.declaration.name
  }
}

export class FunctionType extends Type {
  paramTypes: Type[]
  returnType: Type
  constructor(paramTypes: Type[], returnType: Type) {
    super('FunctionType')
    this.paramTypes = paramTypes
    this.returnType = returnType
  }

  override substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    const paramTypes = this.paramTypes.map(it => it.substituteTypeParameters(substitutions))
    const returnType = this.returnType.substituteTypeParameters(substitutions)
    return new FunctionType(paramTypes, returnType)
  }

  override toString(): string {
    let result = 'function('
    if (this.paramTypes.length) {
      result += this.paramTypes.map(it => it.toString()).join(',')
    }
    result += ')'
    result += this.returnType.toString()
    return result
  }
}

export class UnionType extends Type {
  types: Type[]
  constructor(types: Type[]) {
    super('UnionType')
    this.types = types
  }

  override substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    return new UnionType(this.types.map(it => it.substituteTypeParameters(substitutions)))
  }

  override toString(): string {
    return this.types.map(it => it.toString()).join(' | ')
  }
}

export class IntersectionType extends Type {
  types: Type[]
  constructor(types: Type[]) {
    super('IntersectionType')
    this.types = types
  }

  substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    return new IntersectionType(this.types.map(it => it.substituteTypeParameters(substitutions)))
  }

  override toString(): string {
    return this.types.map(it => it.toString()).join(' & ')
  }
}

export class CompoundType extends Type {
  types: Type[]
  constructor(types: Type[]) {
    super('CompoundType')
    this.types = types
  }

  substituteTypeParameters(substitutions: TypeParameterSubstitutions) {
    return new CompoundType(this.types.map(it => it.substituteTypeParameters(substitutions)))
  }

  override toString(): string {
    return this.types.map(it => it.toString()).join(', ')
  }
}
// endregion

// region Predicates
export function isClassType(type: unknown): type is ClassType {
  return type instanceof ClassType
}

export function isStringType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'string'
}

export function isAnyType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'any'
}

export function isBoolType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'bool'
}

export function isByteType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'byte'
}

export function isShortType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'short'
}

export function isIntType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'int'
}

export function isLongType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'long'
}

export function isFloatType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'float'
}

export function isDoubleType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'double'
}

export function isVoidType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'void'
}

export function isArrayType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'Array'
}

export function isListType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'List'
}

export function isMapType(type: unknown): type is ClassType {
  return isClassType(type) && type.declaration.name === 'Map'
}

export function isFunctionType(type: unknown): type is FunctionType {
  return type instanceof FunctionType
}

export function isUnionType(type: unknown): type is UnionType {
  return type instanceof UnionType
}

export function isIntersectionType(type: unknown): type is IntersectionType {
  return type instanceof IntersectionType
}

export function isTypeVariable(type: unknown): type is TypeVariable {
  return type instanceof TypeVariable
}
// endregion
