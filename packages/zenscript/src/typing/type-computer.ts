import type { AstNode } from 'langium'
import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import { isClassDeclaration, isExpression, isTypeParameter } from '../generated/ast'
import type { PackageManager } from '../workspace/package-manager'
import type { ZenScriptServices } from '../module'
import type { BuiltinTypes, Type, TypeParameterSubstitutions } from './type-description'
import { ClassType, CompoundType, FunctionType, IntersectionType, TypeVariable, UnionType, isClassType, isFunctionType } from './type-description'

export interface TypeComputer {
  inferType: (node: AstNode | undefined) => Type | undefined
}

type SourceMap = ZenScriptAstType
type SourceKey = keyof SourceMap
type Produce<K extends SourceKey, S extends SourceMap[K]> = (source: S) => Type | undefined
type Rule = <K extends SourceKey, S extends SourceMap[K]>(match: K, produce: Produce<K, S>) => void
type RuleMap = Map<SourceKey, Produce<SourceKey, any>>

export class ZenScriptTypeComputer implements TypeComputer {
  private readonly packageManager: PackageManager
  private readonly rules: RuleMap

  constructor(services: ZenScriptServices) {
    this.packageManager = services.workspace.PackageManager
    this.rules = this.initRules()
  }

  public inferType(node: AstNode | undefined): Type | undefined {
    const match = node?.$type as SourceKey
    return this.rules.get(match)?.call(this, node)
  }

  private classTypeOf(className: BuiltinTypes | string, substitutions: TypeParameterSubstitutions = new Map()): ClassType {
    const classDecl = this.classDeclOf(className)
    if (!classDecl) {
      throw new Error(`Class "${className}" is not defined.`)
    }
    return new ClassType(classDecl, substitutions)
  }

  private classDeclOf(className: BuiltinTypes | string): ClassDeclaration | undefined {
    return this.packageManager.getAstNode(className)?.filter(it => isClassDeclaration(it))[0]
  }

  private initRules(): RuleMap {
    const rules: RuleMap = new Map()
    const rule: Rule = (match, produce) => {
      if (rules.has(match)) {
        throw new Error(`Rule "${match}" is already defined.`)
      }
      rules.set(match, produce)
    }

    // region TypeReference
    rule('ArrayTypeReference', (source) => {
      const arrayType = this.classTypeOf('Array')
      const T = arrayType.declaration.typeParameters[0]
      arrayType.substitutions.set(T, this.inferType(source.value) ?? this.classTypeOf('any'))
      return arrayType
    })

    rule('ListTypeReference', (source) => {
      const listType = this.classTypeOf('List')
      const T = listType.declaration.typeParameters[0]
      listType.substitutions.set(T, this.inferType(source.value) ?? this.classTypeOf('any'))
      return listType
    })

    rule('MapTypeReference', (source) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParameters[0]
      const V = mapType.declaration.typeParameters[1]
      mapType.substitutions.set(K, this.inferType(source.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(source.value) ?? this.classTypeOf('any'))
      return mapType
    })

    rule('UnionTypeReference', (source) => {
      const types = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new UnionType(types)
    })

    rule('IntersectionTypeReference', (source) => {
      const types = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new IntersectionType(types)
    })

    rule('CompoundTypeReference', (source) => {
      const types = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new CompoundType(types)
    })

    rule('ParenthesizedTypeReference', (source) => {
      return this.inferType(source.value)
    })

    rule('FunctionTypeReference', (source) => {
      const paramTypes = source.params.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.returnType) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    })

    rule('NamedTypeReference', (source) => {
      const ref = source.path.at(-1)?.ref
      if (isTypeParameter(ref)) {
        return new TypeVariable(ref)
      }
      else if (isClassDeclaration(ref)) {
        return new ClassType(ref, new Map())
      }
    })
    // endregion

    // region Declaration
    rule('VariableDeclaration', (source) => {
      if (source.typeRef) {
        return this.inferType(source.typeRef) ?? this.classTypeOf('any')
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    })

    rule('FunctionDeclaration', (source) => {
      const paramTypes = source.parameters.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.returnTypeRef) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    })

    rule('FieldDeclaration', (source) => {
      if (source.typeRef) {
        return this.inferType(source.typeRef) ?? this.classTypeOf('any')
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? this.classTypeOf('any')
      }
      else {
        return this.classTypeOf('any')
      }
    })
    // endregion

    // region Expression
    rule('Assignment', (source) => {
      return this.inferType(source.right)
    })

    rule('ConditionalExpression', (_) => {
      // TODO: operator overloading
      return this.classTypeOf('bool')
    })

    rule('PrefixExpression', (source) => {
      switch (source.op) {
        case '-':
          return this.classTypeOf('int')
        case '!':
          return this.classTypeOf('bool')
      }
    })

    rule('InfixExpression', (source) => {
      // TODO: operator overloading
      switch (source.op) {
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
          return this.classTypeOf('int')
        case '<':
        case '>':
        case '<=':
        case '>=':
          return this.classTypeOf('bool')
        case '==':
        case '!=':
          return this.classTypeOf('bool')
        case '&&':
        case '||':
          return this.classTypeOf('bool')
        case 'has':
        case 'in':
          return this.classTypeOf('bool')
        case '&':
        case '|':
        case '^':
          return this.classTypeOf('int')
        case '~':
          return this.classTypeOf('string')
        case 'to':
        case '..':
          return this.classTypeOf('IntRange')
      }
    })

    rule('TypeCastExpression', (source) => {
      return this.inferType(source.typeRef)
    })

    rule('InstanceofExpression', (_) => {
      return this.classTypeOf('bool')
    })

    rule('ParenthesizedExpression', (source) => {
      return this.inferType(source.expr)
    })

    rule('BracketExpression', (_) => {
      // TODO: infer bracket expression
      return this.classTypeOf('any')
    })

    rule('FunctionExpression', (source) => {
      const paramTypes = source.parameters.map((param) => {
        if (param.typeRef) {
          return this.inferType(param.typeRef) ?? this.classTypeOf('any')
        }
        else if (isExpression(param.defaultValue)) {
          return this.inferType(param.defaultValue) ?? this.classTypeOf('any')
        }
        else {
          return this.classTypeOf('any')
        }
      })
      const returnType = this.inferType(source.returnTypeRef) ?? this.classTypeOf('any')
      return new FunctionType(paramTypes, returnType)
    })

    rule('ReferenceExpression', (source) => {
      return this.inferType(source.target.ref) ?? this.classTypeOf('any')
    })

    rule('MemberAccess', (source) => {
      const receiverType = this.inferType(source.receiver)
      const memberType = this.inferType(source.target.ref)
      if (memberType && isClassType(receiverType)) {
        return memberType.substituteTypeParameters(receiverType.substitutions)
      }
      return memberType
    })

    rule('CallExpression', (source) => {
      const receiverType = this.inferType(source.receiver)
      if (isFunctionType(receiverType)) {
        return receiverType.returnType
      }
    })

    rule('NullLiteral', (_) => {
      // TODO: does it make sense?
      return this.classTypeOf('any')
    })

    rule('BooleanLiteral', (_) => {
      return this.classTypeOf('bool')
    })

    rule('IntegerLiteral', (source) => {
      switch (source.value.at(-1)) {
        case 'l':
        case 'L':
          return this.classTypeOf('long')

        default:
          return this.classTypeOf('int')
      }
    })

    rule('FloatingLiteral', (source) => {
      switch (source.value.at(-1)) {
        case 'f':
        case 'F':
          return this.classTypeOf('float')

        case 'd':
        case 'D':
          return this.classTypeOf('double')

        default:
          return this.classTypeOf('double')
      }
    })

    rule('StringLiteral', (_) => {
      return this.classTypeOf('string')
    })

    rule('StringTemplate', (_) => {
      return this.classTypeOf('string')
    })

    rule('ArrayLiteral', (source) => {
      const arrayType = this.classTypeOf('Array')
      const T = arrayType.declaration.typeParameters[0]
      arrayType.substitutions.set(T, this.inferType(source.values[0]) ?? this.classTypeOf('any'))
      return arrayType
    })

    rule('MapLiteral', (source) => {
      const mapType = this.classTypeOf('Map')
      const K = mapType.declaration.typeParameters[0]
      const V = mapType.declaration.typeParameters[1]
      mapType.substitutions.set(K, this.inferType(source.entries[0]?.key) ?? this.classTypeOf('any'))
      mapType.substitutions.set(V, this.inferType(source.entries[0]?.value) ?? this.classTypeOf('any'))
      return mapType
    })
    // endregion

    return rules
  }
}
