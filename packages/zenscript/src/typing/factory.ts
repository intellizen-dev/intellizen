import type { ClassTypeDescription, FunctionTypeDescription, MapTypeDescription, MultiTypeDescription, MultiTypes, PrimitiveTypeDescription, PrimitiveTypes, TypeDescription } from './description'

export function createPrimitiveType<
  T extends PrimitiveTypes = 'any',
>($type: T = 'any' as T): PrimitiveTypeDescription<T> {
  return {
    $type,
  }
}

export function createFunctionType<
  P extends TypeDescription[],
  R extends TypeDescription,
>(paramTypes: P, returnType: R): FunctionTypeDescription<P, R> {
  return {
    $type: 'function',
    paramTypes,
    returnType,
  }
}

export function createClassType(className: string): ClassTypeDescription {
  return {
    $type: 'class',
    className,
  }
}

export function createMapType<
  K extends TypeDescription,
  V extends TypeDescription,
>(keyType: K, valueType: V): MapTypeDescription<K, V> {
  return {
    $type: 'map',
    keyType,
    valueType,
  }
}

export function createMultiType<
  N extends MultiTypes,
  T = N extends Extract<MultiTypes, 'array' | 'list'> ? TypeDescription : TypeDescription[],
>($type: N, elementType: T): MultiTypeDescription<N, T> {
  return {
    $type,
    elementType,
  }
}
