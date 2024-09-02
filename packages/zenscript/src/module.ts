import { type Module, inject } from 'langium'
import { type DefaultSharedModuleContext, type LangiumServices, type LangiumSharedServices, type PartialLangiumServices, createDefaultModule, createDefaultSharedModule } from 'langium/lsp'
import { IntelliZenGeneratedModule, IntelliZenGeneratedSharedModule } from './generated/module'
import { IntelliZenValidator, registerValidationChecks } from './validator'
import { ZenScriptScopeComputation } from './scope'

/**
 * Declaration of custom services - add your own service classes here.
 */
export interface IntelliZenAddedServices {
  validation: {
    IntelliZenValidator: IntelliZenValidator
  }
}

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
export type IntelliZenServices = LangiumServices & IntelliZenAddedServices

/**
 * Dependency injection module that overrides Langium default services and contributes the
 * declared custom services. The Langium defaults can be partially specified to override only
 * selected services, while the custom services must be fully specified.
 */
export const IntelliZenModule: Module<IntelliZenServices, PartialLangiumServices & IntelliZenAddedServices> = {
  validation: {
    IntelliZenValidator: () => new IntelliZenValidator(),
  },

  references: {
    ScopeComputation: (services) => new ZenScriptScopeComputation(services),
  }
}

/**
 * Create the full set of services required by Langium.
 *
 * First inject the shared services by merging two modules:
 *  - Langium default shared services
 *  - Services generated by langium-cli
 *
 * Then inject the language-specific services by merging three modules:
 *  - Langium default language-specific services
 *  - Services generated by langium-cli
 *  - Services specified in this file
 *
 * @param context Optional module context with the LSP connection
 * @returns An object wrapping the shared services and the language-specific services
 */
export function createIntelliZenServices(context: DefaultSharedModuleContext): {
  shared: LangiumSharedServices
  IntelliZen: IntelliZenServices
} {
  const shared = inject(
    createDefaultSharedModule(context),
    IntelliZenGeneratedSharedModule,
  )
  const IntelliZen = inject(
    createDefaultModule({ shared }),
    IntelliZenGeneratedModule,
    IntelliZenModule,
  )
  shared.ServiceRegistry.register(IntelliZen)
  registerValidationChecks(IntelliZen)
  if (!context.connection) {
    // We don't run inside a language server
    // Therefore, initialize the configuration provider instantly
    shared.workspace.ConfigurationProvider.initialized({})
  }
  return { shared, IntelliZen }
}
