import type { AstNode, AstNodeDescription, NameProvider, Stream } from 'langium'
import type { CallExpression, ClassDeclaration, ConstructorDeclaration, ExpandFunctionDeclaration, Expression, FunctionDeclaration } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptMemberProvider } from '../reference/member-provider'
import type { ZenScriptNameProvider } from '../reference/name-provider'
import type { ClassType, IntersectionType, Type, UnionType } from '../typing/type-description'
import type { ZenScriptDescriptionIndex } from '../workspace/description-index'
import type { ZenScriptTypeComputer } from './type-computer'
import type { ZenScriptTypeFeatures } from './type-features'
import { AstUtils, stream } from 'langium'
import { isClassDeclaration, isConstructorDeclaration, isExpandFunctionDeclaration, isFunctionDeclaration, isFunctionExpression, isMemberAccess, isOperatorFunctionDeclaration, isReferenceExpression, isScript } from '../generated/ast'
import { FunctionType, isClassType, isCompoundType, isTypeVariable } from '../typing/type-description'

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
  private readonly typeFeatures: ZenScriptTypeFeatures
  private readonly nameProvider: NameProvider

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
    this.memberProvider = services.references.MemberProvider
    this.descriptionIndex = services.workspace.DescriptionIndex
    this.typeFeatures = services.typing.TypeFeatures
    this.nameProvider = services.references.NameProvider
  }

  findOverloadConstructor(classDecl: ClassDeclaration, callExpr: CallExpression): AstNode | undefined {
    const constructors = classDecl.members
      .filter(it => isConstructorDeclaration(it))

    if (constructors.length === 0) {
      return
    }

    const index = this.resolveOverload(constructors, callExpr.arguments)

    if (index.length === 0) {
      return constructors[0]
    }
    return constructors[index[0]]
  }

  findOverloadMethod(members: Stream<AstNode>, callExpr: CallExpression, name?: string): AstNode | undefined {
    const found = members.filter(it => !name || this.nameProvider.getName(it) === name).toArray()

    const clazz = found.find(it => isClassDeclaration(it))
    if (clazz) {
      return this.findOverloadConstructor(clazz, callExpr)
    }

    const methods = found.filter(it => isFunctionDeclaration(it) || isExpandFunctionDeclaration(it))

    const index = this.resolveOverload(methods, callExpr.arguments)

    if (index.length === 0) {
      return methods[0]
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

      // TODO(import)
      // const refText = callExpr.receiver.target.$refText

      // const imports = stream(script.imports)
      //   .map(it => this.descriptionIndex.createImportedDescription(it))
      //   .flatMap(it => it)

      // const overload = this.findOverloadMethod(imports, callExpr, refText)

      // if (overload) {
      //   return this.typeComputer.inferType(overload.node)
      // }
      return
    }

    if (isMemberAccess(callExpr.receiver)) {
      if (callExpr.receiver.target.$nodeDescription) {
        return this.typeComputer.inferType(callExpr.receiver.target.$nodeDescription.node)
      }
      const receiverType = this.typeComputer.inferType(callExpr.receiver.receiver)
      const candidates = this.memberProvider.streamMembers(receiverType)

      const overload = this.predictOverloadMethod(candidates, callExpr, callExpr.receiver.target.$refText)
      if (overload) {
        return this.typeComputer.inferType(overload.node)
      }
    }
  }

  predictOverloadMethod(members: Stream<AstNode>, callExpr: CallExpression, name: string): AstNodeDescription | undefined {
    const found = members.filter(it => this.nameProvider.getName(it) === name)

    const classDesc = found.find(it => isClassDeclaration(it))
    if (classDesc) {
      const ctorDecl = classDesc.members.find((it) => {
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

    const functionDecl = found.filter(it => isFunctionDeclaration(it) || isExpandFunctionDeclaration(it))
      .find((it) => {
        return this.matchSignature(it, callExpr.arguments.length) !== OverloadMatch.NotMatch
      })

    if (!functionDecl) {
      return
    }

    return this.descriptionIndex.getDescription(functionDecl)
  }

  resolveOverload(methods: Array<CallableDeclaration>, args: Array<Expression>): number[] {
    const possible = new Set<number>()

    for (let i = 0; i < methods.length; i++) {
      const currentMatch = this.matchSignature(methods[i], args.length)
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
      const currentMatch = this.matchSignature(methods[i], argTypes)
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
      this.logAmbiguousOverload(methods, argTypes, bestMatch, matchIndexes)
    }

    if (bestMatch === OverloadMatch.NotMatch) {
      return []
    }

    return matchIndexes
  }

  private logAmbiguousOverload(methods: ArrayLike<CallableDeclaration>, argTypes: Type[], bestMatch: OverloadMatch, matchIndexes: number[]) {
    let methodName = ''
    if (isConstructorDeclaration(methods[0])) {
      methodName = ((methods[0]).$container as ClassDeclaration).name
    }
    else {
      methodName = (methods[0]).name
    }

    const MATCH_NAMES = ['FullMatch', 'OptionalMatch', 'ImplicitMatch', 'PossibleMatch', 'NotMatch']

    const argTypeStrings = argTypes.map(it => it?.toString() ?? 'undefined').join(', ')
    console.warn(`ambiguous overload for ${methodName} with arguments (${argTypeStrings}), match: ${MATCH_NAMES[bestMatch]}`)
    for (const index of matchIndexes) {
      const params = (methods[index]).parameters.map(it => this.typeComputer.inferType(it))
        .map(it => it?.toString() ?? 'undefined').join(', ')
      console.warn(`----- ${methodName} (${params})`)
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

    const paramterTypes = checkType ? paramters.map(p => this.typeComputer.inferType(p) || this.typeComputer.classTypeOf('any')) : []

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
        if (this.typeFeatures.areTypesEqual(varargsType, args[i])) {
          continue
        }
        match = OverloadMatch.ImplicitMatch
        if (!this.typeFeatures.isAssignable(varargsType, args[i])) {
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

      if (this.typeFeatures.areTypesEqual(varargsType, lastArgType) || this.typeFeatures.areTypesEqual(varargsTypeArray, lastArgType)) {
        return OverloadMatch.FullMatch
      }

      if (!this.typeFeatures.isAssignable(varargsType, lastArgType) && !this.typeFeatures.isAssignable(varargsTypeArray, lastArgType)) {
        return OverloadMatch.NotMatch
      }

      match = OverloadMatch.ImplicitMatch
      checkLength--
    }

    if (!checkType) {
      return OverloadMatch.PossibleMatch
    }

    for (let i = 0; i < checkLength; i++) {
      if (this.typeFeatures.areTypesEqual(paramterTypes[i], args[i])) {
        continue
      }
      match = OverloadMatch.ImplicitMatch
      if (!this.typeFeatures.isAssignable(paramterTypes[i], args[i])) {
        return OverloadMatch.NotMatch
      }
    }

    return match
  }
}
