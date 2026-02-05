/**
 * Architecture Services
 * Project architecture, blueprints, and scaffolding
 */

export {
    ArchitectureBlueprintGenerator,
    getArchitectureBlueprintGenerator,
    type ArchitectureBlueprint,
} from './architecture-blueprint.js';

export {
    ArchitectureKnowledgeService,
    getArchitectureKnowledge,
} from './architecture-knowledge.js';

export {
    createProjectScaffold,
    type ScaffoldConfig,
    type ScaffoldResult,
} from './project-scaffold.js';
