grammar ZenScript

import "./grammar/interfaces"
import "./grammar/zs"
import "./grammar/dzs";

entry ZenScript returns Script:
    (
        package=PackageDeclaration
        ( imports+=ImportDeclaration
        | functions+=DZSFunctionDeclaration
        | expands+=(DZSExpandDeclaration | DZSExpandFunctionDeclaration)
        | classes+=DZSClassDeclaration
        | statements+=DZSVariableDeclaration
        )*
    )|
    ZenScriptEntry
;