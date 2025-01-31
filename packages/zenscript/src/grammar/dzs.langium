import "./interfaces";
import "./common";


DZSEntry returns Script:
    // dzs since expand will be ambiguous with expression, assuming dzs must be started with package
    package=PackageDeclaration
        ( imports+=ImportDeclaration
        | functions+=DZSFunctionDeclaration
        | expands+=(DZSExpandDeclaration | DZSExpandFunctionDeclaration)
        | classes+=DZSClassDeclaration
        | statements+=DZSVariableDeclaration
        )*
    EOF
;


PackageDeclaration returns PackageDeclaration:
    'package' (path+=ID ('.' path+=ID )*)? ';'
;


DZSClassDeclaration returns ClassDeclaration:
    'zenClass' name=ID ('<' typeParameters+=DZSTypeParameter (',' typeParameters+=DZSTypeParameter)* '>')?
    ('extends' (superTypes+=NamedType (',' superTypes+=NamedType)*))?
    ('{'
        members+=DZSClassMemberDeclaration*
    '}')?
;

DZSClassMemberDeclaration returns ClassMemberDeclaration:
    DZSFunctionDeclaration | DZSFieldDeclaration | DZSConstructorDeclaration | DZSOperatorFunctionDeclaration;

DZSFieldDeclaration returns FieldDeclaration:
    prefix=('static' | 'var'|'val') name=ID ('as' typeRef=ExtendTypeReference)? ('=' initializer=DZSLiteralExpression)? ';'
;

DZSValueParameter returns ValueParameter:
    (varargs?='...')? name=ID ('as' typeRef=ExtendTypeReference)? ('=' defaultValue=('default' | DZSLiteralExpression))?
;

DZSTypeParameter returns TypeParameter:
    name=ID
;

DZSFunctionDeclaration returns FunctionDeclaration:
    prefix=('static' | 'global' | 'lambda')? 'function' name=ID? '('
        (parameters+=DZSValueParameter (',' parameters+=DZSValueParameter)*)?
    ')' ('as' returnTypeRef=ExtendTypeReference) ';'
;

DZSExpandFunctionDeclaration returns ExpandFunctionDeclaration:
    '$expand' typeRef=ExtendTypeReference '$' name=ID  '('
        (parameters+=DZSValueParameter (',' parameters+=DZSValueParameter)*)?
    ')' ('as' returnTypeRef=ExtendTypeReference) ';'
;

DZSOperatorFunctionDeclaration returns OperatorFunctionDeclaration:
    'operator' op=Operator '('
        (parameters+=DZSValueParameter (',' parameters+=DZSValueParameter)*)?
    ')' ('as' returnTypeRef=CompoundType) ';'
;

Operator returns string:
    '+' | '-' | '*' | '/' | '%' | '~' | '|' | '&' | '^'
    | '+=' | '-=' | '*=' | '/=' | '%=' | '~=' | '|=' | '&=' | '^='
    | '!' | '['']'('=')? | '..' | 'has' | '.' ('=')? | 'for' | 'as' | '==' | '!=' | '<' | '<=' | '>' | '>='
;

DZSConstructorDeclaration returns ConstructorDeclaration:
    'zenConstructor' '('
        (parameters+=DZSValueParameter (',' parameters+=DZSValueParameter)*)?
    ')' ';'
;

DZSExpandDeclaration returns ExpandDeclaration:
    'expand' typeRef=TypeReference '{' 
        members+=DZSExpandMemberDeclaration*
    '}'
;

DZSExpandMemberDeclaration returns ExpandMemberDeclaration:
    DZSFieldDeclaration | DZSFunctionDeclaration | DZSOperatorFunctionDeclaration
;


DZSVariableDeclaration returns VariableDeclaration:
    prefix=('global' | 'static' | 'var' | 'val') name=ID ('as' typeRef=TypeReference)? ('=' initializer=DZSLiteralExpression)? ';'
;


DZSLiteralExpression returns Expression:
    StringLiteral  | DZSNumberLiteralExpression | BooleanLiteral  | NullLiteral
;

DZSNumberLiteralExpression returns Expression:
    '-' NumberLiteral | 
    NumberLiteral
;