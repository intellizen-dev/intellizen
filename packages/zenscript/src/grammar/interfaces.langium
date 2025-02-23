interface Script {
    package?: PackageDeclaration;
    imports: ImportDeclaration[];
    functions: FunctionDeclaration[];
    classes: ClassDeclaration[];
    expands: (ExpandDeclaration | ExpandFunctionDeclaration)[];
    statements: Statement[];
}

interface Declaration {}

interface PackageDeclaration extends Declaration {
    path: string[];
}

interface ImportDeclaration extends Declaration {
    path: @NamedElement[];
    alias?: string;
}

interface ClassDeclaration extends Declaration {
    name: string;
    typeParameters: TypeParameter[]
    superTypes: NamedTypeReference[];
    members: ClassMemberDeclaration[];
}

type NamedElement = Script | ClassDeclaration | FunctionDeclaration | ExpandFunctionDeclaration | FieldDeclaration | ValueParameter| VariableDeclaration | LoopParameter | MapEntry | ImportDeclaration | ConstructorDeclaration;

type ClassMemberDeclaration = FunctionDeclaration | FieldDeclaration | ConstructorDeclaration | OperatorFunctionDeclaration;

type CallableDeclaration = FunctionDeclaration | ExpandFunctionDeclaration | ConstructorDeclaration;

type ExpandMemberDeclaration = FunctionDeclaration | OperatorFunctionDeclaration | FieldDeclaration;

interface FieldDeclaration extends Declaration {
    prefix: 'static' | 'var' | 'val';
    name: string;
    typeRef?: TypeReference;
    initializer?: Expression;
}

interface ValueParameter extends Declaration {
    varargs?: boolean;
    name: string;
    typeRef?: TypeReference;
    defaultValue?: 'default' | Expression;
}

interface TypeParameter extends Declaration {
    name: string;
}

interface FunctionDeclaration extends Declaration {
    prefix?: 'static' | 'global' | 'lambda';
    name: string;
    parameters: ValueParameter[];
    returnTypeRef?: TypeReference;
    body: Statement[];
}

interface ExpandDeclaration extends Declaration {
    typeRef: TypeReference;
    members: ExpandMemberDeclaration[];
}

interface ExpandFunctionDeclaration extends Declaration {
    typeRef: TypeReference;
    name: string;
    parameters: ValueParameter[];
    returnTypeRef?: TypeReference;
    body: Statement[];
}

interface OperatorFunctionDeclaration extends Declaration {
    op: string
    parameters: ValueParameter[];
    returnTypeRef?: TypeReference;
}

interface ConstructorDeclaration extends Declaration {
    parameters: ValueParameter[];
    body: Statement[];
}


//region Statement Interface

interface Statement {}

interface IfStatement extends Statement {
    condition: Expression;
    ifBody: Statement;
    elseBody?: Statement;
}

interface WhileStatement extends Statement {
    condition: Expression;
    body: Statement;
}

interface ForStatement extends Statement {
    parameters: LoopParameter[];
    range: Expression;
    body: Statement;
}

interface LoopParameter extends Declaration {
    name: string;
}

interface BlockStatement extends Statement {
    body: Statement[];
}

interface ReturnStatement extends Statement {
    expr?: Expression;
}

interface ExpressionStatement extends Statement {
    expr: Expression;
}

interface BreakStatement extends Statement {}

interface ContinueStatement extends Statement {}

interface VariableDeclaration extends Declaration, Statement {
    prefix: 'global' | 'static' | 'var' | 'val';
    name: string;
    typeRef?: TypeReference;
    initializer?: Expression;
}

//endregion Statement Interface


//region Expression Interface
interface Expression {}

interface PrefixExpression extends Expression {
    op: '!' | '-';
    expr: Expression;
}

interface InfixExpression extends Expression {
    left: Expression;
    op: '!=' | '%' | '&&' | '&' | '*' | '+' | '-' | '/' | '<' | '<=' | '==' | '>' | '>=' | '^' | 'has' | 'in' | '|' | '||' | '~' | '..' | 'to';
    right: Expression;
}

interface Assignment extends Expression {
    left: Expression;
    op: '=' | '+=' | '-=' | '~=' | '*=' | '/=' | '%=' | '|=' | '&=' | '^=';
    right: Expression;
}

type LiteralExpression = StringLiteral | StringTemplate | NumberLiteral | BooleanLiteral | NullLiteral | ArrayLiteral | MapLiteral;

interface ConditionalExpression extends Expression {
    first: Expression;
    second: Expression;
    third: Expression;
}

interface FunctionExpression extends Expression {
    body: Statement[];
    parameters: ValueParameter[];
    returnTypeRef?: TypeReference;
}

interface BracketProperty {
    key: UnquotedString
    value: UnquotedString | IntegerLiteral | BooleanLiteral
}

interface BracketExpression extends Expression {
    path: (BracketLocation | ExpressionTemplate)[];
    properties?: BracketProperty[];
}

interface BracketLocation {
    value: string | ExpressionTemplate;
}

interface ExpressionTemplate {
    expr: Expression;
}

interface ParenthesizedExpression extends Expression {
    expr: Expression;
}

interface MemberAccess extends Expression {
    receiver: Expression;
    target: @NamedElement;
}

interface TypeCastExpression extends Expression {
    expr: Expression;
    typeRef: TypeReference;
}

interface IndexingExpression extends Expression {
    receiver: Expression;
    argument: Expression;
}

interface CallExpression extends Expression {
    receiver: Expression;
    arguments: Expression[];
}

interface InstanceofExpression extends Expression {
    expr: Expression;
    typeRef: NamedTypeReference;
}

interface ReferenceExpression extends Expression {
    target: @NamedElement;
}

interface NumberLiteral extends Expression {
    value: string;
}

interface IntegerLiteral extends NumberLiteral {}

interface FloatingLiteral extends NumberLiteral {}

interface BooleanLiteral extends Expression {
    value: boolean;
}

interface StringLiteral extends Expression {
    value: string;
}

interface UnquotedString extends Expression {
    value: string;
}

interface NullLiteral extends Expression {
    value: 'null';
}

interface StringTemplate extends Expression {
    content: (string | Expression)[];
}

interface ArrayLiteral extends Expression {
    values: Expression[];
}

interface MapLiteral extends Expression {
    entries: MapEntry[];
}

interface MapEntry {
    key: Expression;
    value: Expression;
}

//endregion Expression Interface


//region TypeReference Types

interface TypeReference {}

interface UnionTypeReference extends TypeReference {
    values: TypeReference[];
}

interface IntersectionTypeReference extends TypeReference {
    values: TypeReference[];
}

interface CompoundTypeReference extends TypeReference {
    values: TypeReference[];
}

interface ListTypeReference extends TypeReference {
    value: TypeReference;
}

interface FunctionTypeReference extends TypeReference {
    params: TypeReference[];
    returnType: TypeReference;
}

interface NamedTypeReference extends TypeReference {
    path: @NamedElement[];
    typeArguments: NamedTypeReference[];
}

interface ParenthesizedTypeReference extends TypeReference {
    value: TypeReference;
}

interface ArrayTypeReference extends TypeReference {
    value: TypeReference;
}

interface MapTypeReference extends TypeReference {
    key: TypeReference;
    value: TypeReference;
    orderly: boolean;
}

//endregion TypeReference Types