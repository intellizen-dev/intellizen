import type { ValidationAcceptor, ValidationChecks } from 'langium'
import type { ClassDeclaration, ZenScriptAstType } from '../generated/ast'
import type { ZenScriptServices } from '../module'

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: ZenScriptServices) {
  const registry = services.validation.ValidationRegistry
  const validator = services.validation.Validator
  const checks: ValidationChecks<ZenScriptAstType> = {
    ClassDeclaration: validator.checkClassStartsWithCapital,
  }
  registry.register(checks, validator)
}

/**
 * Implementation of custom validations.
 */
export class ZenScriptValidator {
  checkClassStartsWithCapital(clazz: ClassDeclaration, accept: ValidationAcceptor): void {
    if (clazz.name) {
      const firstChar = clazz.name.substring(0, 1)
      if (firstChar.toUpperCase() !== firstChar) {
        accept('warning', 'Class name should start with a capital.', { node: clazz, property: 'name' })
      }
    }
  }
}
