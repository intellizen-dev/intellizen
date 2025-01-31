import "./interfaces";
import "./common";


ZenScriptEntry returns Script:
    // zs
    ( imports+=ImportDeclaration
        | functions+=FunctionDeclaration
        | expands+=ExpandFunctionDeclaration
        | classes+=ClassDeclaration
        | statements+=Statement
        )*
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
    // prefix=('static' | 'global')?  normal zs do not allow function prefix
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
    expr=ReservedLiteralExpression ';'
;

BreakStatement returns BreakStatement:
    {BreakStatement} 'break' ';'
;

ContinueStatement returns ContinueStatement:
    {ContinueStatement} 'continue' ';'
;
//endregion Statement


//region SpecialExpression

// For ambiguous of ('function', '{' ) | Expression
ReservedLiteralExpression returns Expression:
    ReservedLiteralAssignment
;

ReservedLiteralAssignment returns Expression:
    ReservedLiteralConditionalExpression ({Assignment.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)?
;


ReservedLiteralConditionalExpression returns Expression:
    ReservedLiteralOrOrExpression ({ConditionalExpression.first=current} '?' second=ConditionalExpression ':' third=ConditionalExpression)?
;

ReservedLiteralOrOrExpression returns Expression:
    ReservedLiteralAndAndExpression ({InfixExpression.left=current} op='||' right=AndAndExpression)*
;

ReservedLiteralAndAndExpression returns Expression:
    ReservedLiteralOrExpression ({InfixExpression.left=current} op='&&' right=OrExpression)*
;

ReservedLiteralOrExpression returns Expression:
    ReservedLiteralXorExpression ({InfixExpression.left=current} op='|' right=XorExpression)*
;

ReservedLiteralXorExpression returns Expression:
    ReservedLiteralAndExpression ({InfixExpression.left=current} op='^' right=AndExpression)*
;

ReservedLiteralAndExpression returns Expression:
    ReservedLiteralRelationalExpression ({InfixExpression.left=current} op='&' right=RelationalExpression)*
;

ReservedLiteralRelationalExpression returns Expression:
    ReservedLiteralAdditiveExpression  ({InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AdditiveExpression)*
;

ReservedLiteralAdditiveExpression returns Expression:
    ReservedLiteralMultiplicativeExpression ({InfixExpression.left=current} op=('+'|'-'|'~') right=MultiplicativeExpression)*
;

ReservedLiteralMultiplicativeExpression returns Expression:
    ReservedLiteralPrefixExpression ({InfixExpression.left=current} op=('*'|'/'|'%') right=PrefixExpression)*
;

ReservedLiteralPrefixExpression returns Expression:
    ({PrefixExpression} op=('!'|'-') expr=PrefixExpression) | ReservedLiteralPostfixExpression
;

ReservedLiteralPostfixExpression returns Expression:
    ReservedLiteralPrimaryExpression (
        ({MemberAccess.receiver=current} '.' target=[NamedElement:MemberAccessName] ) |
        ({InfixExpression.left=current} op=('to'|'..') right=Expression) |
        ({TypeCastExpression.expr=current} 'as' typeRef=TypeReference) |
        ({IndexingExpression.receiver=current} '[' argument=Expression ']') |
        ({CallExpression.receiver=current} '(' (arguments+=Expression (',' arguments+=Expression)* ','?)? ')') |
        ({InstanceofExpression.expr=current} 'instanceof' typeRef=NamedType)
    )*
;


fragment ReservedLiteralPrimaryExpression returns Expression:
    ParenthesizedExpression | ReferenceExpression | ReservedLiteralLiteralExpression | BracketExpression
;

ReservedLiteralLiteralExpression returns LiteralExpression:
    StringLiteral | StringTemplate | NumberLiteral | BooleanLiteral | ArrayLiteral | NullLiteral
;

//endregion SpecialExpression

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

//endregion Expression

