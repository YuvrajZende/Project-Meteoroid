/**
 * Dependency Injection Container
 * Phase 1: Dependency Injection - Step 1.1
 *
 * This container manages all service dependencies and enables:
 * - Request-scoped services (automatic cleanup)
 * - Easy testing (mock injection)
 * - No more singleton pattern
 * - Proper dependency management
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { createLogger } from '../infrastructure/logger.js';

const logger = createLogger('DIContainer');

// ============================================
// SERVICE IDENTIFIERS
// ============================================
export const TYPES = {
    // Database Layer
    Database: Symbol.for('Database'),
    ProjectRepository: Symbol.for('ProjectRepository'),
    TaskRepository: Symbol.for('TaskRepository'),
    AuditRepository: Symbol.for('AuditRepository'),
    UserRepository: Symbol.for('UserRepository'),
    GenerationIterationRepository: Symbol.for('GenerationIterationRepository'),
    TestingIterationRepository: Symbol.for('TestingIterationRepository'),
    LearnedPatternRepository: Symbol.for('LearnedPatternRepository'),
    ProjectContextRepository: Symbol.for('ProjectContextRepository'),

    // AI Services
    AIClient: Symbol.for('AIClient'),
    MultiModelOrchestrator: Symbol.for('MultiModelOrchestrator'),
    CodeGenerator: Symbol.for('CodeGenerator'),
    EnhancedCodeGenerator: Symbol.for('EnhancedCodeGenerator'),

    // Context Services (Request Scoped)
    ContextManager: Symbol.for('ContextManager'),
    LearningService: Symbol.for('LearningService'),
    VectorStore: Symbol.for('VectorStore'),
    GenerationContext: Symbol.for('GenerationContext'),

    // Interfaces
    IVectorStore: Symbol.for('IVectorStore'),
    ILearningService: Symbol.for('ILearningService'),

    // Infrastructure
    FileWriter: Symbol.for('FileWriter'),
    KeyManager: Symbol.for('KeyManager'),
    CostTracker: Symbol.for('CostTracker'),

    // Analysis Services
    QualityAssessment: Symbol.for('QualityAssessment'),
    IntentClassifier: Symbol.for('IntentClassifier'),
    EntityExtractor: Symbol.for('EntityExtractor'),

    // Orchestration
    Orchestrator: Symbol.for('Orchestrator'),
    AgentCoordinator: Symbol.for('AgentCoordinator'),
    PlanningService: Symbol.for('PlanningService'),
    GenerationService: Symbol.for('GenerationService'),
    ValidationService: Symbol.for('ValidationService'),

    // Architecture Services
    ArchitectureKnowledge: Symbol.for('ArchitectureKnowledge'),
    ProjectScaffold: Symbol.for('ProjectScaffold'),

    // Monitoring
    AgentMonitor: Symbol.for('AgentMonitor'),
    HealthMonitor: Symbol.for('HealthMonitor'),
};

// ============================================
// DI CONTAINER
// ============================================
export class DIContainer {
    private container: Container;

    constructor() {
        this.container = new Container();
        this.bindings();
    }

    private bindings(): void {
        logger.info('Initializing bindings...');

        // Lazy import repositories inside bindings to avoid circular dependency
        // These imports happen AFTER TYPES is defined and exported
        const { ProjectRepository } = require('../repositories/project.repository.js');
        const { TaskRepository } = require('../repositories/task.repository.js');
        const { AuditRepository } = require('../repositories/audit.repository.js');
        const { UserRepository } = require('../repositories/user.repository.js');
        const { GenerationIterationRepository } = require('../repositories/generation-iteration.repository.js');
        const { TestingIterationRepository } = require('../repositories/testing-iteration.repository.js');
        const { LearnedPatternRepository } = require('../repositories/learned-pattern.repository.js');
        const { ProjectContextRepository } = require('../repositories/project-context.repository.js');

        // Lazy import other services
        const { SupabaseDatabase } = require('../infrastructure/database/supabase-database.js');
        const { AIClient } = require('../infrastructure/ai-client.js');
        const { MultiModelOrchestrator } = require('../application/services/orchestration/multi-model-orchestrator.js');
        const { EnhancedCodeGenerator } = require('../application/services/generation/enhanced-code-generator.js');
        const { ContextManager } = require('../domain/services/context/context-manager.js');
        const { LearningService } = require('../domain/services/learning/learning-service.js');
        const { VectorStoreService } = require('../domain/services/learning/vector-store.js');
        const { GenerationContextService } = require('../domain/services/context/generation-context.js');
        const { FileWriterService } = require('../infrastructure/file-writer.js');
        const { KeyManager } = require('../infrastructure/key-manager.js');
        const { CostTrackerService } = require('../infrastructure/cost-tracker.js');
        const { QualityAssessmentService } = require('../domain/services/analysis/quality-assessment.js');
        const { IntentClassifier } = require('../domain/services/analysis/intent-classifier.js');
        const { EntityExtractorService } = require('../domain/services/analysis/entity-extractor.js');
        const { PlanningService } = require('../application/services/orchestration/planning-service.js');
        const { GenerationService } = require('../application/services/orchestration/generation-service.js');
        const { ValidationService } = require('../application/services/orchestration/validation-service.js');
        const { OrchestrationService } = require('../application/services/orchestration/orchestration-service.js');
        const { ArchitectureKnowledgeService } = require('../domain/services/architecture/architecture-knowledge.js');
        const { ProjectScaffoldGenerator } = require('../domain/services/architecture/project-scaffold.js');
        // Monitoring services - not implemented yet
        // const { AgentMonitor } = require('../services/monitoring/agent-monitor.js');
        // const { HealthMonitor } = require('../services/monitoring/health-monitor.js');

        // ============================================
        // DATABASE LAYER
        // ============================================
        this.container.bind(TYPES.Database).to(SupabaseDatabase).inSingletonScope();
        this.container.bind(TYPES.ProjectRepository).to(ProjectRepository).inTransientScope();
        this.container.bind(TYPES.TaskRepository).to(TaskRepository).inTransientScope();
        this.container.bind(TYPES.AuditRepository).to(AuditRepository).inTransientScope();
        this.container.bind(TYPES.UserRepository).to(UserRepository).inTransientScope();
        this.container.bind(TYPES.GenerationIterationRepository).to(GenerationIterationRepository).inTransientScope();
        this.container.bind(TYPES.TestingIterationRepository).to(TestingIterationRepository).inTransientScope();
        this.container.bind(TYPES.LearnedPatternRepository).to(LearnedPatternRepository).inTransientScope();
        this.container.bind(TYPES.ProjectContextRepository).to(ProjectContextRepository).inTransientScope();

        // ============================================
        // AI SERVICES
        // ============================================
        this.container.bind(TYPES.AIClient).to(AIClient).inSingletonScope();
        this.container.bind(TYPES.MultiModelOrchestrator).to(MultiModelOrchestrator).inSingletonScope();
        this.container.bind(TYPES.CodeGenerator).to(EnhancedCodeGenerator).inTransientScope();

        // ============================================
        // CONTEXT SERVICES (REQUEST SCOPED)
        // ============================================
        this.container.bind(TYPES.ContextManager).to(ContextManager).inTransientScope();
        this.container.bind(TYPES.LearningService).to(LearningService).inTransientScope();
        this.container.bind(TYPES.VectorStore).to(VectorStoreService).inSingletonScope();
        this.container.bind(TYPES.GenerationContext).to(GenerationContextService).inTransientScope();

        // ============================================
        // INFRASTRUCTURE
        // ============================================
        this.container.bind(TYPES.FileWriter).to(FileWriterService).inSingletonScope();
        this.container.bind(TYPES.KeyManager).to(KeyManager).inSingletonScope();
        this.container.bind(TYPES.CostTracker).to(CostTrackerService).inSingletonScope();

        // ============================================
        // ANALYSIS SERVICES
        // ============================================
        this.container.bind(TYPES.QualityAssessment).to(QualityAssessmentService).inTransientScope();
        this.container.bind(TYPES.IntentClassifier).to(IntentClassifier).inTransientScope();
        this.container.bind(TYPES.EntityExtractor).to(EntityExtractorService).inTransientScope();

        // ============================================
        // ORCHESTRATION SERVICES
        // ============================================
        this.container.bind(TYPES.PlanningService).to(PlanningService).inTransientScope();
        this.container.bind(TYPES.GenerationService).to(GenerationService).inTransientScope();
        this.container.bind(TYPES.ValidationService).to(ValidationService).inTransientScope();
        this.container.bind(TYPES.Orchestrator).to(OrchestrationService).inTransientScope();
        // AgentCoordinator - placeholder for now
        // this.container.bind(TYPES.AgentCoordinator).to(AgentCoordinator).inSingletonScope();

        // ============================================
        // ARCHITECTURE SERVICES
        // ============================================
        this.container.bind(TYPES.ArchitectureKnowledge).to(ArchitectureKnowledgeService).inSingletonScope();
        this.container.bind(TYPES.ProjectScaffold).to(ProjectScaffoldGenerator).inSingletonScope();

        // ============================================
        // MONITORING
        // ============================================
        // Monitoring services not implemented yet
        // this.container.bind(TYPES.AgentMonitor).to(AgentMonitor).inSingletonScope();
        // this.container.bind(TYPES.HealthMonitor).to(HealthMonitor).inSingletonScope();

        logger.info('All bindings initialized');
    }

    /**
     * Get a service from the container
     */
    get<T>(serviceIdentifier: symbol | string): T {
        return this.container.get<T>(serviceIdentifier);
    }

    /**
     * Create a request-scoped container wrapper
     *
     * Note: Since all our services use transientScope(), they're automatically
     * created fresh on each request. We use the parent container directly but
     * provide a cleanup method for consistency with the request-scoped pattern.
     */
    createRequestScope(): { get: <T>(serviceIdentifier: symbol | string) => T; cleanup: () => void } {
        const transientServices = new Set<symbol | string>();

        return {
            get: <T>(serviceIdentifier: symbol | string): T => {
                // Track services created during this request
                transientServices.add(serviceIdentifier);
                // Use parent container - transient services are created fresh
                return this.container.get<T>(serviceIdentifier);
            },
            cleanup: () => {
                // Clear tracking - transient services will be garbage collected
                transientServices.clear();
            },
        };
    }

    /**
     * Get the container instance (for testing)
     */
    getContainer(): Container {
        return this.container;
    }

    /**
     * Rebind a service (for testing)
     */
    rebind<T>(serviceIdentifier: symbol | string): void {
        this.container.rebind<T>(serviceIdentifier);
    }

    /**
     * Unbind all services (for cleanup)
     */
    unbindAll(): void {
        this.container.unbindAll();
    }

    /**
     * Check if a service is bound
     */
    isBound(serviceIdentifier: symbol | string): boolean {
        return this.container.isBound(serviceIdentifier);
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================
let diContainer: DIContainer | null = null;

/**
 * Initialize the DI container (call once at app startup)
 */
export function initDIContainer(): DIContainer {
    if (!diContainer) {
        logger.info('Creating new container instance');
        diContainer = new DIContainer();
    }
    return diContainer;
}

/**
 * Get the DI container instance
 * Throws if not initialized
 */
export function getDIContainer(): DIContainer {
    if (!diContainer) {
        throw new Error('DI Container not initialized. Call initDIContainer() first.');
    }
    return diContainer;
}

/**
 * Reset the DI container (for testing)
 */
export function resetDIContainer(): void {
    if (diContainer) {
        diContainer.unbindAll();
    }
    diContainer = null;
}
