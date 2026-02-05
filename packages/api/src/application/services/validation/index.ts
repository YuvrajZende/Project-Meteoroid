/**
 * Validation Services
 * Code validation, post-processing, and integrity checking
 */

export {
    CodePostProcessor,
    getCodePostProcessor,
    type GeneratedFile,
    type ProcessedOutput,
} from './code-postprocessor.js';

export {
    CodeValidator,
    getCodeValidator,
} from './code-validator.js';

export {
    ProjectIntegrityValidator,
    getProjectIntegrityValidator,
    type ValidationReport,
    type ValidationIssue,
} from './project-integrity-validator.js';
