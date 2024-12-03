import type { CallableDeclaration, CallExpression, Expression, ValueParameter } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptTypeComputer } from './type-computer'
import type { ZenScriptTypeFeatures } from './type-features'
import { type AstNode, MultiMap } from 'langium'
import { isClassDeclaration, isConstructorDeclaration, isFunctionDeclaration } from '../generated/ast'

export interface OverloadResolver {
  resolveOverloads: (callExpr: CallExpression, maybeCandidates: AstNode[]) => AstNode[]
}

export enum OverloadMatch {
  ExactMatch,
  VarargMatch,
  OptionalArgMatch,
  SubtypeMatch,
  ImplicitCastMatch,
  NotMatch,
}

function worstMatch(matchSet: Set<OverloadMatch>): OverloadMatch {
  return Array.from(matchSet).sort((a, b) => a - b).at(-1) ?? OverloadMatch.NotMatch
}

export class ZenScriptOverloadResolver implements OverloadResolver {
  private readonly typeComputer: ZenScriptTypeComputer
  private readonly typeFeatures: ZenScriptTypeFeatures

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
    this.typeFeatures = services.typing.TypeFeatures
  }

  public resolveOverloads(callExpr: CallExpression, maybeCandidates: AstNode[]): AstNode[] {
    const first = maybeCandidates.at(0)
    if (!first) {
      return []
    }

    let candidates: CallableDeclaration[]
    if (isClassDeclaration(first)) {
      candidates = first.members.filter(isConstructorDeclaration)
    }
    else if (isFunctionDeclaration(first)) {
      candidates = maybeCandidates.filter(isFunctionDeclaration)
    }
    else if (isConstructorDeclaration(first)) {
      candidates = maybeCandidates.filter(isConstructorDeclaration)
    }
    else {
      console.error(`Invalid candidates for call expression: ${callExpr.$cstNode?.text}`)
      return []
    }

    if (candidates.length === 1) {
      return candidates
    }

    const overloads = this.analyzeOverloads(new Set(candidates), callExpr.arguments)
    if (overloads.length) {
      return overloads
    }
    else {
      // FIXME: overloading error
      // For debugging, consider adding a breakpoint here or returning an empty array
      console.error(`Error resolving overloads for call expression: ${callExpr.$cstNode?.text}`)
      return candidates
    }
  }

  private analyzeOverloads(candidates: Set<CallableDeclaration>, args: Expression[]): CallableDeclaration[] {
    const possibles = candidates.values()
      .map(it => ({ candidate: it, match: this.matchSignature(it, args) }))
      .filter(it => it.match !== OverloadMatch.NotMatch)
      .toArray()
      .sort((a, b) => a.match - b.match)
    const groupedPossibles = Object.groupBy(possibles, it => it.match)
    const bestMatches = Object.values(groupedPossibles).at(0) ?? []

    if (bestMatches.length > 1) {
      this.logAmbiguousOverload(possibles, args)
    }

    return bestMatches.map(it => it.candidate)
  }

  private logAmbiguousOverload(possibles: { candidate: CallableDeclaration, match: OverloadMatch }[], args: Expression[]) {
    const first = possibles[0].candidate
    const name = isConstructorDeclaration(first) ? first.$container.name : first.name
    const types = args.map(it => this.typeComputer.inferType(it)?.toString()).join(', ')
    console.warn(`ambiguous overload for ${name}(${types})`)
    for (const { candidate, match } of possibles) {
      const params = candidate.parameters
        .map((it) => {
          const str = this.typeComputer.inferType(it)?.toString() ?? 'undefined'
          if (it.varargs) {
            return `...${str}`
          }
          else if (it.defaultValue) {
            return `${str}?`
          }
          else {
            return str
          }
        }).join(', ')
      console.warn(`----- ${OverloadMatch[match]} ${name}(${params})`)
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

  private matchSignature(callable: CallableDeclaration, args: Expression[]): OverloadMatch {
    const params = [...callable.parameters]
    const map = this.createParamToArgsMap(params, args)

    const matchSet = new Set([OverloadMatch.ExactMatch])
    if (args.length > map.size) {
      matchSet.add(OverloadMatch.NotMatch)
    }
    else {
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
          break
        }
      }
    }
    return worstMatch(matchSet)
  }
}
