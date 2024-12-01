import type { CallableDeclaration, CallExpression, Expression, ValueParameter } from '../generated/ast'
import type { ZenScriptServices } from '../module'
import type { ZenScriptTypeComputer } from './type-computer'
import type { ZenScriptTypeFeatures } from './type-features'
import { type AstNode, MultiMap } from 'langium'
import { isClassDeclaration, isConstructorDeclaration, isFunctionDeclaration } from '../generated/ast'

export interface OverloadResolver {
  resolveCallables: (callExpr: CallExpression, maybeCandidates: AstNode[]) => CallableDeclaration | undefined
}

export enum OverloadMatch {
  ExactMatch,
  VarargMatch,
  OptionalArgMatch,
  SubtypeMatch,
  ImplicitCastMatch,
}

export function isMatched(match: OverloadMatch): boolean {
  return OverloadMatch[match] !== undefined
}

function highestBitPosition(bitset: number): number {
  if (bitset === 0) {
    return Number.NaN
  }
  return Math.floor(Math.log2(bitset))
}

export class ZenScriptOverloadResolver implements OverloadResolver {
  private readonly typeComputer: ZenScriptTypeComputer
  private readonly typeFeatures: ZenScriptTypeFeatures

  constructor(services: ZenScriptServices) {
    this.typeComputer = services.typing.TypeComputer
    this.typeFeatures = services.typing.TypeFeatures
  }

  public resolveCallables(callExpr: CallExpression, maybeCandidates: AstNode[]): CallableDeclaration | undefined {
    const first = maybeCandidates.at(0)
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
      return
    }

    const overloads = this.analyzeOverloads(new Set(candidates), callExpr.arguments)
    if (overloads.length === 1) {
      return overloads[0]
    }
    else {
      // TODO: Workaround, waiting for langium supports multi-target references
      return overloads[0]
    }
  }

  private analyzeOverloads<C extends CallableDeclaration>(candidates: Set<C>, args: Expression[]): C[] {
    const possibles = candidates.values()
      .map(candidate => ({
        candidate,
        match: this.matchSignature(candidate, args),
      }))
      .toArray()
      .sort((a, b) => a.match - b.match)
      .filter(it => isMatched(it.match))
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
    const NotMatch = Number.NaN

    let match = 1 << OverloadMatch.ExactMatch
    if (args.length > map.size) {
      match = NotMatch
    }
    else {
      for (const param of params) {
        const arg = map.get(param).at(0)
        // special checking
        if (param.varargs) {
          match |= 1 << OverloadMatch.VarargMatch
          if (!arg) {
            continue
          }
        }
        else if (param.defaultValue) {
          match |= 1 << OverloadMatch.OptionalArgMatch
          if (!arg) {
            continue
          }
        }
        else {
          if (!arg) {
            match = NotMatch
            break
          }
        }

        // type checking
        const paramType = this.typeComputer.inferType(param)
        const argType = this.typeComputer.inferType(arg)
        if (this.typeFeatures.areTypesEqual(paramType, argType)) {
          match |= 1 << OverloadMatch.ExactMatch
        }
        else if (this.typeFeatures.isSubType(argType, paramType)) {
          match |= 1 << OverloadMatch.SubtypeMatch
        }
        else if (this.typeFeatures.isConvertible(argType, paramType)) {
          match |= 1 << OverloadMatch.ImplicitCastMatch
        }
        else {
          match = NotMatch
          break
        }
      }
    }
    return highestBitPosition(match)
  }
}
