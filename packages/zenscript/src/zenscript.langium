grammar ZenScript

import "./grammar/interfaces"
import "./grammar/zs"
import "./grammar/dzs";

entry ZenScript returns Script:
    ZenScriptEntry | DZSEntry;