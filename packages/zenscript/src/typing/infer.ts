import type { AstNode, ResolvedReference } from 'langium'
import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import { isClassDeclaration } from '../generated/ast'
import { ArrayTypeDescription, ClassTypeDescription, FunctionTypeDescription, IntRangeTypeDescription, IntersectionTypeDescription, ListTypeDescription, MapTypeDescription, PrimitiveTypeDescription, type TypeDescription, UnionTypeDescription } from './description'

export interface TypeComputer {
  inferType: (node: AstNode | undefined) => TypeDescription | undefined
}

type SourceMap = ZenScriptAstType
type SourceKey = keyof SourceMap
type Produce<K extends SourceKey, S extends SourceMap[K]> = (source: S) => TypeDescription | undefined
type Rule = <K extends SourceKey, S extends SourceMap[K]>(match: K, produce: Produce<K, S>) => void
type RuleMap = Map<SourceKey, Produce<SourceKey, any>>

export class ZenScriptTypeComputer implements TypeComputer {
  private readonly rules: RuleMap

  public inferType(node: AstNode | undefined): TypeDescription | undefined {
    const match = node?.$type as SourceKey
    const produce = this.rules.get(match)
    return produce ? produce(node) : undefined
  }

  constructor() {
    this.rules = this.initRules()
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
    rule('PrimitiveTypeReference', (source) => {
      return new PrimitiveTypeDescription(source.value)
    })

    rule('ListTypeReference', (source) => {
      const elementType = this.inferType(source.value) ?? PrimitiveTypeDescription.ANY
      return new ListTypeDescription(elementType)
    })

    rule('ArrayTypeReference', (source) => {
      const elementType = this.inferType(source.value) ?? PrimitiveTypeDescription.ANY
      return new ListTypeDescription(elementType)
    })

    rule('MapTypeReference', (source) => {
      const keyType = this.inferType(source.key) ?? PrimitiveTypeDescription.ANY
      const valueType = this.inferType(source.value) ?? PrimitiveTypeDescription.ANY
      return new MapTypeDescription(keyType, valueType)
    })

    rule('UnionTypeReference', (source) => {
      const elementTypes = source.values.map(it => this.inferType(it) ?? PrimitiveTypeDescription.ANY)
      return new UnionTypeDescription(elementTypes)
    })

    rule('IntersectionTypeReference', (source) => {
      const elementTypes = source.values.map(it => this.inferType(it) ?? PrimitiveTypeDescription.ANY)
      return new IntersectionTypeDescription(elementTypes)
    })

    rule('ParenthesizedTypeReference', (source) => {
      return this.inferType(source.value)
    })

    rule('FunctionTypeReference', (source) => {
      const paramTypes = source.params.map(it => this.inferType(it) ?? PrimitiveTypeDescription.ANY)
      const returnType = this.inferType(source.returnType) ?? PrimitiveTypeDescription.ANY
      return new FunctionTypeDescription(paramTypes, returnType)
    })

    rule('ClassTypeReference', (source) => {
      const className = source.path.map(it => it.$refText).join('.')
      const typeDesc = new ClassTypeDescription(className)
      const ref = source.path.at(-1)
      if (isClassDeclaration(ref?.ref)) {
        typeDesc.ref = ref as ResolvedReference<ClassDeclaration>
      }
      return typeDesc
    })
    // endregion

    // region Declaration
    rule('VariableDeclaration', (source) => {
      if (source.typeRef) {
        return this.inferType(source.typeRef) ?? PrimitiveTypeDescription.ANY
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? PrimitiveTypeDescription.ANY
      }
      else {
        return PrimitiveTypeDescription.ANY
      }
    })
    // endregion

    // region Expression
    rule('Assignment', (source) => {
      return this.inferType(source.right)
    })

    rule('ConditionalExpression', (_) => {
      // TODO: operator overloading
      return PrimitiveTypeDescription.BOOL
    })

    rule('PrefixExpression', (source) => {
      switch (source.op) {
        case '-':
          return PrimitiveTypeDescription.INT
        case '!':
          return PrimitiveTypeDescription.BOOL
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
          return PrimitiveTypeDescription.INT
        case '<':
        case '>':
        case '<=':
        case '>=':
          return PrimitiveTypeDescription.BOOL
        case '==':
        case '!=':
          return PrimitiveTypeDescription.BOOL
        case '&&':
        case '||':
          return PrimitiveTypeDescription.BOOL
        case 'has':
        case 'in':
          return PrimitiveTypeDescription.BOOL
        case '&':
        case '|':
        case '^':
          return PrimitiveTypeDescription.INT
        case '~':
          return PrimitiveTypeDescription.STRING
        case 'to':
        case '..':
          return new IntRangeTypeDescription()
      }
    })

    rule('TypeCastExpression', (source) => {
      return this.inferType(source.typeRef)
    })

    rule('InstanceofExpression', (_) => {
      return PrimitiveTypeDescription.BOOL
    })

    rule('ParenthesizedExpression', (source) => {
      return this.inferType(source.expr)
    })

    rule('BracketExpression', (_) => {
      // TODO: infer bracket expression
      return PrimitiveTypeDescription.ANY
    })

    rule('FunctionExpression', (source) => {
      const paramTypes = source.parameters.map((param) => {
        if (param.typeRef) {
          return this.inferType(param.typeRef) ?? PrimitiveTypeDescription.ANY
        }
        else if (param.defaultValue) {
          return this.inferType(param.defaultValue) ?? PrimitiveTypeDescription.ANY
        }
        else {
          return PrimitiveTypeDescription.ANY
        }
      })
      const returnType = this.inferType(source.returnTypeRef) ?? PrimitiveTypeDescription.ANY
      return new FunctionTypeDescription(paramTypes, returnType)
    })

    rule('LocalVariable', (source) => {
      return this.inferType(source.refer.ref) ?? PrimitiveTypeDescription.ANY
    })

    rule('NullLiteral', (_) => {
      // TODO: does it make sense?
      return PrimitiveTypeDescription.ANY
    })

    rule('BooleanLiteral', (_) => {
      return PrimitiveTypeDescription.BOOL
    })

    rule('IntegerLiteral', (source) => {
      switch (source.value.at(-1)) {
        case 'l':
        case 'L':
          return PrimitiveTypeDescription.LONG

        default:
          return PrimitiveTypeDescription.INT
      }
    })

    rule('FloatingLiteral', (source) => {
      switch (source.value.at(-1)) {
        case 'f':
        case 'F':
          return PrimitiveTypeDescription.FLOAT

        case 'd':
        case 'D':
          return PrimitiveTypeDescription.DOUBLE

        default:
          return PrimitiveTypeDescription.DOUBLE
      }
    })

    rule('StringLiteral', (_) => {
      return PrimitiveTypeDescription.STRING
    })

    rule('StringTemplate', (_) => {
      return PrimitiveTypeDescription.STRING
    })

    rule('ArrayLiteral', (source) => {
      const elementType = this.inferType(source.values[0]) ?? PrimitiveTypeDescription.ANY
      return new ArrayTypeDescription(elementType)
    })

    rule('MapLiteral', (source) => {
      const keyType = this.inferType(source.entries[0]?.key) ?? PrimitiveTypeDescription.ANY
      const valueType = this.inferType(source.entries[0]?.value) ?? PrimitiveTypeDescription.ANY
      return new MapTypeDescription(keyType, valueType)
    })
    // endregion

    return rules
  }
}
