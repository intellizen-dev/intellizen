grammar ZenScript

import "./grammar/interfaces"
import "./grammar/common"

entry ZenScriptEntry returns Script:
    imports+=ImportDeclaration*
;