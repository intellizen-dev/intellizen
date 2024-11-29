import type { Module } from 'langium'
import type { DefaultSharedModuleContext, LangiumServices, LangiumSharedServices, PartialLangiumServices, PartialLangiumSharedServices } from 'langium/lsp'
import { inject } from 'langium'
import { createDefaultModule, createDefaultSharedModule } from 'langium/lsp'
import { ZenScriptGeneratedModule, ZenScriptGeneratedSharedModule } from './generated/module'
import { CustomTokenBuilder } from './lexer/token-builder'
import { CustomValueConverter } from './lexer/value-converter'
import { ZenScriptCompletionProvider } from './lsp/completion-provider'
import { ZenScriptInlayHintProvider } from './lsp/inlay-hint-provider'
import { ZenScriptNodeKindProvider } from './lsp/node-kind-provider'
import { ZenScriptSemanticTokenProvider } from './lsp/semantic-token-provider'
import { AsyncParser } from './parser/async-parser'
import { ZenScriptDynamicProvider } from './reference/dynamic-provider'
import { ZenScriptMemberProvider } from './reference/member-provider'
import { ZenScriptNameProvider } from './reference/name-provider'
import { ZenScriptScopeComputation } from './reference/scope-computation'
import { ZenScriptScopeProvider } from './reference/scope-provider'
import { ZenScriptTypeComputer } from './typing/type-computer'
import { ZenScriptTypeFeatures } from './typing/type-features'
import { registerValidationChecks, ZenScriptValidator } from './validation/validator'
import { ZenScriptBracketManager } from './workspace/bracket-manager'
import { ZenScriptConfigurationManager } from './workspace/configuration-manager'
import { ZenScriptDescriptionCreator } from './workspace/description-creator'
import { ZenScriptDescriptionIndex } from './workspace/description-index'
import { ZenScriptPackageManager } from './workspace/package-manager'
import { ZenScriptWorkspaceManager } from './workspace/workspace-manager'

/**
 * Declaration of custom services - add your own service classes here.
 */
export interface ZenScriptAddedServices {
  validation: {
    Validator: ZenScriptValidator
  }
  references: {
    MemberProvider: ZenScriptMemberProvider
    DynamicProvider: ZenScriptDynamicProvider
  }
  typing: {
    TypeComputer: ZenScriptTypeComputer
    TypeFeatures: ZenScriptTypeFeatures
  }
  workspace: {
    PackageManager: ZenScriptPackageManager
    BracketManager: ZenScriptBracketManager
    DescriptionIndex: ZenScriptDescriptionIndex
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
    DynamicProvider: services => new ZenScriptDynamicProvider(services),
  },
  workspace: {
    AstNodeDescriptionProvider: services => new ZenScriptDescriptionCreator(services),
    PackageManager: services => new ZenScriptPackageManager(services),
    BracketManager: services => new ZenScriptBracketManager(services),
    DescriptionIndex: services => new ZenScriptDescriptionIndex(services),
  },
  parser: {
    TokenBuilder: () => new CustomTokenBuilder(),
    ValueConverter: () => new CustomValueConverter(),
    AsyncParser: services => new AsyncParser(services),
  },
  typing: {
    TypeComputer: services => new ZenScriptTypeComputer(services),
    TypeFeatures: services => new ZenScriptTypeFeatures(services),
  },
  lsp: {
    CompletionProvider: services => new ZenScriptCompletionProvider(services),
    InlayHintProvider: services => new ZenScriptInlayHintProvider(services),
    SemanticTokenProvider: services => new ZenScriptSemanticTokenProvider(services),
  },
}

export const ZenScriptSharedModule: Module<ZenScriptSharedServices, PartialLangiumSharedServices & ZenScriptAddedSharedServices> = {
  workspace: {
    WorkspaceManager: services => new ZenScriptWorkspaceManager(services),
    ConfigurationManager: services => new ZenScriptConfigurationManager(services),
  },
  lsp: {
    NodeKindProvider: () => new ZenScriptNodeKindProvider(),
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
