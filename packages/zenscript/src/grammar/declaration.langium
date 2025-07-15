grammar ZenScriptDeclaration

import "./common";

entry ZenScriptDeclaration returns Script:
    package=PackageDeclaration?
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=(ExpandDeclaration | ExpandFunctionDeclaration)
    | classes+=ClassDeclaration
    | statements+=VariableDeclaration
    )*
;

PackageDeclaration returns PackageDeclaration:
    'package' path+=ID ('.' path+=ID )* ';'?
;

ImportDeclaration returns ImportDeclaration:
    'import' path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])* ('as' alias=ID)? ';'?
;

ClassDeclaration returns ClassDeclaration:
    'zenClass' name=ID 
    ('<' typeParameters+=TypeParameter (',' typeParameters+=TypeParameter)* '>')?
    ('extends' (superTypes+=NamedType (',' superTypes+=NamedType)*))?
    ('{' members+=ClassMemberDeclaration* '}')?
;

ClassMemberDeclaration returns ClassMemberDeclaration:
    FunctionDeclaration | FieldDeclaration | ConstructorDeclaration | OperatorFunctionDeclaration;

FieldDeclaration returns FieldDeclaration:
    prefix=('static' | 'var' |'val') name=ID 'as' typeRef=Type ('=' initializer=LiteralExpression)? ';'?
;

ValueParameter returns ValueParameter:
    (varargs?='...')? name=ID 'as' typeRef=Type ('=' defaultValue=(DefaultExpression | LiteralExpression))?
;

TypeParameter returns TypeParameter:
    name=ID
;

FunctionDeclaration returns FunctionDeclaration:
    prefix=('static' | 'global' | 'lambda')? 'function' name=ID? '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' 'as' returnTypeRef=Type ';'?
;

ExpandFunctionDeclaration returns ExpandFunctionDeclaration:
    '$expand' typeRef=Type '$' name=ID  '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' 'as' returnTypeRef=Type ';'?
;

OperatorFunctionDeclaration returns OperatorFunctionDeclaration:
    'operator' op=Operator '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' 'as' returnTypeRef=CompoundType ';'?
;

Operator returns string:
    '+' | '-' | '*' | '/' | '%' | '~' | '|' | '&' | '^' |
    '+=' | '-=' | '*=' | '/=' | '%=' | '~=' | '|=' | '&=' | '^=' |
    '!' | '['']'('=')? | '..' | 'has' | '.' ('=')? | 'for' | 'as' | '==' | '!=' | '<' | '<=' | '>' | '>='
;

ConstructorDeclaration returns ConstructorDeclaration:
    'zenConstructor' '('
        (parameters+=ValueParameter (',' parameters+=ValueParameter)*)?
    ')' ';'?
;

ExpandDeclaration returns ExpandDeclaration:
    'expand' typeRef=TypeReference '{' 
        members+=ExpandMemberDeclaration*
    '}'
;

ExpandMemberDeclaration returns ExpandMemberDeclaration:
    FieldDeclaration | FunctionDeclaration | OperatorFunctionDeclaration
;

VariableDeclaration returns VariableDeclaration:
    prefix=('global' | 'static' | 'var' | 'val') name=ID 'as' typeRef=TypeReference ('=' initializer=LiteralExpression)? ';'?
;

LiteralExpression returns Expression:
    StringLiteral  | NumberLiteralExpression | BooleanLiteral  | NullLiteral
;

NumberLiteralExpression returns Expression:
    '-' NumberLiteral | 
    NumberLiteral
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

NullLiteral returns NullLiteral:
    value='null'
;

DefaultExpression returns DefaultExpression:
    value='default'
;

//region TypeReference
Type returns TypeReference:
    UnionType
;

UnionType returns TypeReference:
    IntersectionType ({UnionTypeReference.values+=current} ('|' values+=IntersectionType)+)?
;

IntersectionType returns TypeReference:
    TypeReference ({IntersectionTypeReference.values+=current} ('&' values+=TypeReference)+)?
;

CompoundType returns TypeReference:
    TypeReference ({CompoundTypeReference.values+=current} (',' values+=TypeReference)+)?
;

TypeReference returns TypeReference:
    PrimaryType ('['(
        ({MapTypeReference.value=current} key=TypeReference ']' ('$' orderly?='orderly')?) |
        ({ArrayTypeReference.value=current} ']')
    ) )*
;

fragment PrimaryType returns TypeReference:
    ListType | FunctionType | ParenthesizedType | NamedType
;

ParenthesizedType returns ParenthesizedTypeReference:
    '(' value=TypeReference ')'
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
    | 'orderly'
    | 'package'
    | 'extends'
    | 'operator'
    | 'default'
    | 'lambda'
    | 'expand'
;
