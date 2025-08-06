grammar ZenScript

import "./common"

entry ZenScript returns Script:
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=ExpandFunctionDeclaration
    | classes+=ClassDeclaration
    | statements+=Statement
    )*
;

ImportDeclaration returns ImportDeclaration:
    'import' path+=[Entity:ID] ('.' path+=[Entity:ID])* ('as' alias=ID)? ';'
;

ClassDeclaration returns ClassDeclaration:
    'zenClass' name=ID
    '{' members+=(FunctionDeclaration | FieldDeclaration | ConstructorDeclaration)* '}'
;

FieldDeclaration returns FieldDeclaration:
    prefix=('static' | 'var' | 'val') name=ID ('as' type=Type)? ('=' initializer=Expression)? ';'
;

ValueParameter returns ValueParameter:
    name=ID ('as' type=Type)? ('=' defaultValue=Expression)?
;

FunctionDeclaration returns FunctionDeclaration:
    'function' name=ID? '(' (params+=ValueParameter (',' params+=ValueParameter)*)? ')' ('as' retType=Type)?
    '{' body+=Statement* '}'
;

ExpandFunctionDeclaration returns ExpandFunctionDeclaration:
    '$expand' type=Type '$' name=ID  '(' (params+=ValueParameter (',' params+=ValueParameter)*)? ')' ('as' retType=Type)? 
    '{' body+=Statement* '}'
;

ConstructorDeclaration returns ConstructorDeclaration:
    'zenConstructor' '(' (params+=ValueParameter (',' params+=ValueParameter)*)? ')' 
    '{' body+=Statement* '}'
;

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
    prefix=('global'|'static'|'var'|'val') name=ID ('as' type=Type)? ('=' initializer=Expression)? ';'
;

IfStatement returns IfStatement:
    'if' cond=Expression thenBody=Statement ('else' elseBody=Statement)?
;

WhileStatement returns WhileStatement:
    'while' cond=Expression body=Statement
;

ForStatement returns ForStatement:
    'for' params+=LoopParameter (',' params+=LoopParameter)* 'in' range=Expression body=Statement
;

LoopParameter returns LoopParameter:
    name=ID
;

BlockStatement returns BlockStatement:
    '{' body+=Statement* '}'
;

ReturnStatement returns ReturnStatement:
    'return' expr=Expression? ';'
;

ExpressionStatement returns ExpressionStatement:
    expr=ExpressionNoMap ';'
;

BreakStatement returns BreakStatement:
    {BreakStatement} 'break' ';'
;

ContinueStatement returns ContinueStatement:
    {ContinueStatement} 'continue' ';'
;
//endregion Statement

//region ExpressionNoMap

// Here's the thing.
// When it comes to statements like `if true { }`.
// We want the `{ }` to be a BlockStatement, not a MapLiteral.
// So we have these syntaxes.

ExpressionNoMap returns Expression:
    AssignmentNoMap
;

AssignmentNoMap returns Assignment:
    ConditionalExpressionNoMap ({Assignment.left=current} operator=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)?
;

ConditionalExpressionNoMap returns ConditionalExpression:
    InfixExpressionNoMap ({ConditionalExpression.cond=current} '?' thenBody=ConditionalExpressionNoMap ':' elseBody=ConditionalExpressionNoMap)?
;

infix InfixExpressionNoMap on PrefixExpressionNoMap returns InfixExpression:
    // Multiplicative
    '*' | '/' | '%'

    // Additive
    > '+' | '-' | '~'

    // Relational
    > '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'has'

    // Bitwise
    > '&' | '|' | '^'

    // Logical
    > '&&' | '||'
;

PrefixExpressionNoMap returns PrefixExpression:
    PostfixExpressionNoMap
    | ({PrefixExpression} operator=('!'|'-') expr=PrefixExpressionNoMap)
;

PostfixExpressionNoMap returns PostfixExpression:
    PrimaryExpressionNoMap
    ( {MemberAccess.receiver=current} '.' (entity=[Entity:ID] | entity=[Entity:STRING])
    | {IntRangeExpression.from=current} operator=('to'|'..') to=Expression
    | {TypeCastExpression.expr=current} 'as' type=Type
    | {IndexExpression.receiver=current} '[' index=Expression ']'
    | {CallExpression.receiver=current} '(' (args+=Expression (',' args+=Expression)*)? ')'
    | {InstanceofExpression.expr=current} 'instanceof' type=NamedType
    )*
;

fragment PrimaryExpressionNoMap:
    LiteralExpressionNoMap | ReferenceExpression | ParenthesizedExpression | FunctionExpression | BracketExpression | StringTemplate
;

fragment LiteralExpressionNoMap:
    StringLiteral | IntegerLiteral | FloatLiteral | BooleanLiteral | NullLiteral | ArrayLiteral /* | MapLiteral */
;
//endregion ExpressionNoMap

//region Expression
Expression returns Expression:
    Assignment
;

Assignment returns Assignment:
    ConditionalExpression ({Assignment.left=current} operator=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)?
;

ConditionalExpression returns ConditionalExpression:
    InfixExpression ({ConditionalExpression.cond=current} '?' thenBody=ConditionalExpression ':' elseBody=ConditionalExpression)?
;

infix InfixExpression on PrefixExpression returns InfixExpression:
    // Multiplicative
    '*' | '/' | '%'

    // Additive
    > '+' | '-' | '~'

    // Relational
    > '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'has'

    // Bitwise
    > '&' | '|' | '^'

    // Logical
    > '&&' | '||'
;

PrefixExpression returns PrefixExpression:
    {PrefixExpression} operator=('!'|'-') expr=PrefixExpression
    | PostfixExpression
;

PostfixExpression returns PostfixExpression:
    PrimaryExpression
    ( {MemberAccess.receiver=current} '.' (entity=[Entity:ID] | entity=[Entity:STRING])
    | {IntRangeExpression.from=current} operator=('..' | 'to') to=Expression
    | {TypeCastExpression.expr=current} 'as' type=Type
    | {IndexExpression.receiver=current} '[' index=Expression ']'
    | {CallExpression.receiver=current} '(' (args+=Expression (',' args+=Expression)*)? ')'
    | {InstanceofExpression.expr=current} 'instanceof' type=NamedType
    )*
;

fragment PrimaryExpression:
    LiteralExpression | ReferenceExpression | ParenthesizedExpression | FunctionExpression | StringTemplate | BracketExpression
;

fragment LiteralExpression returns LiteralExpression:
    StringLiteral | IntegerLiteral | FloatLiteral | BooleanLiteral | NullLiteral | ArrayLiteral | MapLiteral
;

StringLiteral returns StringLiteral:
    value=STRING
;

IntegerLiteral returns IntegerLiteral:
    value=INTEGER
;

FloatLiteral returns FloatLiteral:
    value=FLOAT
;

BooleanLiteral returns BooleanLiteral:
    value?='true' | 'false'
;

NullLiteral returns NullLiteral:
    value='null'
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

ReferenceExpression returns ReferenceExpression:
    entity=[Entity:ID]
;

ParenthesizedExpression returns ParenthesizedExpression:
    '(' expr=Expression ')'
;

FunctionExpression returns FunctionExpression:
    'function' '(' (params+=ValueParameter (',' params+=ValueParameter)*)? ')' ('as' retType=Type)? 
    '{' body+=Statement* '}'
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
    '<' path+=BracketLocation (':' path+=BracketLocation+)*
        (':' properties+=BracketProperty (',' properties+=BracketProperty)*)?
    '>'
;

BracketLocation returns BracketLocation:
    value=LocationLiteral | ExpressionTemplate
;

LocationLiteral returns string:
    (ID | INTEGER | '.' | '-' | '*' | 'for' | 'if')+
;

ExpressionTemplate returns ExpressionTemplate:
    '${' expr=Expression '}'
;

BracketProperty returns BracketProperty:
    key=UnquotedString '=' value=(UnquotedString | IntegerLiteral | BooleanLiteral)
;

UnquotedString returns UnquotedString:
    value=ID
;
//endregion Expression

//region Type
Type returns Type:
    PrimaryType 
    (   '['
        ( ({MapType.value=current} key=Type ']' ('$' orderly?='orderly')?) 
        | ({ArrayType.value=current} ']')
        )
    )*
;

fragment PrimaryType:
    ListType | FunctionType | NamedType
;

ListType returns ListType:
    '[' value=Type ']'
;

FunctionType returns FunctionType:
    'function' '(' (params+=Type (',' params+=Type)*)? ')' retType=Type
;

NamedType returns NamedType:
    path+=[Entity:ID] ('.' path+=[Entity:ID])*
;
//endregion Type

ID returns string:
    IDENTIFIER
    | 'to'
    | 'orderly'  // zenutils
;
