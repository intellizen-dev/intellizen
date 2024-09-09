import type { PrimitiveType, TypeReference } from '../generated/ast'

type IsUnion<T, U = T> = T extends any ? [U] extends [T] ? false : true : never

type PrimitiveTypes = PrimitiveType['value']
type AllTypes = Exclude<TypeReference['$type'], 'ParenthesizedType' | 'TypeReference'>
type SingleTypes = Exclude<AllTypes, 'UnionType' | 'IntersectionType' | 'ListType' | 'MapType' | 'ArrayType'>

export interface TypeDescription<
  T extends SingleTypes = 'PrimitiveType',
  ResultType extends PrimitiveTypes = 'any',
  FunctionParamTypes extends TypeDescription<any, any>[] = never,
> {
  $type: T
  type: T extends 'FunctionType'
    ? { params: FunctionParamTypes, return: ResultType }
    : T extends 'PrimitiveType'
      ? IsUnion<ResultType> extends true ? 'any' : ResultType
      : T extends 'ReferenceType'
        ? string[]
        : never
}

export interface MapTypeDescription<
  K extends TypeDescription,
  V extends TypeDescription,
> {
  $type: 'MapType'
  key: K
  value: V
}

export interface MultiTypeDescription<
  N extends 'array' | 'list' | 'union' | 'intersection',
  T extends TypeDescription,
> {
  $type: N extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}Type` : never
  type: T extends 'array' | 'list' ? T : T[]
}
