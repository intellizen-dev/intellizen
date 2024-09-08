import type { PrimitiveType, TypeReference } from '../generated/ast'

export type UnArray<T extends []> = T extends (infer U)[] ? U : never

type PrimitiveTypes = PrimitiveType['value']
type AllTypes = Exclude<TypeReference['$type'], 'ParenthesizedType' | 'TypeReference'>
type SingleTypes = Exclude<AllTypes, 'UnionType' | 'IntersectionType' | 'ListType' | 'MapType' | 'ArrayType'>

export interface TypeDescription<
  T extends SingleTypes = 'PrimitiveType',
  BaseType = T extends 'FunctionType' ? 'function' : PrimitiveTypes,
  FunctionParams = BaseType extends 'function' ? TypeDescription[] : never,
  FunctionReturnType = BaseType extends 'function' ? TypeDescription : never,
> {
  $type: T
  type: T extends 'PrimitiveType'
    ? BaseType
    : T extends 'ReferenceType'
      ? string[]
      : T extends 'FunctionType'
        ? { params: FunctionParams, return: FunctionReturnType }
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
