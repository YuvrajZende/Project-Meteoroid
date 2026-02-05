/**
 * Learning Services
 * AI learning, vector storage, and pattern recognition
 */

export {
    LearningService,
    getLearningService,
    type LearningConfig,
    type LearnedPattern,
    type GenerationIteration,
    type TestingIteration,
    type PreContext,
} from './learning-service.js';

export {
    VectorStoreService,
    getVectorStore,
    createVectorStore,
    type VectorStoreConfig,
    type CodeChunk,
    type EmbeddedChunk,
    type SimilarityResult,
    type IndexingResult,
    type SearchOptions,
} from './vector-store.js';

export {
    VectorLearningSystem,
    getVectorLearningSystem,
    type VectorLearningContext,
} from './vector-learning-system.js';

export {
    EnhancedLearningContextBuilder,
    getEnhancedLearningContextBuilder,
    type LearningContext,
} from './enhanced-learning-context.js';
