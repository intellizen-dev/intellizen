import "./interfaces"



ImportDeclaration returns ImportDeclaration:
    'import' path+=[NamedElement:ID] ('.' path+=[NamedElement:ID])* ('as' alias=ID)? ';'?
;



//region TypeReference

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

// dzs extend

ExtendTypeReference returns TypeReference:
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

//endregion TypeReference

// region Literal


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

// endregion Literal


// Soft keywords
ID returns string:
    IDENTIFIER
    | 'to'
    | 'extends'  // dzs
    | 'operator' // dzs
    | 'default'  // dzs
    | 'lambda'   // dzs
    | 'expand'   // dzs
    | 'orderly'  // zenutils
;

hidden terminal WHITE_SPACE: /\s+/;
terminal IDENTIFIER: /[_a-zA-Z][\w_]*/;
terminal FLOATING: /[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?[fFdD]?/;
terminal INTEGER: /(0[xX][0-9a-fA-F]+|[0-9]+)[lL]?/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal BLOCK_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal LINE_COMMENT: /\/\/[^\n\r]*/;
hidden terminal PREPROCESSOR: /#[^\n\r]*/;