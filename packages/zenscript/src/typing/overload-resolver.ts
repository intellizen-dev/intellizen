import type { CallableDeclaration, CallExpression, Expression, FieldDeclaration, ValueParameter } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { TypeComputer } from './type-computer'
import type { FunctionType, Type } from './type-description'
import type { TypeFeatures } from './type-features'
import { type AstNode, MultiMap } from 'langium'
import { isCallableDeclaration, isClassDeclaration, isConstructorDeclaration, isFieldDeclaration } from '../generated/ast'
import { isFunctionType } from './type-description'

export interface OverloadResolver {
  resolveOverloads: (callExpr: CallExpression, maybeCandidates: AstNode[]) => AstNode[]
}

export enum OverloadMatch {
  ExactMatch,
  VarargMatch,
  OptionalArgMatch,
  SubtypeMatch,
  ImplicitCastMatch,
  FunctionPropertyMatch,
  NotMatch,
}

function worstMatch(matchSet: Set<OverloadMatch>): OverloadMatch {
  return Array.from(matchSet).sort((a, b) => a - b).at(-1) ?? OverloadMatch.NotMatch
}

export class ZenScriptOverloadResolver implements OverloadResolver {
  private readonly typeComputer: TypeComputer
  private readonly typeFeatures: TypeFeatures

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
    this.typeFeatures = services.typing.TypeFeatures
  }

  public resolveOverloads(callExpr: CallExpression, maybeCandidates: AstNode[]): AstNode[] {
    const candidates = maybeCandidates.flatMap(maybe => isClassDeclaration(maybe) ? maybe.members.filter(isConstructorDeclaration) : maybe)
    if (candidates.length <= 1) {
      return candidates
    }

    const groupedCandidates = candidates.reduce((map, it) => map.add(it.$container!, it), new MultiMap<AstNode, AstNode>())
    for (const container of groupedCandidates.keys()) {
      const overloads = this.analyzeOverloads(new Set(groupedCandidates.get(container)), callExpr.arguments)
      if (overloads.length) {
        return overloads
      }
      else {
        // FIXME: overloading error
        // For debugging, consider adding a breakpoint here
        console.error(`Could not resolve overloads for call expression: ${callExpr.$cstNode?.text}`)
      }
    }

    return candidates
  }

  private analyzeOverloads(candidates: Set<AstNode>, args: Expression[]): AstNode[] {
    const possibles = candidates.values()
      .map(it => ({ candidate: it, match: this.match(it, args) }))
      .filter(it => it.match !== OverloadMatch.NotMatch)
      .toArray()
      .sort((a, b) => a.match - b.match)
    const groupedPossibles = Object.groupBy(possibles, it => it.match)
    const bestMatches = Object.values(groupedPossibles).at(0) ?? []

    if (bestMatches.length > 1) {
      this.logAmbiguous(possibles, args)
    }

    return bestMatches.map(it => it.candidate)
  }

  private logAmbiguous(possibles: { candidate: AstNode, match: OverloadMatch }[], args: Expression[]) {
    const argTypes = args.map(it => this.typeComputer.inferType(it)?.toString() ?? 'undefined').join(', ')
    console.warn(`ambiguous overload for (${argTypes})`)
    for (const { candidate, match } of possibles) {
      const name = 'name' in candidate ? candidate.name : 'Unnamed'
      const funcType = this.typeComputer.inferType(candidate) as FunctionType
      const paramTypes = funcType.paramTypes.map(it => it.toString()).join(', ')
      console.warn(`----- ${OverloadMatch[match]} ${name}(${paramTypes})`)
    }
  }

  private match(node: AstNode, args: Expression[]): OverloadMatch {
    const matchSet = new Set([OverloadMatch.ExactMatch])
    if (isCallableDeclaration(node)) {
      this.matchCallable(node, args, matchSet)
    }
    else if (isFieldDeclaration(node)) {
      this.matchFunctionProperty(node, args, matchSet)
    }
    else {
      matchSet.add(OverloadMatch.NotMatch)
    }
    return worstMatch(matchSet)
  }

  private matchCallable(callable: CallableDeclaration, args: Expression[], matchSet: Set<OverloadMatch>) {
    const params = [...callable.parameters]
    const map = this.createParamToArgsMap(params, args)

    if (args.length > map.size) {
      matchSet.add(OverloadMatch.NotMatch)
      return
    }

    for (const param of params) {
      const arg = map.get(param).at(0)
      // special checking
      if (param.varargs) {
        matchSet.add(OverloadMatch.VarargMatch)
        if (!arg) {
          continue
        }
      }
      else if (param.defaultValue) {
        matchSet.add(OverloadMatch.OptionalArgMatch)
        if (!arg) {
          continue
        }
      }
      else {
        if (!arg) {
          matchSet.add(OverloadMatch.NotMatch)
          break
        }
      }

      // type checking
      const paramType = this.typeComputer.inferType(param)
      const argType = this.typeComputer.inferType(arg)
      if (!paramType || !argType) {
        matchSet.add(OverloadMatch.ImplicitCastMatch)
      }
      else {
        this.matchType(paramType, argType, matchSet)
      }
    }
  }

  private createParamToArgsMap(params: ValueParameter[], args: Expression[]): MultiMap<ValueParameter, Expression> {
    const map = new MultiMap<ValueParameter, Expression>()
    for (let a = 0, p = 0, arg = args[a], param = params[p]; a < args.length && p < params.length;) {
      if (arg) {
        map.add(param, arg)
        arg = args[++a]
      }
      if (!param.varargs) {
        param = params[++p]
      }
    }
    return map
  }

  private matchFunctionProperty(property: FieldDeclaration, args: Expression[], matchSet: Set<OverloadMatch>) {
    matchSet.add(OverloadMatch.FunctionPropertyMatch)

    const funcType = this.typeComputer.inferType(property)
    if (!isFunctionType(funcType)) {
      matchSet.add(OverloadMatch.NotMatch)
      return
    }

    if (funcType.paramTypes.length !== args.length) {
      matchSet.add(OverloadMatch.NotMatch)
      return
    }

    funcType.paramTypes.forEach((paramType, index) => {
      const argType = this.typeComputer.inferType(args[index])
      if (!argType) {
        matchSet.add(OverloadMatch.ImplicitCastMatch)
      }
      else {
        this.matchType(paramType, argType, matchSet)
      }
    })
  }

  private matchType(paramType: Type, argType: Type, matchSet: Set<OverloadMatch>) {
    if (this.typeFeatures.areTypesEqual(paramType, argType)) {
      matchSet.add(OverloadMatch.ExactMatch)
    }
    else if (this.typeFeatures.isSubType(argType, paramType)) {
      matchSet.add(OverloadMatch.SubtypeMatch)
    }
    else if (this.typeFeatures.isConvertible(argType, paramType)) {
      matchSet.add(OverloadMatch.ImplicitCastMatch)
    }
    else {
      matchSet.add(OverloadMatch.NotMatch)
    }
  }
}
