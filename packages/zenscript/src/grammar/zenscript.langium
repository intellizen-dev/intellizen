grammar ZenScript

import "./common";

entry ZenScript returns Script:
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=ExpandFunctionDeclaration
    | classes+=ClassDeclaration
    | statements+=Statement
    )*
;

ImportDeclaration returns ImportDeclaration:
    'import' path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])* ('as' alias=ID)? ';'?
;

ClassDeclaration returns ClassDeclaration:
    'zenClass' name=ID
    '{'
        members+=ClassMemberDeclaration*
    '}'
;

ClassMemberDeclaration returns ClassMemberDeclaration:
    FunctionDeclaration | FieldDeclaration | ConstructorDeclaration;

FieldDeclaration returns FieldDeclaration:
    prefix=('static' | 'var' | 'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=Expression)? ';'
;

ValueParameter returns ValueParameter:
    name=ID ('as' typeRef=TypeReference)? ('=' defaultValue=Expression)?
;

FunctionDeclaration returns FunctionDeclaration:
    'function' name=ID? '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ('as' returnTypeRef=TypeReference)? ('{'
        (body+=Statement)*
    '}')
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
    ')' ('{'
        (body+=Statement)*
    '}')
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
    prefix=('global'|'static'|'var'|'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=Expression)? ';'
;

IfStatement returns IfStatement:
    'if' condition=Expression ifBody=Statement ('else' elseBody=Statement)?
;

WhileStatement returns WhileStatement:
    'while' condition=Expression body=Statement
;

ForStatement returns ForStatement:
    'for' parameters+=LoopParameter (',' parameters+=LoopParameter)* 'in' range=Expression body=Statement
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

AssignmentNoMap returns Expression:
    ConditionalExpressionNoMap ({Assignment.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)?
;

ConditionalExpressionNoMap returns Expression:
    OrOrExpressionNoMap ({ConditionalExpression.first=current} '?' second=ConditionalExpression ':' third=ConditionalExpression)?
;

OrOrExpressionNoMap returns Expression:
    AndAndExpressionNoMap ({InfixExpression.left=current} op='||' right=AndAndExpression)*
;

AndAndExpressionNoMap returns Expression:
    OrExpressionNoMap ({InfixExpression.left=current} op='&&' right=OrExpression)*
;

OrExpressionNoMap returns Expression:
    XorExpressionNoMap ({InfixExpression.left=current} op='|' right=XorExpression)*
;

XorExpressionNoMap returns Expression:
    AndExpressionNoMap ({InfixExpression.left=current} op='^' right=AndExpression)*
;

AndExpressionNoMap returns Expression:
    RelationalExpressionNoMap ({InfixExpression.left=current} op='&' right=RelationalExpression)*
;

RelationalExpressionNoMap returns Expression:
    AdditiveExpressionNoMap  ({InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AdditiveExpression)*
;

AdditiveExpressionNoMap returns Expression:
    MultiplicativeExpressionNoMap ({InfixExpression.left=current} op=('+'|'-'|'~') right=MultiplicativeExpression)*
;

MultiplicativeExpressionNoMap returns Expression:
    PrefixExpressionNoMap ({InfixExpression.left=current} op=('*'|'/'|'%') right=PrefixExpression)*
;

PrefixExpressionNoMap returns Expression:
    ({PrefixExpression} op=('!'|'-') expr=PrefixExpression) | PostfixExpressionNoMap
;

PostfixExpressionNoMap returns Expression:
    PrimaryExpressionNoMap (
        ({MemberAccess.receiver=current} '.' target=[NamedElement:MemberAccessName] ) |
        ({InfixExpression.left=current} op=('to'|'..') right=Expression) |
        ({TypeCastExpression.expr=current} 'as' typeRef=TypeReference) |
        ({IndexingExpression.receiver=current} '[' argument=Expression ']') |
        ({CallExpression.receiver=current} '(' (arguments+=Expression (',' arguments+=Expression)* ','?)? ')') |
        ({InstanceofExpression.expr=current} 'instanceof' typeRef=NamedType)
    )*
;

fragment PrimaryExpressionNoMap returns Expression:
    ParenthesizedExpression | ReferenceExpression | LiteralExpressionNoMap | BracketExpression
;

LiteralExpressionNoMap returns LiteralExpression:
    StringLiteral | StringTemplate | NumberLiteral | BooleanLiteral | ArrayLiteral | NullLiteral /* | MapLiteral */
;
//endregion ExpressionNoMap

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
        ({InstanceofExpression.expr=current} 'instanceof' typeRef=NamedType)
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
    key=Expression ':' value=Expression
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
//endregion Expression

//region TypeReference
TypeReference returns TypeReference:
    PrimaryType ('['(
        ({MapTypeReference.value=current} key=TypeReference ']' ('$' orderly?='orderly')?) |
        ({ArrayTypeReference.value=current} ']')
    ) )*
;

fragment PrimaryType returns TypeReference:
    ListType | FunctionType | NamedType
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
    path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])* ('<' typeArguments+=NamedType (',' typeArguments+=NamedType)* '>')?
;
//endregion TypeReference

ID returns string:
    IDENTIFIER
    | 'to'
    | 'orderly'  // zenutils
;
