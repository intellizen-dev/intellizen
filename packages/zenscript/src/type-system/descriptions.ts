import type { PrimitiveType, TypeReference } from '../generated/ast'

type PrimitiveTypes = PrimitiveType['value']
type AllTypes = Exclude<TypeReference['$type'], 'ParenthesizedType' | 'TypeReference'>
type MultiType = Extract<AllTypes, 'UnionType' | 'IntersectionType' | 'ListType' | 'MapType' | 'ArrayType'>
type SingleTypes = Exclude<AllTypes, MultiType>

type DefaultTypeDescription = TypeDescription<SingleTypes, PrimitiveTypes, DefaultTypeDescription, DefaultTypeDescription[]>

export interface TypeDescription<
  T extends SingleTypes = 'PrimitiveType',
  ResultType extends PrimitiveTypes = 'any',
  ReturnType extends DefaultTypeDescription = never,
  FunctionParamTypes extends DefaultTypeDescription[] = never,
> {
  $type: T
  type: T extends 'FunctionType'
    ? { params: FunctionParamTypes, return: ReturnType }
    : T extends 'PrimitiveType'
      ? ResultType
      : T extends 'ReferenceType'
        ? string[] // todo
        : never
}

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
  public static createFunctionType<R extends DefaultTypeDescription, P extends DefaultTypeDescription[]>(
    returnType: R,
    paramTypes: P,
  ): TypeDescription<'FunctionType', 'any', R, P> {
    return {
      $type: 'FunctionType',
      type: {
        params: paramTypes,
        return: returnType,
      },
    }
  }

  public static createPrimitiveType<T extends PrimitiveTypes>(
    type: T,
  ): TypeDescription<'PrimitiveType', T> {
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
