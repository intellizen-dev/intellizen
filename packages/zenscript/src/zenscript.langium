grammar IntelliZen

entry Script:
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration<true>
    | expands+=ExpandFunctionDeclaration
    | classes+=ClassDeclaration
    | statements+=RootStatement
    )*
;

Person:
    'person' name=ID;

Greeting:
    'Hello' person=[Person:ID] '!';

ImportDeclaration:
    'import' parts+=ID ('.' parts+=ID)* ('as' alias=ID)? ';'?
;

ClassDeclaration: 
    'zenClass' name=ID 
    ('extends' (superTypes+=[ClassDeclaration:ID] (',' superTypes+=[ClassDeclaration:ID])*))? 
    ('{'
        members+=ClassMemberDeclaration*
    '}')?
;

ClassMemberDeclaration: FunctionDeclaration<false> | VariableDeclaration<false, true> | ConstructorDeclaration;

VariableDeclarator<isRoot, isField>: 
    {infer Declarator}
    (<isRoot> 'global') |
    (<isRoot | isField> 'static') |
    'var' | 'val'
;


VariableDeclaration<isRoot, isField>:
    prefix=VariableDeclarator<isRoot, isField>
    name=ID ('as' typeRef=TypeReference)?
    ('=' initializer=Expression)? ';'
;


ValueParameter:
    (varargs?='...')? name=ID ('as' typeRef=TypeReference)? ('=' defaultValue=Expression)?
;

fragment Parameters:
 '(' (parameters+=ValueParameter (',' parameters+=ValueParameter)*)? ')'
;

fragment FuncReturnType:
('as' returnTypeRef=TypeReference)? 
;

FunctionDeclaration<isRoot>:
    (<isRoot> prefix?=('static' | 'global')?) 'function' name=ID Parameters
    FuncReturnType '{'
        (body+=Statement)*
    '}'
;

ExpandFunctionDeclaration:
    '$expand' typeRef=TypeReference '$' name=ID Parameters
    FuncReturnType '{'
        (body+=Statement)*
    '}'
;

ConstructorDeclaration:
    'zenConstructor' Parameters
    ('{'
        (body+=Statement)*
    '}')?
;


//region TypeReference
TypeReference:
    UnionType
;

UnionType:
    IntersectionType ({infer UnionType.typeRefs+=current} ('|' typeRefs+=IntersectionType)+)?
;

IntersectionType:
    MapArrayType ({infer IntersectionType.typeRefs+=current} ('&' typeRefs+=MapArrayType)+)?
;

PrimitiveType:
    primitive=('any'| 'byte'| 'short'| 'int'| 'long'| 'float'| 'double'| 'bool'| 'void'| 'string')
;

ListType:
    '[' baseTypeRef=TypeReference ']'
;

MapArrayType:
    PrimaryTypeReference (
        '['
        (
            ({infer MapType.valueType=current} keyType=TypeReference) |
            ({infer ArrayType.valueType=current})
        )
        ']'
    )?
;

FunctionType:
    'function' '(' 
        (paramTypeRef+=TypeReference (',' paramTypeRef+=TypeReference)*)? 
    ')' returnTypeRef=TypeReference
;

ParenthesizedType:
    '(' typeRef=TypeReference ')'
;

PrimaryTypeReference:
    PrimitiveType | ListType | FunctionType | ParenthesizedType | ReferenceType
;

ReferenceType:
    refName=ID ( {infer ReferenceType.parent=current} '.' refName=ID)*
;

//endregion TypeReference


//region Statement

RootStatement:
    StatementImpl<true>
;

Statement:
    StatementImpl<false>
;


StatementImpl<isRoot>
    : IfStatement 
    | WhileStatement 
    | ForStatement 
    | BlockStatement 
    | ReturnStatement 
    | VariableDeclaration<isRoot, false>
    | ExpressionStatement 
    | BreakStatement 
    | ContinueStatement
;

IfStatement:
    'if' condition=Expression ifBody=Statement ('else' elseBody=Statement)
;

WhileStatement:
    'while' condition=Expression body=Statement
;

ForStatement:
    'for' variables+=ID (',' variables+=ID)* 'in' iter=Expression '{' 
        (body+=Statement)* 
    '}'
;

BlockStatement: 
    '{' (body+=Statement)* '}'
;

ReturnStatement: 
    'return' expr=Expression? ';'
;

ExpressionStatement: 
    expr=Expression ';'
;

BreakStatement: 
    {infer BreakStatement} 'break' ';'
;

ContinueStatement: 
    {infer ContinueStatement} 'continue' ';'
;
//endregion Statement


//region Expression
Expression:
    {infer Expression} Assignment
;

Assignment:
    ConditionExpression ({infer Assignment.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)*
;

ConditionExpression:
    OrOrExpression ({infer TernaryExpression.first=current} '?' second=OrOrExpression ':' third=OrOrExpression)*
;

OrOrExpression:
    AndAndExpression ({infer BinaryExpression.left=current} op='||' right=AndAndExpression)*
;

AndAndExpression:
    OrExpression ({infer BinaryExpression.left=current} op='&&' right=OrExpression)*
;

OrExpression:
    XorExpression ({infer BinaryExpression.left=current} op='|' right=XorExpression)*
;

XorExpression:
    AndExpression ({infer BinaryExpression.left=current} op='^' right=AndExpression)*
;

AndExpression:
    CompareExpression ({infer BinaryExpression.left=current} op='&' right=CompareExpression)*
;

CompareExpression:
    AddExpression ({infer BinaryExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AddExpression)*
;

AddExpression:
    MulExpression ({infer BinaryExpression.left=current} op='+' right=MulExpression)*
;

MulExpression:
    UnaryExpression ({infer BinaryExpression.left=current} op='*' right=UnaryExpression)*
;

UnaryExpression:
    ({infer UnaryExpression} op=('!'|'-') expr=PostfixExpression) |
    PostfixExpression
;


fragment Arguments: 
 '(' (arguments+=Expression (',' arguments+=Expression)* ','?)? ')'
;

PostfixExpression:
    PrimaryExpression (
        ({infer MemberAccess.receiver=current} op='.' name=(ID | STRING)) |
        ({infer IntRangeExpression.left=current} op=('in'|'..') right=Expression) | // IntRange
        ({infer TypeCastExpression.expr=current} op='as' typeRef=TypeReference) |
        ({infer ArrayAccess.array=current} '[' index=Expression ']') |
        ({infer CallExpression.method=current} Arguments) |

        ({infer InstanceofExpression.expr=current} op='instanceof' typeRef=TypeReference)
    )?
;

BracketExpression:
   '<' value=(ID | ':')+ '>'
;

PrimaryExpression
    : ParenthesizedExpression | FunctionExpression | LocalVarialbe | PrimitiveLiterals | BracketExpression
;

ParenthesizedExpression:
    '(' expr=Expression ')'
;

PrimitiveLiterals:
    StringLiteral | NumberLiteral | BooleanLiteral | ArrayLiteral | MapLiteral
;

FunctionExpression:
    'function' Parameters ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

ArrayLiteral:
    '[' (values+=Expression (',' values+=Expression)* ','?)? ']'
;

MapLiteral:
    '{' (entries+=MapEntry (',' entries+=MapEntry)* ','?)? '}'
;

MapEntry:
    key=Expression ':' value=Expression
;

LocalVarialbe:
    name=ID
;

StringLiteral:
    value=STRING
;

NumberLiteral:
    value=INT
;

BooleanLiteral:
  value?='true' | 'false'
;
//endregion Expression

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

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
