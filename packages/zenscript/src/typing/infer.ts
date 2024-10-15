import type { AstNode, ResolvedReference } from 'langium'
import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import { isClassDeclaration, isExpression } from '../generated/ast'
import { ArrayTypeDescription, ClassTypeDescription, FunctionTypeDescription, IntRangeTypeDescription, IntersectionTypeDescription, ListTypeDescription, MapTypeDescription, type TypeDescription, UnionTypeDescription, isFunctionTypeDescription } from './description'

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
    return this.rules.get(match)?.call(this, node)
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
    rule('ListTypeReference', (source) => {
      const elementType = this.inferType(source.value) ?? ClassTypeDescription.ANY
      return new ListTypeDescription(elementType)
    })

    rule('ArrayTypeReference', (source) => {
      const elementType = this.inferType(source.value) ?? ClassTypeDescription.ANY
      return new ListTypeDescription(elementType)
    })

    rule('MapTypeReference', (source) => {
      const keyType = this.inferType(source.key) ?? ClassTypeDescription.ANY
      const valueType = this.inferType(source.value) ?? ClassTypeDescription.ANY
      return new MapTypeDescription(keyType, valueType)
    })

    rule('UnionTypeReference', (source) => {
      const elementTypes = source.values.map(it => this.inferType(it) ?? ClassTypeDescription.ANY)
      return new UnionTypeDescription(elementTypes)
    })

    rule('IntersectionTypeReference', (source) => {
      const elementTypes = source.values.map(it => this.inferType(it) ?? ClassTypeDescription.ANY)
      return new IntersectionTypeDescription(elementTypes)
    })

    rule('ParenthesizedTypeReference', (source) => {
      return this.inferType(source.value)
    })

    rule('FunctionTypeReference', (source) => {
      const paramTypes = source.params.map(it => this.inferType(it) ?? ClassTypeDescription.ANY)
      const returnType = this.inferType(source.returnType) ?? ClassTypeDescription.ANY
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
        return this.inferType(source.typeRef) ?? ClassTypeDescription.ANY
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? ClassTypeDescription.ANY
      }
      else {
        return ClassTypeDescription.ANY
      }
    })

    rule('FunctionDeclaration', (source) => {
      const paramTypes = source.parameters.map(it => this.inferType(it) ?? ClassTypeDescription.ANY)
      const returnType = this.inferType(source.returnTypeRef) ?? ClassTypeDescription.ANY
      return new FunctionTypeDescription(paramTypes, returnType)
    })

    rule('FieldDeclaration', (source) => {
      if (source.typeRef) {
        return this.inferType(source.typeRef) ?? ClassTypeDescription.ANY
      }
      else if (source.initializer) {
        return this.inferType(source.initializer) ?? ClassTypeDescription.ANY
      }
      else {
        return ClassTypeDescription.ANY
      }
    })
    // endregion

    // region Expression
    rule('Assignment', (source) => {
      return this.inferType(source.right)
    })

    rule('ConditionalExpression', (_) => {
      // TODO: operator overloading
      return ClassTypeDescription.BOOL
    })

    rule('PrefixExpression', (source) => {
      switch (source.op) {
        case '-':
          return ClassTypeDescription.INT
        case '!':
          return ClassTypeDescription.BOOL
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
          return ClassTypeDescription.INT
        case '<':
        case '>':
        case '<=':
        case '>=':
          return ClassTypeDescription.BOOL
        case '==':
        case '!=':
          return ClassTypeDescription.BOOL
        case '&&':
        case '||':
          return ClassTypeDescription.BOOL
        case 'has':
        case 'in':
          return ClassTypeDescription.BOOL
        case '&':
        case '|':
        case '^':
          return ClassTypeDescription.INT
        case '~':
          return ClassTypeDescription.STRING
        case 'to':
        case '..':
          return new IntRangeTypeDescription()
      }
    })

    rule('TypeCastExpression', (source) => {
      return this.inferType(source.typeRef)
    })

    rule('InstanceofExpression', (_) => {
      return ClassTypeDescription.BOOL
    })

    rule('ParenthesizedExpression', (source) => {
      return this.inferType(source.expr)
    })

    rule('BracketExpression', (_) => {
      // TODO: infer bracket expression
      return ClassTypeDescription.ANY
    })

    rule('FunctionExpression', (source) => {
      const paramTypes = source.parameters.map((param) => {
        if (param.typeRef) {
          return this.inferType(param.typeRef) ?? ClassTypeDescription.ANY
        }
        else if (isExpression(param.defaultValue)) {
          return this.inferType(param.defaultValue) ?? ClassTypeDescription.ANY
        }
        else {
          return ClassTypeDescription.ANY
        }
      })
      const returnType = this.inferType(source.returnTypeRef) ?? ClassTypeDescription.ANY
      return new FunctionTypeDescription(paramTypes, returnType)
    })

    rule('ReferenceExpression', (source) => {
      return this.inferType(source.refer.ref) ?? ClassTypeDescription.ANY
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
      return ClassTypeDescription.ANY
    })

    rule('BooleanLiteral', (_) => {
      return ClassTypeDescription.BOOL
    })

    rule('IntegerLiteral', (source) => {
      switch (source.value.at(-1)) {
        case 'l':
        case 'L':
          return ClassTypeDescription.LONG

        default:
          return ClassTypeDescription.INT
      }
    })

    rule('FloatingLiteral', (source) => {
      switch (source.value.at(-1)) {
        case 'f':
        case 'F':
          return ClassTypeDescription.FLOAT

        case 'd':
        case 'D':
          return ClassTypeDescription.DOUBLE

        default:
          return ClassTypeDescription.DOUBLE
      }
    })

    rule('StringLiteral', (_) => {
      return ClassTypeDescription.STRING
    })

    rule('StringTemplate', (_) => {
      return ClassTypeDescription.STRING
    })

    rule('ArrayLiteral', (source) => {
      const elementType = this.inferType(source.values[0]) ?? ClassTypeDescription.ANY
      return new ArrayTypeDescription(elementType)
    })

    rule('MapLiteral', (source) => {
      const keyType = this.inferType(source.entries[0]?.key) ?? ClassTypeDescription.ANY
      const valueType = this.inferType(source.entries[0]?.value) ?? ClassTypeDescription.ANY
      return new MapTypeDescription(keyType, valueType)
    })
    // endregion

    return rules
  }
}
