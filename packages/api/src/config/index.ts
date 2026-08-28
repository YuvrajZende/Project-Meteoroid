/**
 * Configuration module exports
 */

export { env, isProduction, isDevelopment, isTest } from './env.js';
export type { Env } from './env.js';

// Phase 14: Tech Stack Constraints
export {
    TECH_STACK_PRESETS,
    FRAMEWORK_PATTERNS,
    detectStackType,
    getStackPreset,
    validateTechChoice,
    getStackConstraints,
    generateConstraintPrompt,
    getStackDependencies
} from './stack-constraints.js';

export type {
    StackPresetType,
    StackPreset,
    StackConstraint,
    DatabaseConfig,
    BackendConfig,
    FrontendConfig,
    AuthConfig as StackAuthConfig,
    SecurityConfig as StackSecurityConfig,
    MonitoringConfig as StackMonitoringConfig,
    QueueConfig,
    TestingConfig
} from './stack-constraints.js';
