/**
 * AI Training Module Exports
 */

export {
    // Types
    type TrainingExample,
    type TrainingDataset,
    type ModelVersion,
    type ModelMetrics,
    type TrainingConfig,
    type CostOptimization,
    type CostRecommendation,
    type PerformanceMetrics,

    // Classes
    TrainingDataCollector,
    ModelVersionManager,
    CostOptimizer,
    PerformanceOptimizer,

    // Singletons
    getTrainingDataCollector,
    getModelVersionManager,
    getCostOptimizer,
    getPerformanceOptimizer,
} from './ai-training-pipeline.js';
