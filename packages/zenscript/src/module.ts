import type { Module } from 'langium'
import { inject } from 'langium'
import type { DefaultSharedModuleContext, LangiumServices, LangiumSharedServices, PartialLangiumServices, PartialLangiumSharedServices } from 'langium/lsp'
import { createDefaultModule, createDefaultSharedModule } from 'langium/lsp'
import { ZenScriptGeneratedModule, ZenScriptGeneratedSharedModule } from './generated/module'
import { ZenScriptScopeProvider } from './scoping/scope-provider'
import { ZenScriptScopeComputation } from './scoping/scope-computation'
import { CustomTokenBuilder } from './lexer/token-builder'
import { CustomValueConverter } from './lexer/value-converter'
import { ZenScriptNameProvider } from './name'
import { ZenScriptTypeComputer } from './typing/infer'
import { ZenScriptCompletionProvider } from './lsp/completion'
import { ZenScriptValidator, registerValidationChecks } from './validation/validator'
import { ZenScriptPackageManager } from './workspace/package-manager'
import { ZenScriptMemberProvider } from './scoping/member-provider'
import { ZenScriptWorkspaceManager } from './workspace/workspace-manager'
import { ZenScriptConfigurationManager } from './workspace/configuration-manager'

/**
 * Declaration of custom services - add your own service classes here.
 */
export interface ZenScriptAddedServices {
  validation: {
    Validator: ZenScriptValidator
  }
  references: {
    MemberProvider: ZenScriptMemberProvider
  }
  typing: {
    TypeComputer: ZenScriptTypeComputer
  }
  workspace: {
    PackageManager: ZenScriptPackageManager
  }
}

export interface ZenScriptAddedSharedServices {
  workspace: {
    WorkspaceManager: ZenScriptWorkspaceManager
    ConfigurationManager: ZenScriptConfigurationManager
  }
}

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
export type ZenScriptServices = LangiumServices & ZenScriptAddedServices & { shared: ZenScriptSharedServices }

export type ZenScriptSharedServices = LangiumSharedServices & ZenScriptAddedSharedServices

/**
 * Dependency injection module that overrides Langium default services and contributes the
 * declared custom services. The Langium defaults can be partially specified to override only
 * selected services, while the custom services must be fully specified.
 */
export const ZenScriptModule: Module<ZenScriptServices, PartialLangiumServices & ZenScriptAddedServices> = {
  validation: {
    Validator: () => new ZenScriptValidator(),
  },
  references: {
    NameProvider: () => new ZenScriptNameProvider(),
    ScopeComputation: services => new ZenScriptScopeComputation(services),
    ScopeProvider: services => new ZenScriptScopeProvider(services),
    MemberProvider: services => new ZenScriptMemberProvider(services),
  },
  workspace: {
    PackageManager: services => new ZenScriptPackageManager(services),
  },
  parser: {
    TokenBuilder: () => new CustomTokenBuilder(),
    ValueConverter: () => new CustomValueConverter(),
  },
  typing: {
    TypeComputer: services => new ZenScriptTypeComputer(services),
  },
  lsp: {
    CompletionProvider: services => new ZenScriptCompletionProvider(services),
  },
}

export const ZenScriptSharedModule: Module<ZenScriptSharedServices, PartialLangiumSharedServices & ZenScriptAddedSharedServices> = {
  workspace: {
    WorkspaceManager: services => new ZenScriptWorkspaceManager(services),
    ConfigurationManager: services => new ZenScriptConfigurationManager(services),
  },
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
export function createZenScriptServices(context: DefaultSharedModuleContext): ZenScriptServices {
  const shared = inject(
    createDefaultSharedModule(context),
    ZenScriptGeneratedSharedModule,
    ZenScriptSharedModule,
  )
  const zenscript = inject(
    createDefaultModule({ shared }),
    ZenScriptGeneratedModule,
    ZenScriptModule,
  )
  shared.ServiceRegistry.register(zenscript)
  registerValidationChecks(zenscript)
  if (!context.connection) {
    // We don't run inside a language server
    // Therefore, initialize the configuration provider instantly
    shared.workspace.ConfigurationProvider.initialized({})
  }
  return zenscript
}
