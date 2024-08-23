import type { ValidationAcceptor, ValidationChecks } from 'langium'
import type { IntelliZenAstType, Person } from './generated/ast'
import type { IntelliZenServices } from './module'

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: IntelliZenServices) {
  const registry = services.validation.ValidationRegistry
  const validator = services.validation.IntelliZenValidator
  const checks: ValidationChecks<IntelliZenAstType> = {
    Person: validator.checkPersonStartsWithCapital,
  }
  registry.register(checks, validator)
}

/**
 * Implementation of custom validations.
 */
export class IntelliZenValidator {
  checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
    if (person.name) {
      const firstChar = person.name.substring(0, 1)
      if (firstChar.toUpperCase() !== firstChar) {
        accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' })
      }
    }
  }
}
