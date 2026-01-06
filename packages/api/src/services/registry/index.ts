/**
 * Registry Services
 * All registries: dependencies, imports, agents, models, services
 */

export {
    DependencyRegistry,
    getDependencyRegistry,
    type DependencyMapping,
    type PackageJson,
    type DependencyAnalysis,
} from './dependency-registry.js';

export {
    ImportRegistry,
    getImportRegistry,
    type ImportStatement,
    type ImportConflict,
    type DeduplicationResult,
} from './import-registry.js';

export {
    AgentRegistry,
    getAgentRegistry,
} from './agent-registry.js';

// Model registry exports the config directly
export {
    MODEL_REGISTRY,
    getModel,
    getModelsByTier,
    getModelsByProvider,
    type ModelConfig,
} from './model-registry.js';

// Service File Generator (auto-generates missing service files)
export {
    ServiceFileGenerator,
    getServiceFileGenerator,
    createServiceFileGenerator,
} from './service-file-generator.js';

// Service Registry (third-party integrations)
export * from '../service-registry/index.js';
