grammar ZenScript

type NamedElement = Script | ClassDeclaration | FunctionDeclaration | ExpandFunctionDeclaration | FieldDeclaration | ValueParameter | VariableDeclaration | LoopParameter | MapEntry | ImportDeclaration | ConstructorDeclaration;

entry ZenScript infers Script:
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=ExpandFunctionDeclaration
    | classes+=ClassDeclaration
    | statements+=Statement
    )*
;

type Declaration = ImportDeclaration | ClassDeclaration | FieldDeclaration | FunctionDeclaration | ExpandFunctionDeclaration | ConstructorDeclaration | VariableDeclaration | ValueParameter | LoopParameter

ImportDeclaration:
    'import' path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])* ('as' alias=ID)? ';'
;

ClassDeclaration:
    'zenClass' name=ID
    '{'
        members+=(FunctionDeclaration | FieldDeclaration | ConstructorDeclaration)*
    '}'
;

FieldDeclaration:
    prefix=('static' | 'var' | 'val') name=ID ('as' type=Type)? ('=' initializer=Expression)? ';'
;

ValueParameter:
    name=ID ('as' type=Type)? ('=' defaultValue=Expression)?
;

type CallableDeclaration = FunctionDeclaration | ExpandFunctionDeclaration | ConstructorDeclaration;

FunctionDeclaration:
    'function' name=ID? '('
        (params+=ValueParameter (',' params+=ValueParameter)*)?
    ')' ('as' retType=Type)? ('{'
        (body+=Statement)*
    '}')
;

ExpandFunctionDeclaration:
    '$expand' type=Type '$' name=ID  '('
        (params+=ValueParameter (',' params+=ValueParameter)*)?
    ')' ('as' retType=Type)? '{'
        (body+=Statement)*
    '}'
;

ConstructorDeclaration:
    'zenConstructor' '('
        (params+=ValueParameter (',' params+=ValueParameter)*)?
    ')' ('{'
        (body+=Statement)*
    '}')
;

//region Statement
Statement:
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

VariableDeclaration:
    prefix=('global'|'static'|'var'|'val') name=ID ('as' type=Type)? ('=' initializer=Expression)? ';'
;

IfStatement:
    'if' cond=Expression ifBody=Statement ('else' elseBody=Statement)?
;

WhileStatement:
    'while' cond=Expression body=Statement
;

ForStatement:
    'for' params+=LoopParameter (',' params+=LoopParameter)* 'in' range=Expression body=Statement
;

LoopParameter:
    name=ID
;

BlockStatement:
    '{' (body+=Statement)* '}'
;

ReturnStatement:
    'return' expr=Expression? ';'
;

ExpressionStatement:
    expr=ExpressionNoMap ';'
;

BreakStatement infers BreakStatement:
    {infer BreakStatement} 'break' ';'
;

ContinueStatement infers ContinueStatement:
    {infer ContinueStatement} 'continue' ';'
;
//endregion Statement

//region ExpressionNoMap

// Here's the thing.
// When it comes to statements like `if true { }`.
// We want the `{ }` to be a BlockStatement, not a MapLiteral.
// So we have these syntaxes.

ExpressionNoMap infers Expression:
    AssignmentNoMap
;

AssignmentNoMap infers Assignment:
    ConditionalExpressionNoMap ({infer AssignmentNoMap.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)?
;

ConditionalExpressionNoMap infers ConditionalExpression:
    LogicalExpressionNoMap ({infer ConditionalExpressionNoMap.cond=current} '?' thenBody=ConditionalExpressionNoMap ':' elseBody=ConditionalExpressionNoMap)?
;

LogicalExpressionNoMap infers LogicalExpression:
    BitwiseExpressionNoMap ({infer InfixExpression.left=current} op=('&&'|'||') right=BitwiseExpressionNoMap)*
;

BitwiseExpressionNoMap infers BitwiseExpression:
    RelationalExpressionNoMap ({infer InfixExpression.left=current} op=('&'|'|'|'^') right=RelationalExpressionNoMap)*
;

RelationalExpressionNoMap infers RelationalExpression:
    AdditiveExpressionNoMap  ({infer InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AdditiveExpressionNoMap)*
;

AdditiveExpressionNoMap infers AdditiveExpression:
    MultiplicativeExpressionNoMap ({infer InfixExpression.left=current} op=('+'|'-'|'~') right=MultiplicativeExpressionNoMap)*
;

MultiplicativeExpressionNoMap infers MultiplicativeExpression:
    PrefixExpressionNoMap ({infer InfixExpression.left=current} op=('*'|'/'|'%') right=PrefixExpressionNoMap)*
;

PrefixExpressionNoMap infers PrefixExpression:
    ({infer PrefixExpression} op=('!'|'-') expr=PrefixExpressionNoMap) | PostfixExpressionNoMap
;

PostfixExpressionNoMap infers PostfixExpression:
    PrimaryExpressionNoMap (
        ({infer MemberAccess.receiver=current} '.' (target=[NamedElement:ID] | target=[NamedElement:STRING]) ) |
        ({infer IntRangeExpression.from=current} op=('to'|'..') to=Expression) |
        ({infer TypeCastExpression.expr=current} 'as' type=Type) |
        ({infer IndexExpression.receiver=current} '[' index=Expression ']') |
        ({infer CallExpression.receiver=current} '(' (args+=Expression (',' args+=Expression)* ','?)? ')') |
        ({infer InstanceofExpression.expr=current} 'instanceof' type=NamedType)
    )*
;

fragment PrimaryExpressionNoMap infers PrimaryExpression:
    ParenthesizedExpression | ReferenceExpression | LiteralExpressionNoMap | BracketExpression
;

LiteralExpressionNoMap infers LiteralExpression:
    StringLiteral | StringTemplate | IntegerLiteral | FloatLiteral | BooleanLiteral | ArrayLiteral /* | MapLiteral */ | NullLiteral
;
//endregion ExpressionNoMap

//region Expression
Expression:
    Assignment
;

Assignment:
    ConditionalExpression ({infer Assignment.left=current} op=('='|'+='|'-='|'~='|'*='|'/='|'%='|'|='|'&='|'^=') right=Assignment)?
;

ConditionalExpression:
    LogicalExpression ({infer ConditionalExpression.cond=current} '?' thenBody=ConditionalExpression ':' elseBody=ConditionalExpression)?
;

LogicalExpression:
    BitwiseExpression ({infer InfixExpression.left=current} op=('&&'|'||') right=BitwiseExpression)*
;

BitwiseExpression infers Expression:
    RelationalExpression ({infer InfixExpression.left=current} op=('&'|'|'|'^') right=RelationalExpression)*
;

RelationalExpression:
    AdditiveExpression ({infer InfixExpression.left=current} op=('=='|'!='|'<'|'<='|'>'|'>='|'in'|'has') right=AdditiveExpression)*
;

AdditiveExpression:
    MultiplicativeExpression ({infer InfixExpression.left=current} op=('+'|'-'|'~') right=MultiplicativeExpression)*
;

MultiplicativeExpression:
    PrefixExpression ({infer InfixExpression.left=current} op=('*'|'/'|'%') right=PrefixExpression)*
;

PrefixExpression:
    ({infer PrefixExpression} op=('!'|'-') expr=PrefixExpression) | PostfixExpression
;

PostfixExpression:
    PrimaryExpression (
        ({infer MemberAccess.receiver=current} '.' (target=[NamedElement:ID] | target=[NamedElement:STRING]) ) |
        ({infer IntRangeExpression.from=current} op=('to'|'..') to=Expression) |
        ({infer TypeCastExpression.expr=current} 'as' type=Type) |
        ({infer IndexExpression.receiver=current} '[' index=Expression ']') |
        ({infer CallExpression.receiver=current} '(' (args+=Expression (',' args+=Expression)* ','?)? ')') |
        ({infer InstanceofExpression.expr=current} 'instanceof' type=NamedType)
    )*
;

PrimaryExpression:
    ParenthesizedExpression | FunctionExpression | ReferenceExpression | LiteralExpression | BracketExpression
;

ParenthesizedExpression:
    '(' expr=Expression ')'
;

LiteralExpression:
    StringLiteral | StringTemplate | IntegerLiteral | FloatLiteral | BooleanLiteral | ArrayLiteral | MapLiteral | NullLiteral
;

FunctionExpression:
    'function' '('
        (params+=ValueParameter (',' params+=ValueParameter)*)?
    ')' ('as' retType=Type)? '{'
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

StringTemplate:
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

BracketExpression:
    '<' path+=BracketLocation (':' path+=BracketLocation+)*
        (':' properties+=BracketProperty (',' properties+=BracketProperty)*)?
    '>'
;

BracketLocation:
    value=LocationLiteral | ExpressionTemplate
;

LocationLiteral returns string:
    (ID | INTEGER | '.' | '-' | '*' | 'for' | 'if')+
;

ExpressionTemplate:
    '${' expr=Expression '}'
;

BracketProperty:
    key=UnquotedString '=' value=(UnquotedString | IntegerLiteral | BooleanLiteral)
;

ReferenceExpression:
    target=[NamedElement:ID]
;

IntegerLiteral:
    value=INTEGER
;

FloatLiteral:
    value=FLOAT
;

BooleanLiteral:
    value?='true' | 'false'
;

StringLiteral:
    value=STRING
;

UnquotedString:
    value=ID
;

NullLiteral:
    value='null'
;
//endregion Expression

//region Type
Type:
    PrimaryType ('['(
        ({infer MapType.value=current} key=Type ']' ('$' orderly?='orderly')?) |
        ({infer ArrayType.value=current} ']')
    ) )*
;

fragment PrimaryType:
    ListType | FunctionType | NamedType
;

ListType:
    '[' value=Type ']'
;

FunctionType:
    'function' '('
        (params+=Type (',' params+=Type)*)?
    ')' retType=Type
;

NamedType:
    path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])*
;
//endregion Type

ID returns string:
    IDENTIFIER
    | 'to'
    | 'orderly'  // zenutils
;

hidden terminal WHITE_SPACE: /\s+/;
terminal IDENTIFIER: /[_a-zA-Z][\w_]*/;
terminal FLOAT: /[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?[fFdD]?/;
terminal INTEGER: /(0[xX][0-9a-fA-F]+|[0-9]+)[lL]?/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal BLOCK_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal LINE_COMMENT: /\/\/[^\n\r]*/;
hidden terminal PREPROCESSOR: /#[^\n\r]*/;
