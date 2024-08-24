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
    'import' package=QualifiedName ('as' alias=ID)? ';'
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

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
