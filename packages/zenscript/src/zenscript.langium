grammar IntelliZen

entry Script:
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=ExpandFunctionDeclaration
    | classes+=ClassDeclaration
    | statements+=Statement
    )*
;

Person:
    'person' name=ID;

Greeting:
    'Hello' person=[Person:ID] '!';


interface ImportDeclaration {
    parts: string[];
    alias?: string;
}

interface ClassDeclaration {
    name: string;
    superTypes: @ClassDeclaration[];
    members: ClassMemberDeclaration[];
}


type ClassMemberDeclaration = FunctionDeclaration | FieldDeclaration | ConstructorDeclaration;

interface FieldDeclaration {
    prefix: 'static' | 'var' | 'val';
    name: string;
    typeRef?: TypeReference;
    initializer?: Expression;
}

interface ValueParameter {
    varargs?: boolean;
    name: string;
    typeRef?: TypeReference;
    defaultValue?: Expression;
}

interface FunctionDeclaration {
    prefix: 'static' | 'global';
    name: string;
    parameters: ValueParameter[];
    returnTypeRef?: TypeReference;
    body: Statement[];
}

interface ExpandFunctionDeclaration {
    typeRef: TypeReference;
    name: string;
    parameters: ValueParameter[];
    returnTypeRef?: TypeReference;
    body: Statement[];
}

interface ConstructorDeclaration {
    parameters: ValueParameter[];
    body: Statement[];
}


ImportDeclaration returns ImportDeclaration:
    'import' parts+=ID ('.' parts+=ID)* ('as' alias=ID)? ';'?
;

ClassDeclaration returns ClassDeclaration:
    'zenClass' name=ID
    ('extends' (superTypes+=[ClassDeclaration:ID] (',' superTypes+=[ClassDeclaration:ID])*))?
    ('{'
        members+=ClassMemberDeclaration*
    '}')?
;

ClassMemberDeclaration returns ClassMemberDeclaration: 
    FunctionDeclaration | FieldDeclaration | ConstructorDeclaration;

FieldDeclaration returns FieldDeclaration:
    prefix=('static'|'var'|'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=Expression)? ';'
;


ValueParameter returns ValueParameter:
    (varargs?='...')? name=ID ('as' typeRef=TypeReference)? ('=' defaultValue=Expression)?
;

FunctionDeclaration returns FunctionDeclaration:
    prefix=('static' | 'global')? 'function' name=ID '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

ExpandFunctionDeclaration returns ExpandFunctionDeclaration:
    '$expand' typeRef=TypeReference '$' name=ID  '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

ConstructorDeclaration returns ConstructorDeclaration:
    'zenConstructor' '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' '{'
        (body+=Statement)*
    '}'
;

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
    variables: string[];
    iter: Expression;
    body: Statement[];
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

interface VariableDeclaration extends Statement {
    prefix: 'global' | 'static' | 'var' | 'val';
    name: string;
    typeRef?: TypeReference;
    initializer?: Expression;
}

//endregion Statement Interface

//region Statement
Statement returns Statement:
      IfStatement
    | WhileStatement
    | ForStatement
    | BlockStatement
    | ReturnStatement
    | VariableDeclaration
    | ExpressionStatement
    | BreakStatement
    | ContinueStatement
;

VariableDeclaration returns VariableDeclaration:
    prefix=('global'|'static'|'var'|'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=Expression)? ';'
;

IfStatement returns IfStatement:
    'if' condition=Expression ifBody=Statement ('else' elseBody=Statement)?
;

WhileStatement returns WhileStatement:
    'while' condition=Expression body=Statement
;

ForStatement returns ForStatement:
    'for' variables+=ID (',' variables+=ID)* 'in' iter=Expression '{'
        (body+=Statement)*
    '}'
;

BlockStatement returns BlockStatement:
    '{' (body+=Statement)* '}'
;

ReturnStatement returns ReturnStatement:
    'return' expr=Expression? ';'
;

ExpressionStatement returns ExpressionStatement:
    expr=Expression ';'
;

BreakStatement returns BreakStatement:
    {BreakStatement} 'break' ';'
;

ContinueStatement returns ContinueStatement:
    {ContinueStatement} 'continue' ';'
;
//endregion Statement


//region Expression Interface
interface Expression {}

interface PrefixExpression extends Expression {
    expr: Expression;
    op: '!' | '-';
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


type LiteralsExpression = PrimitiveLiterals | ArrayLiteral | MapLiteral;
type PrimitiveLiterals = NumberLiteral | BooleanLiteral | StringLiteral | StringTemplate;


interface TernaryExpression extends Expression {
    first: Expression;
    second: Expression;
    third: Expression;
}

interface FunctionExpression extends Expression {
    body: Statement[];
    parameters: ValueParameter[];
    returnTypeRef?: TypeReference;
}


interface BracketExpression extends Expression {
    value: string;
}

interface ParenthesizedExpression extends Expression {
    expr: Expression;
}

interface MemberAccess extends Expression {
    receiver: Expression;
    name: string;
}

interface TypeCastExpression extends Expression {
    expr: Expression;
    typeRef: TypeReference;
}

interface ArrayAccess extends Expression {
    array: Expression;
    index: Expression;
}

interface CallExpression extends Expression {
    receiver: Expression;
    arguments: Expression[];
}

interface InstanceofExpression extends Expression {
    expr: Expression;
    typeRef: TypeReference;
}


interface LocalVariable extends Expression {
    name: string;
}

interface NumberLiteral extends Expression {
    value: number;
}

interface BooleanLiteral extends Expression {
    value: boolean;
}

interface StringLiteral extends Expression {
    value: string;
}

interface StringTemplate extends Expression {
    content: (string | ContentExpression)[];
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

//region Expression

Expression returns Expression:
    Assignment
;

Assignment returns Expression:
    ConditionExpression ({Assignment.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)*
;

ConditionExpression returns Expression:
    OrOrExpression ({TernaryExpression.first=current} '?' second=OrOrExpression ':' third=OrOrExpression)*
;

OrOrExpression returns Expression:
    AndAndExpression ({InfixExpression.left=current} op='|' right=AndAndExpression)*
;

AndAndExpression returns Expression:
    OrExpression ({InfixExpression.left=current} op='&&' right=OrExpression)*
;

OrExpression returns Expression:
    XorExpression ({InfixExpression.left=current} op='|' right=XorExpression)*
;

XorExpression returns Expression:
    AndExpression ({InfixExpression.left=current} op='^' right=AndExpression)*
;

AndExpression returns Expression:
    CompareExpression ({InfixExpression.left=current} op='&' right=CompareExpression)*
;

CompareExpression returns Expression:
    AddExpression ({InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AddExpression)*
;

AddExpression returns Expression:
    MulExpression ({InfixExpression.left=current} op=('+'|'-'|'~') right=MulExpression)*
;

MulExpression returns Expression:
    PrefixExpression ({InfixExpression.left=current} op=('*'|'/'|'%') right=PrefixExpression)*
;

PrefixExpression returns Expression:
    ({PrefixExpression} op=('!'|'-') expr=PostfixExpression) |
    PostfixExpression
;

PostfixExpression returns Expression:
    PrimaryExpression (
        ({MemberAccess.receiver=current} '.' name=(ID | STRING)) |
        ({InfixExpression.left=current} op=('in'|'..') right=Expression) |
        ({TypeCastExpression.expr=current} 'as' typeRef=TypeReference) |
        ({ArrayAccess.array=current} '[' index=Expression ']') |
        ({CallExpression.receiver=current} '(' (arguments+=Expression (',' arguments+=Expression)* ','?)? ')') |
        ({InstanceofExpression.expr=current} 'instanceof' typeRef=TypeReference)
    )?
;

PrimaryExpression returns Expression
    : ParenthesizedExpression | FunctionExpression | LocalVariable | LiteralsExpression | BracketExpression
;

BracketExpression returns BracketExpression:
   '<' value=(ID | ':')+ '>'
;

ParenthesizedExpression returns ParenthesizedExpression:
    '(' expr=Expression ')'
;

LiteralsExpression returns LiteralsExpression:
    StringLiteral | StringTemplate | NumberLiteral | BooleanLiteral | ArrayLiteral | MapLiteral
;

FunctionExpression returns FunctionExpression:
    'function' '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;


ArrayLiteral returns ArrayLiteral:
    '[' (values+=Expression (',' values+=Expression)* ','?)? ']'
;


MapLiteral returns MapLiteral:
    '{' (entries+=MapEntry (',' entries+=MapEntry)* ','?)? '}'
;

MapEntry returns MapEntry:
    key=Expression ':' value=Expression
;

LocalVariable returns LocalVariable:
    name=ID
;

NumberLiteral returns NumberLiteral:
    value=INT
;

BooleanLiteral returns BooleanLiteral:
  value?='true' | 'false'
;

StringLiteral returns StringLiteral:
    value=STRING
;

StringTemplate returns StringTemplate:
    '`' content+=(ContentText | ContentExpression)* '`'
;

terminal ContentText:
    /\\.*/
;

ContentExpression:
    '${' expr=Expression '}'
;

//endregion Expression


//region TypeReference Types

interface TypeReference {}

interface UnionType extends TypeReference {
    typeRefs: TypeReference[];
}

interface IntersectionType extends TypeReference {
    typeRefs: TypeReference[];
}


interface PrimitiveType extends TypeReference {
    primitive: 'any' | 'byte' | 'short' | 'int' | 'long' | 'float' | 'double' | 'bool' | 'void' | 'string';
}

interface ListType extends TypeReference {
    baseTypeRef: TypeReference;
}

interface FunctionType extends TypeReference {
    paramTypeRefs: TypeReference[];
    returnTypeRef: TypeReference;
}

interface ReferenceType extends TypeReference {
    names: string[];
}

interface ParenthesizedType extends TypeReference {
    typeRef: TypeReference;
}

interface ArrayType extends TypeReference {
    valueTypeRef: TypeReference;
}

interface MapType extends TypeReference {
    valueTypeRef: TypeReference;
    keyTypeRef: TypeReference;
}

//endregion

//region TypeReference

TypeReference returns TypeReference:
    UnionType
;

UnionType returns TypeReference:
    IntersectionType ({UnionType.typeRefs+=current} ('|' typeRefs+=IntersectionType)+)?
;

IntersectionType returns TypeReference:
    ComplexType ({IntersectionType.typeRefs+=current} ('&' typeRefs+=ComplexType)+)?
;

ComplexType returns TypeReference:
    PrimaryType ('['(
        ({MapType.valueTypeRef=current} keyTypeRef=TypeReference) |
        ({ArrayType.valueTypeRef=current})
    )']')*
;

PrimaryType returns TypeReference:
    PrimitiveType | ListType | FunctionType | ParenthesizedType | ReferenceType
;

ParenthesizedType returns ParenthesizedType:
    '(' typeRef=TypeReference ')'
;

PrimitiveType returns PrimitiveType:
    primitive=('any'| 'byte'| 'short'| 'int'| 'long'| 'float'| 'double'| 'bool'| 'void'| 'string')
;

ListType returns ListType:
    '[' baseTypeRef=TypeReference ']'
;

FunctionType returns FunctionType:
    'function' '('
        (paramTypeRefs+=TypeReference (',' paramTypeRefs+=TypeReference)*)?
    ')' returnTypeRef=TypeReference
;

ReferenceType returns ReferenceType:
    names+=ID ('.' names+=ID)*
;

//endregion TypeReference


// Soft keywords
ID returns string
    : IDENTIFIER
    | 'in'
    | 'extends'  // dzs
    | 'operator' // dzs
    | 'for_in'   // dzs
    | 'orderly'  // zenutils
;

hidden terminal WS: /\s+/;
terminal IDENTIFIER: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal BLOCK_COMMENT: /\/\*.*?\*\//;
hidden terminal LINE_COMMENT: /\/\/[^\n\r]*/;
hidden terminal PREPROCESSOR: /#[^\n\r]*/;
