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
    AndAndExpression ({infer InfixExpression.left=current} op='||' right=AndAndExpression)*
;

AndAndExpression:
    OrExpression ({infer InfixExpression.left=current} op='&&' right=OrExpression)*
;

OrExpression:
    XorExpression ({infer InfixExpression.left=current} op='|' right=XorExpression)*
;

XorExpression:
    AndExpression ({infer InfixExpression.left=current} op='^' right=AndExpression)*
;

AndExpression:
    CompareExpression ({infer InfixExpression.left=current} op='&' right=CompareExpression)*
;

CompareExpression:
    AddExpression ({infer InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AddExpression)*
;

AddExpression:
    MulExpression ({infer InfixExpression.left=current} op='+' right=MulExpression)*
;

MulExpression:
    PrefixExpression ({infer InfixExpression.left=current} op='*' right=PrefixExpression)*
;

PrefixExpression:
    ({infer PrefixExpression} op=('!'|'-') expr=PostfixExpression) |
    PostfixExpression
;

PostfixExpression:
    PrimaryExpression (
        ({infer MemberAccess.receiver=current} op='.' name=(ID | STRING)) |
        ({infer IntRangeExpression.left=current} op=('in'|'..') right=Expression) |
        ({infer TypeCastExpression.expr=current} op='as' typeRef=TypeReference) |
        ({infer ArrayAccess.array=current} '[' index=Expression ']') |
        ({infer CallExpression.receiver=current} '(' (arguments+=Expression (',' arguments+=Expression)* ','?)? ')') |

        ({infer InstanceofExpression.expr=current} op='instanceof' typeRef=TypeReference)
    )?
;

BracketExpression:
   '<' value=(ID | ':')+ '>'
;

PrimaryExpression
    : ParenthesizedExpression | FunctionExpression | LocalVariable | PrimitiveLiterals | BracketExpression
;

ParenthesizedExpression:
    '(' expr=Expression ')'
;

PrimitiveLiterals:
    StringExpression | NumberLiteral | BooleanLiteral | ArrayLiteral | MapLiteral
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

StringExpression: StringLiteral | StringTemplate;

StringLiteral:
    value=STRING
;

StringTemplate:
    '"' content+=(ContentText | ContentExpression)* '"' |
    '\'' content+=(ContentText | ContentExpression)* '\'' 
;

terminal ContentText:
    /\\.*/
;

ContentExpression:
    '${' expr=Expression '}'
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
