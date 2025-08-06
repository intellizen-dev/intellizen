type Entity = Script
    | Declaration
    | MapEntry

interface Script {
    package?: PackageDeclaration
    imports: ImportDeclaration[]
    functions: FunctionDeclaration[]
    classes: ClassDeclaration[]
    expands: (ExpandDeclaration | ExpandFunctionDeclaration)[]
    statements: Statement[]
}

//region Declaration
type Declaration = PackageDeclaration
    | ImportDeclaration
    | ClassDeclaration
    | FieldDeclaration
    | FunctionDeclaration
    | ExpandFunctionDeclaration
    | ConstructorDeclaration
    | VariableDeclaration
    | ValueParameter
    | LoopParameter
    | TypeParameter

interface PackageDeclaration {
    path: string[]
}

interface ImportDeclaration {
    path: @Entity[]
    alias?: string
}

interface ClassDeclaration {
    name: string
    typeParams: TypeParameter[]
    superTypes: NamedType[]
    members: ClassMemberDeclaration[]
}

interface TypeParameter {
    name: string
}

type ClassMemberDeclaration = FieldDeclaration
    | ConstructorDeclaration
    | FunctionDeclaration
    | OperatorFunctionDeclaration

interface FieldDeclaration {
    variance: 'static' | 'var' | 'val'
    name: string
    type?: Type
    initializer?: Expression
}

type CallableDeclaration = FunctionDeclaration
    | ExpandFunctionDeclaration
    | ConstructorDeclaration

interface ConstructorDeclaration {
    params: ValueParameter[]
    body: Statement[]
}

interface FunctionDeclaration {
    variance?: 'static' | 'global' | 'lambda'
    name: string
    params: ValueParameter[]
    retType?: Type
    body: Statement[]
}

interface ExpandFunctionDeclaration {
    type: Type
    name: string
    params: ValueParameter[]
    retType?: Type
    body: Statement[]
}

interface OperatorFunctionDeclaration {
    operator: string
    params: ValueParameter[]
    retType?: Type
}

interface ValueParameter {
    varargs?: boolean
    name: string
    type?: Type
    defaultValue?: Expression
}

interface ExpandDeclaration {
    type: Type
    members: ExpandMemberDeclaration[]
}

type ExpandMemberDeclaration = FunctionDeclaration | OperatorFunctionDeclaration | FieldDeclaration
//endregion Declaration

//region Statement
// interface Statement {}
type Statement = IfStatement
    | WhileStatement
    | ForStatement
    | BlockStatement
    | ReturnStatement
    | VariableDeclaration
    | ExpressionStatement
    | BreakStatement
    | ContinueStatement

interface IfStatement {
    cond: Expression
    thenBody: Statement
    elseBody?: Statement
}

interface WhileStatement {
    cond: Expression
    body: Statement
}

interface ForStatement {
    params: LoopParameter[]
    range: Expression
    body: Statement
}

interface LoopParameter {
    name: string
}

interface BlockStatement {
    body: Statement[]
}

interface ReturnStatement {
    expr?: Expression
}

interface ExpressionStatement {
    expr: Expression
}

interface BreakStatement {
}

interface ContinueStatement {
}

interface VariableDeclaration {
    variance: 'global' | 'static' | 'var' | 'val'
    name: string
    type?: Type
    initializer?: Expression
}
//endregion Statement

//region Expression
type Expression = Assignment
    | ConditionalExpression
    | InfixExpression
    | PrefixExpression
    | PostfixExpression
    | LiteralExpression
    | DefaultExpression

interface Assignment {
    left: Expression
    operator: '=' | '+=' | '-=' | '~=' | '*=' | '/=' | '%=' | '|=' | '&=' | '^='
    right: Expression
}

interface ConditionalExpression {
    cond: Expression
    thenBody: Expression
    elseBody: Expression
}

interface InfixExpression {
    left: Expression
    operator: '*' | '/' | '%' | '+' | '-' | '~' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'has' | '&' | '|' | '^' | '&&' | '||'
    right: Expression
}

interface PrefixExpression {
    operator: '!' | '-'
    expr: Expression
}

type PostfixExpression = MemberAccess
    | IntRangeExpression
    | TypeCastExpression
    | IndexExpression
    | CallExpression
    | InstanceofExpression

interface MemberAccess {
    receiver: Expression
    entity: @Entity
}

interface IntRangeExpression {
    from: Expression
    operator: '..' | 'to'
    to: Expression
}

interface TypeCastExpression {
    expr: Expression
    type: Type
}

interface IndexExpression {
    receiver: Expression
    index: Expression
}

interface CallExpression {
    receiver: Expression
    args: Expression[]
}

interface InstanceofExpression {
    expr: Expression
    type: NamedType
}

interface ParenthesizedExpression {
    expr: Expression
}

type LiteralExpression = StringLiteral
    | NumberLiteral
    | BooleanLiteral
    | NullLiteral
    | ArrayLiteral
    | MapLiteral

interface FunctionExpression {
    body: Statement[]
    params: ValueParameter[]
    retType?: Type
}

interface BracketProperty {
    key: UnquotedString
    value: UnquotedString | IntegerLiteral | BooleanLiteral
}

interface BracketExpression {
    path: (BracketLocation | ExpressionTemplate)[]
    properties?: BracketProperty[]
}

interface BracketLocation {
    value: string | ExpressionTemplate
}

interface ExpressionTemplate {
    expr: Expression
}

interface ReferenceExpression {
    entity: @Entity
}

type NumberLiteral = IntegerLiteral
    | FloatLiteral

interface IntegerLiteral {
    value: string
}

interface FloatLiteral {
    value: string
}

interface BooleanLiteral {
    value: boolean
}

interface StringLiteral {
    value: string
}

interface UnquotedString {
    value: string
}

interface NullLiteral {
    value: 'null'
}

interface StringTemplate {
    content: (string | Expression)[]
}

interface ArrayLiteral {
    values: Expression[]
}

interface MapLiteral {
    entries: MapEntry[]
}

interface MapEntry {
    key: Expression
    value: Expression
}

interface DefaultExpression {
    value: 'default'
}
//endregion Expression

//region Type
type Type = NamedType 
    | ArrayType 
    | ListType
    | MapType
    | FunctionType
    | ParenthesizedType
    | CompoundType

interface NamedType {
    path: @Entity[]
    typeArgs: NamedType[]
}

interface ArrayType {
    value: Type
}

interface ListType {
    value: Type
}

interface MapType {
    key: Type
    value: Type
    orderly?: boolean
}

interface FunctionType {
    params: Type[]
    retType: Type
}

interface ParenthesizedType {
    value: Type
}

interface CompoundType {
    values: Type[]
}
//endregion Type

hidden terminal WHITE_SPACE: /\s+/;
terminal IDENTIFIER: /[_a-zA-Z][\w_]*/;
terminal FLOAT: /[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?[fFdD]?/;
terminal INTEGER: /(0[xX][0-9a-fA-F]+|[0-9]+)[lL]?/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal BLOCK_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal LINE_COMMENT: /\/\/[^\n\r]*/;
hidden terminal PREPROCESSOR: /#[^\n\r]*/;
