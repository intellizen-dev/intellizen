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
        (statements+=Statement)*
    '}'
;

ExpandFunctionDeclaration:
    '$expand' typeRef=TypeReference '$' name=ID '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? '{'
        (statements+=Statement)*
    '}'
;

ConstructorDeclaration:
    'zenConstructor' '(' 
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('{'
        (statements+=Statement)*
    '}')?
;

ValueParameter:
    varargs?='...' name=ID ('as' typeRef=TypeReference)? ('=' defaultValue=Expression)?
;

TypeReference:
    primitive=('any'| 'byte'| 'short'| 'int'| 'long'| 'float'| 'double'| 'bool'| 'void'| 'string')
;

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
    'if' condition=Expression ifPart=Statement ('else' elsePart=Statement)
;

WhileStatement:
    'while' condition=Expression loop=Statement
;

ForStatement:
    'for' variables+=ID (',' variables+=ID)* 'in' iter=Expression '{' 
        (statements+=Statement)* 
    '}'
;

BlockStatement: 
    '{' (statements+=Statement)* '}'
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
    value=(Assignment| StringLiteral)
;

Assignment:
    Condition ({infer BinaryExpression.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Condition)*
;

Condition:
    condition=OrOrExpression '?' ifPart=OrOrExpression ':' elsePart=OrOrExpression*
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
    expr=Expression 'as' typeRef=TypeReference
;

StringLiteral:
    value=STRING
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
