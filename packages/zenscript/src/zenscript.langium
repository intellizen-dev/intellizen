grammar ZenScript

entry Script:
    package=PackageDeclaration?
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=(ExpandDeclaration | ExpandFunctionDeclaration)
    | classes+=ClassDeclaration
    | statements+=Statement
    )*
;

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

type NamedElement = Script | ClassDeclaration | FunctionDeclaration | ExpandFunctionDeclaration | FieldDeclaration | ValueParameter| VariableDeclaration | LoopParameter | MapEntry | ImportDeclaration;

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

PackageDeclaration returns PackageDeclaration:
    'package' (path+=ID '.')* path+=ID ';'
;

ImportDeclaration returns ImportDeclaration:
    'import' (path+=[NamedElement:ID] '.')* path+=[NamedElement:ID] ('as' alias=ID)? ';'?
;

ClassDeclaration returns ClassDeclaration:
    'zenClass' name=ID ('<' typeParameters+=TypeParameter (',' typeParameters+=TypeParameter)* '>')?
    ('extends' (superTypes+=NamedType (',' superTypes+=NamedType)*))?
    ('{'
        members+=ClassMemberDeclaration*
    '}')?
;

ClassMemberDeclaration returns ClassMemberDeclaration:
    FunctionDeclaration | FieldDeclaration | ConstructorDeclaration | OperatorFunctionDeclaration;

FieldDeclaration returns FieldDeclaration:
    prefix=('static'|'var'|'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=Expression)? ';'
;

ValueParameter returns ValueParameter:
    (varargs?='...')? name=ID ('as' typeRef=TypeReference)? ('=' defaultValue=('default' | Expression))?
;

TypeParameter returns TypeParameter:
    name=ID
;

FunctionDeclaration returns FunctionDeclaration:
    prefix=('static' | 'global' | 'lambda')? 'function' name=ID? '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? ('{'
        (body+=Statement)*
    '}')? ';'?
;

ExpandFunctionDeclaration returns ExpandFunctionDeclaration:
    '$expand' typeRef=TypeReference '$' name=ID  '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

OperatorFunctionDeclaration returns OperatorFunctionDeclaration:
    'operator' op=Operator '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=CompoundType)? ';'?
;

Operator returns string
    : '+' | '-' | '*' | '/' | '%' | '~' | '|' | '&' | '^'
    | '+=' | '-=' | '*=' | '/=' | '%=' | '~=' | '|=' | '&=' | '^='
    | '!' | '['']' | '['']''=' | '..' | 'has' | '.' | '.''=' | 'for' | 'as' | '==' | '!=' | '<' | '<=' | '>' | '>='
;

ConstructorDeclaration returns ConstructorDeclaration:
    'zenConstructor' '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('{'
        (body+=Statement)*
    '}')? ';'?
;

ExpandDeclaration:
    'expand' typeRef=TypeReference '{' 
        members+=ExpandMemberDeclaration*
    '}'
;

ExpandMemberDeclaration returns ExpandMemberDeclaration:
    FieldDeclaration | FunctionDeclaration | OperatorFunctionDeclaration
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
    parameters: LoopParameter[];
    range: Expression;
    body: Statement[];
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
    'for' parameters+=LoopParameter (',' parameters+=LoopParameter)* 'in' range=Expression '{'
        (body+=Statement)*
    '}'
;

LoopParameter returns LoopParameter:
    name=ID
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

interface BracketExpression extends Expression {
    path: BracketPath[];
    properties?: Property[];
}

interface BracketPath {
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
    typeRef: TypeReference;
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

//region Expression

Expression returns Expression:
    Assignment
;

Assignment returns Expression:
    ConditionalExpression ({Assignment.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)?
;

ConditionalExpression returns Expression:
    OrOrExpression ({ConditionalExpression.first=current} '?' second=ConditionalExpression ':' third=ConditionalExpression)?
;

OrOrExpression returns Expression:
    AndAndExpression ({InfixExpression.left=current} op='||' right=AndAndExpression)*
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
    RelationalExpression ({InfixExpression.left=current} op='&' right=RelationalExpression)*
;

RelationalExpression returns Expression:
    AdditiveExpression ({InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AdditiveExpression)*
;

AdditiveExpression returns Expression:
    MultiplicativeExpression ({InfixExpression.left=current} op=('+'|'-'|'~') right=MultiplicativeExpression)*
;

MultiplicativeExpression returns Expression:
    PrefixExpression ({InfixExpression.left=current} op=('*'|'/'|'%') right=PrefixExpression)*
;

PrefixExpression returns Expression:
    ({PrefixExpression} op=('!'|'-') expr=PrefixExpression) | PostfixExpression
;

MemberAccessName returns string:
    ID | STRING
;

PostfixExpression returns Expression:
    PrimaryExpression (
        ({MemberAccess.receiver=current} '.' target=[NamedElement:MemberAccessName] ) |
        ({InfixExpression.left=current} op=('to'|'..') right=Expression) |
        ({TypeCastExpression.expr=current} 'as' typeRef=TypeReference) |
        ({IndexingExpression.receiver=current} '[' argument=Expression ']') |
        ({CallExpression.receiver=current} '(' (arguments+=Expression (',' arguments+=Expression)* ','?)? ')') |
        ({InstanceofExpression.expr=current} 'instanceof' typeRef=TypeReference)
    )*
;

fragment PrimaryExpression returns Expression:
    ParenthesizedExpression | FunctionExpression | ReferenceExpression | LiteralExpression | BracketExpression
;

ParenthesizedExpression returns ParenthesizedExpression:
    '(' expr=Expression ')'
;

LiteralExpression returns LiteralExpression:
    StringLiteral | StringTemplate | NumberLiteral | BooleanLiteral | ArrayLiteral | MapLiteral | NullLiteral
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
    key=(UnquotedString | Expression) ':' value=Expression
;

ReferenceExpression returns ReferenceExpression:
    target=[NamedElement:ID]
;

NumberLiteral returns NumberLiteral:
    IntegerLiteral | FloatingLiteral
;

IntegerLiteral returns IntegerLiteral:
    value=INTEGER
;

FloatingLiteral returns FloatingLiteral:
    value=FLOATING
;

BooleanLiteral returns BooleanLiteral:
    value?='true' | 'false'
;

StringLiteral returns StringLiteral:
    value=STRING
;

UnquotedString returns UnquotedString:
    value=ID
;

NullLiteral returns NullLiteral:
    value='null'
;

StringTemplate returns StringTemplate:
    // Either just the full content
    content+=TEMPLATE_LITERAL_FULL |
    // Or template literal parts with expressions in between
    (
        content+=TEMPLATE_LITERAL_START 
        content+=Expression?
        (
            content+=TEMPLATE_LITERAL_MIDDLE
            content+=Expression?
        )*
        content+=TEMPLATE_LITERAL_END
    )
;

terminal TEMPLATE_LITERAL_FULL:
    '`' IN_TEMPLATE_LITERAL* '`';

terminal TEMPLATE_LITERAL_START:
    '`' IN_TEMPLATE_LITERAL* '${';

terminal TEMPLATE_LITERAL_MIDDLE:
    '}' IN_TEMPLATE_LITERAL* '${';

terminal TEMPLATE_LITERAL_END:
    '}' IN_TEMPLATE_LITERAL* '`';

terminal fragment IN_TEMPLATE_LITERAL:
    /[^$`\\]|\\./;

BracketExpression returns BracketExpression:
    '<' path+=BracketPath (':' path+=BracketPath)*
        (':' properties+=Property (',' properties+=Property)*)?
    '>'
;

BracketPath returns BracketPath:
    value=Location | ExpressionTemplate
;

Location returns string:
    (ID | INTEGER | '.' | '-' | '*')+
;

ExpressionTemplate returns ExpressionTemplate:
    '${' expr=Expression '}'
;

Property:
    key=UnquotedString '=' value=(UnquotedString | IntegerLiteral | BooleanLiteral)
;

//endregion Expression


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
    orderly?: 'orderly'
}

interface MapTypeReference extends TypeReference {
    key: TypeReference;
    value: TypeReference;
    orderly?: 'orderly'
}

//endregion

//region TypeReference

TypeReference returns TypeReference:
    UnionType
;

UnionType returns TypeReference:
    IntersectionType ({UnionTypeReference.values+=current} ('|' values+=IntersectionType)+)?
;

IntersectionType returns TypeReference:
    ComplexType ({IntersectionTypeReference.values+=current} ('&' values+=ComplexType)+)?
;

CompoundType returns TypeReference:
    ComplexType ({CompoundTypeReference.values+=current} (',' values+=ComplexType)+)?
;

ComplexType returns TypeReference:
    PrimaryType ('['(
        ({MapTypeReference.value=current} key=TypeReference) |
        ({ArrayTypeReference.value=current})
    )']' ('$' orderly='orderly')? )*
;

fragment PrimaryType returns TypeReference:
    ListType | FunctionType | ParenthesizedType | NamedType
;

ParenthesizedType returns ParenthesizedTypeReference:
    '(' value=TypeReference ')'
;

ListType returns ListTypeReference:
    '[' value=TypeReference ']'
;

FunctionType returns FunctionTypeReference:
    'function' '('
        (params+=TypeReference (',' params+=TypeReference)*)?
    ')' returnType=TypeReference
;

NamedType returns NamedTypeReference:
    (path+=[NamedElement:ID] '.')* path+=[NamedElement:ID] ('<' typeArguments+=NamedType (',' typeArguments+=NamedType)* '>')?
;

//endregion TypeReference


// Soft keywords
ID returns string
    : IDENTIFIER
    | 'to'
    | 'extends'  // dzs
    | 'operator' // dzs
    | 'default'  // dzs
    | 'lambda'   // dzs
    | 'expand'   // dzs
    | 'orderly'  // zenutils
;

hidden terminal WHITE_SPACE: /\s+/;
terminal IDENTIFIER: /[_a-zA-Z][\w_]*/;
terminal FLOATING: /[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?[fFdD]?/;
terminal INTEGER: /(0[xX][0-9a-fA-F]+|[0-9]+)[lL]?/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal BLOCK_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal LINE_COMMENT: /\/\/[^\n\r]*/;
hidden terminal PREPROCESSOR: /#[^\n\r]*/;
