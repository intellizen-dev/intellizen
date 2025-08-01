grammar ZenScriptDeclaration

type NamedElement = Script | ImportDeclaration | VariableDeclaration | ClassDeclaration | FieldDeclaration | FunctionDeclaration | ValueParameter | TypeParameter;

entry ZenScriptDeclaration infers Script:
    package=PackageDeclaration?
    ( imports+=ImportDeclaration
    | functions+=FunctionDeclaration
    | expands+=ExpandDeclaration
    | classes+=ClassDeclaration
    | statements+=VariableDeclaration
    )*
;

PackageDeclaration:
    'package' path+=ID ('.' path+=ID )* ';'?
;

ImportDeclaration:
    'import' path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])* ('as' alias=ID)? ';'?
;

ClassDeclaration:
    'zenClass' name=ID 
    ('<' typeParams+=TypeParameter (',' typeParams+=TypeParameter)* '>')?
    ('extends' (superTypes+=NamedType (',' superTypes+=NamedType)*))?
    ('{' members+=(FunctionDeclaration | FieldDeclaration | OperatorFunctionDeclaration)* '}')?
;

FieldDeclaration:
    prefix=('static' | 'var' | 'val') name=ID 'as' type=Type ('=' initializer=Expression)? ';'?
;

ValueParameter:
    (varargs?='...')? name=ID 'as' type=Type ('=' defaultValue=(DefaultExpression | Expression))?
;

TypeParameter:
    name=ID
;

FunctionDeclaration:
    prefix=('static' | 'global' | 'lambda')? 'function' name=ID? '('
        (params+=ValueParameter (',' params+=ValueParameter)*)?
    ')' 'as' retType=Type ';'?
;

OperatorFunctionDeclaration:
    'operator' op=Operator '('
        (params+=ValueParameter (',' params+=ValueParameter)*)?
    ')' 'as' retType=CompoundType ';'?
;

Operator returns string:
    '+' | '-' | '*' | '/' | '%' | '~' | '|' | '&' | '^' |
    '+=' | '-=' | '*=' | '/=' | '%=' | '~=' | '|=' | '&=' | '^=' |
    '!' | '['']'('=')? | '..' | 'has' | '.' ('=')? | 'for' | 'as' | '==' | '!=' | '<' | '<=' | '>' | '>='
;

ExpandDeclaration:
    'expand' type=Type '{' 
        members+=(FieldDeclaration | FunctionDeclaration | OperatorFunctionDeclaration)*
    '}'
;

VariableDeclaration:
    prefix=('global' | 'static' | 'var' | 'val') name=ID 'as' type=Type ('=' initializer=LiteralExpression)? ';'?
;

Expression:
    PrefixExpression
;

PrefixExpression:
    ({infer PrefixExpression} op=('-') expr=PrefixExpression) | LiteralExpression
;

LiteralExpression:
    StringLiteral | IntegerLiteral | FloatLiteral | BooleanLiteral | NullLiteral
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

NullLiteral:
    value='null'
;

DefaultExpression:
    value='default'
;

//region Type
Type:
    PrimaryType ('['(
        ({infer MapType.value=current} key=Type ']') |
        ({infer ArrayType.value=current} ']')
    ) )*
;

fragment PrimaryType:
    ListType | FunctionType | ParenthesizedType | NamedType
;

ParenthesizedType:
    '(' value=Type ')'
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
    path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])* ('<' typeArgs+=NamedType (',' typeArgs+=NamedType)* '>')?
;

CompoundType:
    Type ({infer CompoundType.values+=current} (',' values+=Type)+)?
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

hidden terminal WHITE_SPACE: /\s+/;
terminal IDENTIFIER: /[_a-zA-Z][\w_]*/;
terminal FLOAT: /[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?[fFdD]?/;
terminal INTEGER: /(0[xX][0-9a-fA-F]+|[0-9]+)[lL]?/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal BLOCK_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal LINE_COMMENT: /\/\/[^\n\r]*/;
hidden terminal PREPROCESSOR: /#[^\n\r]*/;
