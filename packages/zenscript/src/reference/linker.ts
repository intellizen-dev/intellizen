import type { ZenScriptServices } from '../module'
import { DefaultLinker } from 'langium'

export class ZenScriptLinker extends DefaultLinker {
  constructor(services: ZenScriptServices) {
    super(services)
  }
}
