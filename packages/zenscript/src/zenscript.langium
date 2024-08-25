grammar IntelliZen

entry Script:
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | classes+=ClassDeclaration
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
    ('extends' (superClasses+=[ClassDeclaration:ID] (',' superClasses+=[ClassDeclaration:ID])*))? 
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
    ')' ('as' returnTypeRef=TypeReference)?
;

ValueParameter:
    name=ID ('as' typeRef=TypeReference)? ('=')?
;

TypeReference:
    primitive=('any'| 'byte'| 'short'| 'int'| 'long'| 'float'| 'double'| 'bool'| 'void'| 'string')
;

// region Statement
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
    'while' Expression Statement
;

ForStatement:
    'for' variables+=ID (',' variables+=ID)* 'in' Expression '{' statements+=Statement '}'
;

BlockStatement: 
    '{' statements+=Statement* '}'
;

ReturnStatement: 
    'return' Expression? ';'
;

ExpressionStatement: 
    Expression ';'
;

BreakStatement: 
    {infer Statement} 'break' ';'
;

ContinueStatement: 
    {infer Statement} 'continue' ';'
;
// endregion Statement


// region Expression
Expression:
    Assignment;

Assignment infers Expression:
    Condition ({infer BinaryExpression.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Condition)*
;

Condition infers Expression:
    condition=OrOrExpression ({infer BinaryExpression.left=current} '?' ifPart=OrOrExpression ':' elsePart=OrOrExpression)*
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
    StringLiteral 'as' TypeReference
;

interface StringLiteral {
    value: string
}

StringLiteral returns StringLiteral:
    value = STRING
;

// #endregion Expression

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
