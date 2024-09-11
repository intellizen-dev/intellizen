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

export class TypeDescriptionUtils {
  public static createPrimitiveType<T extends PrimitiveTypes>(
    type: T,
  ): TypeDescription<'PrimitiveType', PrimitiveTypes> {
    return {
      $type: 'PrimitiveType',
      type,
    }
  }

  public static createReferenceType(type: string[]): TypeDescription<'ReferenceType'> {
    return {
      $type: 'ReferenceType',
      type,
    }
  }

  public static createMapType<K extends DefaultTypeDescription, V extends DefaultTypeDescription>(
    typeKey: K,
    typeValue: V,
  ): MapTypeDescription<K, V> {
    return {
      $type: 'MapType',
      key: typeKey,
      value: typeValue,
    }
  }

  public static createMultiType<N extends Exclude<MultiType, 'MapType'>, T extends DefaultTypeDescription>(
    typeName: N,
    typeInclude: N extends 'ArrayType' | 'ListType' ? T : T[],
  ): MultiTypeDescription<N, T> {
    return {
      $type: typeName,
      type: typeInclude,
    }
  }
}
