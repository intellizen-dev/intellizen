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

ClassMemberDeclaration: FunctionDeclaration | FieldDeclaration | ConstructorDeclaration;

FieldDeclaration:
    prefix=('static'|'var'|'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=Expression)? ';'
;

VariableDeclaration:
    prefix=('global'|'static'|'var'|'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=Expression)? ';'
;

ValueParameter:
    (varargs?='...')? name=ID ('as' typeRef=TypeReference)? ('=' defaultValue=Expression)?
;

FunctionDeclaration:
    prefix=('static' | 'global')? 'function' name=ID '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)? 
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

ExpandFunctionDeclaration:
    '$expand' typeRef=TypeReference '$' name=ID  '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)? 
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (body+=Statement)*
    '}'
;

ConstructorDeclaration:
    'zenConstructor' '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)? 
    ')' '{'
        (body+=Statement)*
    '}'
;

//region Statement
Statement
    : IfStatement 
    | WhileStatement 
    | ForStatement 
    | BlockStatement 
    | ReturnStatement 
    | VariableDeclaration
    | ExpressionStatement 
    | BreakStatement 
    | ContinueStatement
;

IfStatement:
    'if' condition=Expression ifBody=Statement ('else' elseBody=Statement)?
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
interface Expression {}

Expression returns Expression:
    Assignment
;

Assignment returns Expression:
    ConditionExpression ({infer Assignment.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)*
;

ConditionExpression returns Expression:
    OrOrExpression ({infer TernaryExpression.first=current} '?' second=OrOrExpression ':' third=OrOrExpression)*
;

OrOrExpression returns Expression:
    AndAndExpression ({infer InfixExpression.left=current} op='||' right=AndAndExpression)*
;

AndAndExpression returns Expression:
    OrExpression ({infer InfixExpression.left=current} op='&&' right=OrExpression)*
;

OrExpression returns Expression:
    XorExpression ({infer InfixExpression.left=current} op='|' right=XorExpression)*
;

XorExpression returns Expression:
    AndExpression ({infer InfixExpression.left=current} op='^' right=AndExpression)*
;

AndExpression returns Expression:
    CompareExpression ({infer InfixExpression.left=current} op='&' right=CompareExpression)*
;

CompareExpression returns Expression:
    AddExpression ({infer InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AddExpression)*
;

AddExpression returns Expression:
    MulExpression ({infer InfixExpression.left=current} op=('+'|'-'|'~') right=MulExpression)*
;

MulExpression returns Expression:
    PrefixExpression ({infer InfixExpression.left=current} op=('*'|'/'|'%') right=PrefixExpression)*
;

PrefixExpression returns Expression:
    ({infer PrefixExpression} op=('!'|'-') expr=PostfixExpression) |
    PostfixExpression
;

PostfixExpression returns Expression:
    PrimaryExpression (
        ({infer MemberAccess.receiver=current} op='.' name=(ID | STRING)) |
        ({infer IntRangeExpression.left=current} op=('in'|'..') right=Expression) |
        ({infer TypeCastExpression.expr=current} op='as' typeRef=TypeReference) |
        ({infer ArrayAccess.array=current} '[' index=Expression ']') |
        ({infer CallExpression.receiver=current} '(' (arguments+=Expression (',' arguments+=Expression)* ','?)? ')') |
        ({infer InstanceofExpression.expr=current} op='instanceof' typeRef=TypeReference)
    )?
;

PrimaryExpression
    : ParenthesizedExpression | FunctionExpression | LocalVariable | PrimitiveLiterals | BracketExpression
;

BracketExpression:
   '<' value=(ID | ':')+ '>'
;

ParenthesizedExpression:
    '(' expr=Expression ')'
;

PrimitiveLiterals:
    StringLiteral | StringTemplate | NumberLiteral | BooleanLiteral | ArrayLiteral | MapLiteral
;

FunctionExpression:
    'function' '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)? 
    ')' ('as' returnTypeRef=TypeReference)? '{'
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

LocalVariable:
    name=ID
;

NumberLiteral:
    value=INT
;

BooleanLiteral:
  value?='true' | 'false'
;

StringLiteral:
    value=STRING
;

StringTemplate:
    '`' content+=(ContentText | ContentExpression)* '`'
;

terminal ContentText:
    /\\.*/
;

ContentExpression:
    '${' expr=Expression '}'
;

//endregion Expression

//region TypeReference
interface TypeReference {}

TypeReference returns TypeReference:
    UnionType
;

UnionType returns TypeReference:
    IntersectionType ({infer UnionType.typeRefs+=current} ('|' typeRefs+=IntersectionType)+)?
;

IntersectionType returns TypeReference:
    ComplexType ({infer IntersectionType.typeRefs+=current} ('&' typeRefs+=ComplexType)+)?
;

ComplexType returns TypeReference:
    PrimaryType ('['(
        ({infer MapType.valueTypeRef=current} keyTypeRef=TypeReference) | 
        ({infer ArrayType.valueTypeRef=current})
    )']')*
;

PrimaryType:
    PrimitiveType | ListType | FunctionType | ParenthesizedType | ReferenceType
;

ParenthesizedType:
    '(' typeRef=TypeReference ')'
;

PrimitiveType:
    primitive=('any'| 'byte'| 'short'| 'int'| 'long'| 'float'| 'double'| 'bool'| 'void'| 'string')
;

ListType:
    '[' baseTypeRef=TypeReference ']'
;

FunctionType:
    'function' '(' 
        (paramTypeRefs+=TypeReference (',' paramTypeRefs+=TypeReference)*)? 
    ')' returnTypeRef=TypeReference
;

ReferenceType:
    names=ID ('.' names=ID)*
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
