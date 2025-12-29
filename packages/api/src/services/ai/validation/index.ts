/**
 * AI Validation Module Exports
 */

export {
    // Types
    type ValidationResult,
    type ValidationError,
    type ValidationWarning,
    type ValidationMetadata,
    type ValidationRule,

    // Rules
    SYNTAX_RULES,
    TYPE_RULES,
    SECURITY_RULES,
    BEST_PRACTICE_RULES,

    // Class
    OutputValidator,

    // Singleton
    getOutputValidator,
} from './output-validator.js';
