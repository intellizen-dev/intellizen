import type { PrimitiveType, TypeReference } from '../generated/ast'

type PrimitiveTypes = PrimitiveType['value']
type AllTypes = Exclude<TypeReference['$type'], 'ParenthesizedType' | 'TypeReference'>
type MultiType = Extract<AllTypes, 'UnionType' | 'IntersectionType' | 'ListType' | 'MapType' | 'ArrayType'>
type SingleTypes = Exclude<AllTypes, MultiType>

export interface TypeDescription<
  T extends SingleTypes = 'PrimitiveType',
  ResultType extends PrimitiveTypes = 'any',
  FunctionParamTypes extends TypeDescription<any, any>[] = never,
> {
  $type: T
  type: T extends 'FunctionType'
    ? { params: FunctionParamTypes, return: ResultType }
    : T extends 'PrimitiveType'
      ? ResultType
      : T extends 'ReferenceType'
        ? string[]
        : never
}

type DefaultTypeDescription = TypeDescription<SingleTypes, PrimitiveTypes>

export interface MapTypeDescription<
  K extends DefaultTypeDescription,
  V extends DefaultTypeDescription,
> {
  $type: 'MapType'
  key: K
  value: V
}

export interface MultiTypeDescription<
  N extends Exclude<MultiType, 'MapType'>,
  T extends DefaultTypeDescription,
> {
  $type: N
  type: N extends 'ArrayType' | 'ListType' ? T : T[]
}
