grammar ZenScriptDeclaration

import "./common"

entry ZenScriptDeclaration returns Script:
    package=PackageDeclaration?
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=ExpandDeclaration
    | classes+=ClassDeclaration
    | statements+=VariableDeclaration
    )*
;

PackageDeclaration returns PackageDeclaration:
    'package' path+=ID ('.' path+=ID )* ';'?
;

ImportDeclaration returns ImportDeclaration:
    'import' path+=[Entity:ID] ('.' path+=[Entity:ID])* ('as' alias=ID)? ';'?
;

ClassDeclaration returns ClassDeclaration:
    'zenClass' name=ID
    ('<' typeParams+=TypeParameter (',' typeParams+=TypeParameter)* '>')?
    ('extends' (superTypes+=NamedType (',' superTypes+=NamedType)*))?
    ('{' members+=(FunctionDeclaration | FieldDeclaration | OperatorFunctionDeclaration)* '}')?
;

FieldDeclaration returns FieldDeclaration:
    variance=('static' | 'var' | 'val') name=ID ('as' type=Type)? ('=' initializer=Expression)? ';'?
;

ValueParameter returns ValueParameter:
    (varargs?='...')? name=ID ('as' type=Type)? ('=' defaultValue=(DefaultExpression | Expression))?
;

TypeParameter returns TypeParameter:
    name=ID
;

FunctionDeclaration returns FunctionDeclaration:
    variance=('static' | 'global' | 'lambda')? 
    'function' name=ID? '(' (params+=ValueParameter (',' params+=ValueParameter)*)? ')' 'as' retType=Type ';'?
;

OperatorFunctionDeclaration returns OperatorFunctionDeclaration:
    'operator' operator=Operator '(' (params+=ValueParameter (',' params+=ValueParameter)*)? ')' 'as' retType=CompoundType ';'?
;

Operator returns string:
    '+' | '-' | '*' | '/' | '%' | '~' | '|' | '&' | '^' |
    '+=' | '-=' | '*=' | '/=' | '%=' | '~=' | '|=' | '&=' | '^=' |
    '!' | '['']'('=')? | '..' | 'has' | '.' ('=')? | 'for' | 'as' | '==' | '!=' | '<' | '<=' | '>' | '>='
;

ExpandDeclaration returns ExpandDeclaration:
    'expand' type=Type '{' 
        members+=(FieldDeclaration | FunctionDeclaration | OperatorFunctionDeclaration)*
    '}'
;

VariableDeclaration returns VariableDeclaration:
    variance=('global' | 'static' | 'var' | 'val') name=ID 'as' type=Type ('=' initializer=LiteralExpression)? ';'?
;

Expression returns Expression:
    PrefixExpression
;

PrefixExpression returns PrefixExpression:
    ({PrefixExpression} operator=('-') expr=PrefixExpression)
    | LiteralExpression
;

LiteralExpression returns Expression:
    StringLiteral | IntegerLiteral | FloatLiteral | BooleanLiteral | NullLiteral
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

DefaultExpression returns Expression:
    {DefaultExpression} value='default'
;

//region Type
Type returns Type:
    PrimaryType (
        '['
        ( ({MapType.value=current} key=Type ']') 
        | ({ArrayType.value=current} ']')
        )
    )*
;

fragment PrimaryType:
    ListType | FunctionType | ParenthesizedType | NamedType
;

ParenthesizedType returns ParenthesizedType:
    '(' value=Type ')'
;

ListType returns ListType:
    '[' value=Type ']'
;

FunctionType returns FunctionType:
    'function' '(' (params+=Type (',' params+=Type)*)? ')' retType=Type
;

NamedType returns NamedType:
    path+=[Entity:ID] ('.' path+=[Entity:ID])* ('<' typeArgs+=NamedType (',' typeArgs+=NamedType)* '>')?
;

CompoundType returns CompoundType:
    Type ({CompoundType.values+=current} (',' values+=Type)+)?
;
//endregion Type

ID returns string:
    IDENTIFIER
    | 'to'
    | 'orderly' // zenutils
    | 'package'
    | 'extends'
    | 'operator'
    | 'default'
    | 'lambda'
    | 'expand'
;
