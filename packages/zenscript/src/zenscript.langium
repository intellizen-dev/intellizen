grammar IntelliZen

entry Script:
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | classes+=ClassDeclaration
    | expressions+=Expression
    )*
;

Person:
    'person' name=ID;

Greeting:
    'Hello' person=[Person:ID] '!';

ImportDeclaration:
    'import' package=QualifiedName ('as' alias=ID)? ';'?
;

QualifiedName returns string:
    ID ('.' ID)*
;

ClassDeclaration: 
    'zenClass' name=ID 
    ('extends' (superTypes+=[ClassDeclaration:ID] (',' superTypes+=[ClassDeclaration:ID])*))? 
    ('{'
        members+=ClassMemberDeclaration*
    '}')?
;

ClassMemberDeclaration: FunctionDeclaration | FieldDeclaration;

FieldDeclaration:
    prefix=('val'|'var') name=ID ('as' typeRef=TypeReference);

FunctionDeclaration:
    prefix=('static' | 'global')? 'function' name=ID '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)? 
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

ExpandFunctionDeclaration:
    '$expand' typeRef=TypeReference '$' name=ID '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

ConstructorDeclaration:
    'zenConstructor' '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('{'
        (body+=Statement)*
    '}')?
;

ValueParameter:
    varargs?='...' name=ID ('as' typeRef=TypeReference)? ('=' defaultValue=Expression)?
;


//region TypeReference
TypeReference:
    PrimitiveType | ListType | ArrayType | MapType | FunctionType | IntersectionType | UnionType | ParenthesizedType
;

PrimitiveType:
    primitive=('any'| 'byte'| 'short'| 'int'| 'long'| 'float'| 'double'| 'bool'| 'void'| 'string')
;

ListType:
    '[' baseTypeRef=TypeReference ']'
;

ArrayType:
    baseTypeRef=TypeReference '[' ']'
;

MapType:
    valueTypeRef=TypeReference '[' keyTypeRef=TypeReference ']' ('$' orderly?='orderly')?
;

FunctionType:
    'function' '(' 
        (paramTypeRef+=TypeReference (',' paramTypeRef+=TypeReference)*)? 
    ')' returnTypeRef=TypeReference
;

IntersectionType:
    typeRefs+=TypeReference ('&' typeRefs+=TypeReference)+
;

UnionType:
    typeRefs+=TypeReference ('|' typeRefs+=TypeReference)+
;

ParenthesizedType:
    '(' typeRef=TypeReference ')'
;
//endregion TypeReference


//region Statement
Statement
    : IfStatement 
    | WhileStatement 
    | ForStatement 
    | BlockStatement 
    | ReturnStatement 
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
    ConditionExpression ({infer BinaryExpression.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=ConditionExpression)*
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
    op=('!'|'-') expr=PostfixExpression
;

PostfixExpression:
    TypeCastExpression | InstanceofExpression
;

TypeCastExpression:
    expr=Expression op='as' typeRef=TypeReference
;

InstanceofExpression:
    expr=Expression op='instanceof' typeRef=TypeReference
;

MemberAccess:
    receiver=Expression '.' name=ID
;

ArrayAccess:
    array=Expression '[' index=Expression ']'
;

PrimaryExpression
    : ParenthesizedExpression
    | UnaryExpression
;

ParenthesizedExpression:
    '(' expr=Expression ')'
;

FunctionExpression:
    'function' '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

IntRangeExpression:
    Expression ({infer BinaryExpression.left=current} op=('in'|'..') right=Expression)*
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
