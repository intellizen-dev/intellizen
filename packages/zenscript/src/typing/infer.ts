import type { AstNode, ResolvedReference } from 'langium'
import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import { isClassDeclaration, isExpression } from '../generated/ast'
import type { PackageManager } from '../workspace/package-manager'
import type { ZenScriptServices } from '../module'
import type { BuiltinTypes, TypeDescription } from './description'
import { ArrayTypeDescription, ClassTypeDescription, FunctionTypeDescription, IntRangeTypeDescription, IntersectionTypeDescription, ListTypeDescription, MapTypeDescription, UnionTypeDescription, isFunctionTypeDescription } from './description'

export interface TypeComputer {
  inferType: (node: AstNode | undefined) => TypeDescription | undefined
}

type SourceMap = ZenScriptAstType
type SourceKey = keyof SourceMap
type Produce<K extends SourceKey, S extends SourceMap[K]> = (source: S) => TypeDescription | undefined
type Rule = <K extends SourceKey, S extends SourceMap[K]>(match: K, produce: Produce<K, S>) => void
type RuleMap = Map<SourceKey, Produce<SourceKey, any>>

export class ZenScriptTypeComputer implements TypeComputer {
  private readonly packageManager: PackageManager
  private readonly rules: RuleMap

  constructor(services: ZenScriptServices) {
    this.packageManager = services.workspace.PackageManager
    this.rules = this.initRules()
  }

  public inferType(node: AstNode | undefined): TypeDescription | undefined {
    const match = node?.$type as SourceKey
    return this.rules.get(match)?.call(this, node)
  }

  private classTypeOf(className: BuiltinTypes): ClassTypeDescription {
    const desc = new ClassTypeDescription(className)
    const classDecl = this.packageManager.getAstNode(className)?.filter(it => isClassDeclaration(it))[0]
    if (classDecl) {
      desc.ref = { ref: classDecl } as ResolvedReference<ClassDeclaration>
    }
    return desc
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
    rule('ListTypeReference', (source) => {
      const elementType = this.inferType(source.value) ?? this.classTypeOf('any')
      return new ListTypeDescription(elementType)
    })

    rule('ArrayTypeReference', (source) => {
      const elementType = this.inferType(source.value) ?? this.classTypeOf('any')
      return new ListTypeDescription(elementType)
    })

    rule('MapTypeReference', (source) => {
      const keyType = this.inferType(source.key) ?? this.classTypeOf('any')
      const valueType = this.inferType(source.value) ?? this.classTypeOf('any')
      return new MapTypeDescription(keyType, valueType)
    })

    rule('UnionTypeReference', (source) => {
      const elementTypes = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new UnionTypeDescription(elementTypes)
    })

    rule('IntersectionTypeReference', (source) => {
      const elementTypes = source.values.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      return new IntersectionTypeDescription(elementTypes)
    })

    rule('ParenthesizedTypeReference', (source) => {
      return this.inferType(source.value)
    })

    rule('FunctionTypeReference', (source) => {
      const paramTypes = source.params.map(it => this.inferType(it) ?? this.classTypeOf('any'))
      const returnType = this.inferType(source.returnType) ?? this.classTypeOf('any')
      return new FunctionTypeDescription(paramTypes, returnType)
    })

    rule('ClassTypeReference', (source) => {
      const className = source.path.map(it => it.$refText).join('.')
      const typeDesc = new ClassTypeDescription(className)
      const refer = source.path.at(-1)
      if (isClassDeclaration(refer?.ref)) {
        typeDesc.ref = refer as ResolvedReference<ClassDeclaration>
      }
      return typeDesc
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
      return new FunctionTypeDescription(paramTypes, returnType)
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
          return new IntRangeTypeDescription()
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
      return new FunctionTypeDescription(paramTypes, returnType)
    })

    rule('ReferenceExpression', (source) => {
      return this.inferType(source.refer.ref) ?? this.classTypeOf('any')
    })

    rule('MemberAccess', (source) => {
      return this.inferType(source.refer.ref)
    })

    rule('CallExpression', (source) => {
      const receiverType = this.inferType(source.receiver)
      if (isFunctionTypeDescription(receiverType)) {
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
      const elementType = this.inferType(source.values[0]) ?? this.classTypeOf('any')
      return new ArrayTypeDescription(elementType)
    })

    rule('MapLiteral', (source) => {
      const keyType = this.inferType(source.entries[0]?.key) ?? this.classTypeOf('any')
      const valueType = this.inferType(source.entries[0]?.value) ?? this.classTypeOf('any')
      return new MapTypeDescription(keyType, valueType)
    })
    // endregion

    return rules
  }
}
