import type { AstNodeDescription } from 'langium'
import type { CallExpression, ClassDeclaration, ConstructorDeclaration, ExpandFunctionDeclaration, Expression, FunctionDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptMemberProvider } from '../reference/member-provider'
import type { ClassType, IntersectionType, Type, UnionType } from '../typing/type-description'
import type { ZenScriptDescriptionIndex } from '../workspace/description-index'
import type { ZenScriptTypeComputer } from './type-computer'
import { AstUtils, stream } from 'langium'
import { isClassDeclaration, isConstructorDeclaration, isExpandFunctionDeclaration, isFunctionDeclaration, isFunctionExpression, isMemberAccess, isOperatorFunctionDeclaration, isReferenceExpression, isScript } from '../generated/ast'
import { FunctionType, isClassType, isCompoundType, isTypeVariable } from '../typing/type-description'
import { getClassChain } from '../utils/ast'

export enum OverloadMatch {
  FullMatch = 0,
  OptionalMatch = 1,
  ImplicitMatch = 2,
  PossibleMatch = 3,
  NotMatch = 4,
}

export type CallableDeclaration = ConstructorDeclaration | FunctionDeclaration | ExpandFunctionDeclaration

export function isOptionalArgs(method: CallableDeclaration, before: number): boolean {
  let index = before
  if (index < 0) {
    index = method.parameters.length + index
  }
  if (isExpandFunctionDeclaration(method)) {
    index++
  }

  return index < method.parameters.length && method.parameters[index].defaultValue !== undefined
}

export function isVarargs(method: CallableDeclaration): boolean {
  return method.parameters.length > 0 && method.parameters[method.parameters.length - 1].varargs
}

export class ZenScriptOverloadResolver {
  private readonly typeComputer: ZenScriptTypeComputer
  private readonly memberProvider: ZenScriptMemberProvider
  private readonly descriptionIndex: ZenScriptDescriptionIndex

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
    this.descriptionIndex = services.workspace.DescriptionIndex
  }

  findOverlaodConstructor(classDecl: ClassDeclaration, callExpr: CallExpression): AstNodeDescription | undefined {
    const constructors = classDecl.members
      .filter(it => isConstructorDeclaration(it))

    if (constructors.length === 0) {
      return
    }

    const index = this.resolveOverload(constructors, it => it as ConstructorDeclaration, callExpr.arguments)

    if (index.length === 0) {
      return this.descriptionIndex.getDescription(constructors[0])
    }
    return this.descriptionIndex.getDescription(constructors[index[0]])
  }

  findOverloadMethod(members: Iterable<AstNodeDescription>, callExpr: CallExpression, name: string): AstNodeDescription | undefined {
    const found = stream(members).filter(it => it.name === name)

    const classDesc = found.find(it => isClassDeclaration(it.node))
    if (classDesc) {
      const clazz = classDesc.node as ClassDeclaration
      return this.findOverlaodConstructor(clazz, callExpr)
    }

    const methods = found.filter(it => isFunctionDeclaration(it.node) || isExpandFunctionDeclaration(it.node)).toArray()

    const index = this.resolveOverload(methods, it => it.node as CallableDeclaration, callExpr.arguments)

    if (index.length === 0) {
      return methods.find(it => it.name === name)
    }
    return methods[index[0]]
  }

  predictCallType(callExpr: CallExpression): Type | undefined {
    if (isReferenceExpression(callExpr.receiver)) {
      if (callExpr.receiver.target.$nodeDescription) {
        return this.typeComputer.inferType(callExpr.receiver.target.$nodeDescription.node)
      }
      const script = AstUtils.findRootNode(callExpr.receiver)

      if (!isScript(script)) {
        return
      }

      const refText = callExpr.receiver.target.$refText

      const imports = stream(script.imports)
        .map(it => this.descriptionIndex.createImportedDescription(it))
        .flatMap(it => it)

      const overload = this.findOverloadMethod(imports, callExpr, refText)

      if (overload) {
        return this.typeComputer.inferType(overload.node)
      }
      return
    }

    if (isMemberAccess(callExpr.receiver)) {
      if (callExpr.receiver.target.$nodeDescription) {
        return this.typeComputer.inferType(callExpr.receiver.target.$nodeDescription.node)
      }
      const receiverType = this.typeComputer.inferType(callExpr.receiver.receiver)
      const candidates = stream(this.memberProvider.getMembers(receiverType))

      const overload = this.predictOverloadMethod(candidates, callExpr, callExpr.receiver.target.$refText)
      if (overload) {
        return this.typeComputer.inferType(overload.node)
      }
    }
  }

  predictOverloadMethod(members: Iterable<AstNodeDescription>, callExpr: CallExpression, name: string): AstNodeDescription | undefined {
    const found = stream(members).filter(it => it.name === name)

    const classDesc = found.find(it => isClassDeclaration(it.node))
    if (classDesc) {
      const ctorDecl = (classDesc.node as ClassDeclaration).members.find((it) => {
        if (isConstructorDeclaration(it)) {
          return true
        }
        return this.matchSignature(it as CallableDeclaration, callExpr.arguments.length) !== OverloadMatch.NotMatch
      })

      if (!ctorDecl) {
        return
      }
      return this.descriptionIndex.getDescription(ctorDecl)
    }

    return found.filter(it => isFunctionDeclaration(it.node) || isExpandFunctionDeclaration(it.node))
      .find((it) => {
        const method = it.node as CallableDeclaration
        return this.matchSignature(method, callExpr.arguments.length) !== OverloadMatch.NotMatch
      })
  }

  resolveOverload<T>(methods: ArrayLike<T>, supplier: (arg: T) => CallableDeclaration, args: Array<Expression>): number[] {
    const possible = new Set<number>()

    for (let i = 0; i < methods.length; i++) {
      const currentMatch = this.matchSignature(supplier(methods[i]), args.length)
      if (currentMatch !== OverloadMatch.NotMatch) {
        possible.add(i)
      }
    }

    if (possible.size === 0) {
      return []
    }

    if (possible.size === 1) {
      return [...possible.values()]
    }

    const argTypes = args.map((it) => {
      if (isFunctionExpression(it)) {
        return new FunctionType([], this.typeComputer.classTypeOf('void'))
      }
      return this.typeComputer.inferType(it) || this.typeComputer.classTypeOf('any')
    })

    let bestMatch = OverloadMatch.NotMatch
    let matchIndexes: number[] = []
    for (let i = 0; i < methods.length; i++) {
      if (!possible.has(i)) {
        continue
      }
      const currentMatch = this.matchSignature(supplier(methods[i]), argTypes)
      if (currentMatch === OverloadMatch.FullMatch) {
        return [i]
      }
      if (currentMatch < bestMatch) {
        matchIndexes = [i]
        bestMatch = currentMatch
      }
      else if (currentMatch === bestMatch) {
        // duplicate match
        matchIndexes.push(i)
      }
    }

    if (matchIndexes.length > 1) {
      this.logAmbiguousOverload<T>(supplier, methods, argTypes, bestMatch, matchIndexes)
    }

    if (bestMatch === OverloadMatch.NotMatch) {
      return []
    }

    return matchIndexes
  }

  private logAmbiguousOverload<T>(supplier: (arg: T) => CallableDeclaration, methods: ArrayLike<T>, argTypes: Type[], bestMatch: OverloadMatch, matchIndexes: number[]) {
    let methodName = ''
    if (isConstructorDeclaration(supplier(methods[0]))) {
      methodName = (supplier(methods[0]).$container as ClassDeclaration).name
    }
    else {
      methodName = (supplier(methods[0]) as FunctionDeclaration).name
    }

    const MATCH_NAMES = ['FullMatch', 'OptionalMatch', 'ImplicitMatch', 'PossibleMatch', 'NotMatch']

    const argTypeStrings = argTypes.map(it => it?.toString() ?? 'undefined').join(', ')
    console.warn(`ambiguous overload for ${methodName} with arguments (${argTypeStrings}), match: ${MATCH_NAMES[bestMatch]}`)
    for (const index of matchIndexes) {
      const params = (supplier(methods[index]) as CallableDeclaration).parameters.map(it => this.typeComputer.inferType(it))
        .map(it => it?.toString() ?? 'undefined').join(', ')
      console.warn(`----- ${methodName} (${params})`)
    }
  }

  typeIsSame(a: Type | undefined, b: Type | undefined): boolean {
    if (a === undefined || b === undefined) {
      return false
    }

    return a.equals(b)
  }

  elementType(type: ClassType): Type | undefined {
    const substitutionType = type.substitutions.values().next().value

    if (!substitutionType || isTypeVariable(substitutionType)) {
      return
    }

    return substitutionType
  }

  typeIsFunctionLike(type: Type): boolean {
    switch (type.$type) {
      case 'ClassType':
      {
        const members = this.memberProvider.getMembers((type as ClassType).declaration)
        return members.some(it => isFunctionDeclaration(it.node) && it.node.prefix === 'lambda')
      }
      case 'FunctionType':
        return true
      case 'IntersectionType':
        return (type as IntersectionType).types.some(it => this.typeIsFunctionLike(it))
      default:
        return false
    }

    return false
  }

  classIsExtends(a: ClassType, b: ClassType): boolean {
    if (a.equals(b)) {
      return true
    }

    if (b.declaration.name === 'any') {
      return true
    }

    if (b.declaration.name === 'null' || a.declaration.name === 'void') {
      return false
    }

    if ((a.declaration.name === 'Array' && b.declaration.name === 'Array') || (a.declaration.name === 'List' && b.declaration.name === 'List')) {
      return this.typeIsInstanceOf(this.elementType(a), this.elementType(b))
    }

    if (stream(a.declaration.superTypes)
      .map(it => this.typeComputer.inferType(it))
      .filter(it => isClassType(it))
      .some(it => this.classIsExtends(it, b))) {
      return true
    }

    const castOps = getClassChain(a.declaration)
      .flatMap(it => it.members)
      .filter(it => isOperatorFunctionDeclaration(it))
      .filter(it => it.op === 'as')

    for (const castOp of castOps) {
      const castType = this.typeComputer.inferType(castOp.returnTypeRef)
      if (!castType) {
        continue
      }
      let canCast = false
      if (isCompoundType(castType)) {
        canCast = castType.types.some(it => it.equals(b))
      }
      else {
        canCast = castType.equals(b)
      }
      if (canCast) {
        return true
      }
    }

    return false
  }

  classIsInstanceOf(a: ClassType, b: Type): boolean {
    if (a.declaration.name === 'void') {
      return false
    }
    if (a.declaration.name === 'any' || a.declaration.name === 'null') {
      return true
    }
    switch (b.$type) {
      case 'ClassType':
        return this.classIsExtends(a as ClassType, b as ClassType)
      case 'IntersectionType':
        return (b as IntersectionType).types.some(it => this.classIsInstanceOf(a, it))
      case 'UnionType':
        return (b as UnionType).types.every(it => this.classIsInstanceOf(a, it))
      default:
        return false
    }
  }

  typeIsInstanceOf(a: Type | undefined, b: Type | undefined): boolean {
    if (a === undefined || b === undefined) {
      return false
    }

    switch (a.$type) {
      case 'ClassType':
        return this.classIsInstanceOf(a as ClassType, b)
      case 'FunctionType':
        return this.typeIsFunctionLike(b)
      case 'IntersectionType':
        return (a as IntersectionType).types.every(it => this.typeIsInstanceOf(it, b))
      case 'UnionType':
        return (a as UnionType).types.some(it => this.typeIsInstanceOf(it, b))
      case 'CompoundType':
        return false
      case 'TypeVariable':
        return false
      default:
        return false
    }
  }

  matchSignature(method: CallableDeclaration, args: Type[] | number): OverloadMatch {
    const paramters = method.parameters
    if (isExpandFunctionDeclaration(method)) {
      // remove first parameter
      paramters.shift()
    }
    const checkType = Array.isArray(args)

    let match = OverloadMatch.FullMatch

    const argumentLength = checkType ? args.length : args

    let checkLength = Math.min(argumentLength, paramters.length)

    const paramterTypes = checkType ? paramters.map(p => this.typeComputer.inferType(p)) : []

    if (argumentLength > paramters.length) {
      if (!isVarargs(method)) {
        return OverloadMatch.NotMatch
      }

      if (!checkType) {
        return OverloadMatch.PossibleMatch
      }

      const varargsType = paramterTypes[paramterTypes.length - 1]
      match = OverloadMatch.ImplicitMatch
      for (let i = paramters.length - 1; i < argumentLength; i++) {
        if (this.typeIsSame(args[i], varargsType)) {
          continue
        }
        match = OverloadMatch.ImplicitMatch
        if (!this.typeIsInstanceOf(args[i], varargsType)) {
          return OverloadMatch.NotMatch
        }
      }
    }
    else if (argumentLength < paramters.length) {
      if (!isOptionalArgs(method, argumentLength)) {
        return OverloadMatch.NotMatch
      }

      if (!checkType) {
        return OverloadMatch.PossibleMatch
      }

      match = OverloadMatch.OptionalMatch
    }
    else if (isVarargs(method)) {
      if (!checkType) {
        return OverloadMatch.PossibleMatch
      }
      const varargsType = paramterTypes[paramterTypes.length - 1]
      if (!varargsType) {
        return OverloadMatch.NotMatch
      }

      const lastArgType = args.at(-1)!
      const varargsTypeArray = this.typeComputer.arrayTypeOf(varargsType)

      if (this.typeIsSame(lastArgType, varargsType) || this.typeIsSame(lastArgType, varargsTypeArray)) {
        return OverloadMatch.FullMatch
      }

      if (!this.typeIsInstanceOf(lastArgType, varargsType) && !this.typeIsInstanceOf(lastArgType, varargsTypeArray)) {
        return OverloadMatch.NotMatch
      }

      match = OverloadMatch.ImplicitMatch
      checkLength--
    }

    if (!checkType) {
      return OverloadMatch.PossibleMatch
    }

    for (let i = 0; i < checkLength; i++) {
      if (this.typeIsSame(args[i], paramterTypes[i])) {
        continue
      }
      match = OverloadMatch.ImplicitMatch
      if (!this.typeIsInstanceOf(args[i], paramterTypes[i])) {
        return OverloadMatch.NotMatch
      }
    }

    return match
  }
}
