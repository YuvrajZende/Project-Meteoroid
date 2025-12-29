/**
 * Agent Services  
 * Agent coordination, loading, and management
 */

export {
    AgentCoordinator,
    getAgentCoordinator,
} from './agent-coordinator.js';

export {
    AgentLoader,
    createAgentLoader,
} from './agent-loader.js';

export {
    getAgentConstraints,
    getAgentConstraints as getAgentStackConstraints, // Alias for backward compatibility
} from './agent-stack-constraints.js';

// Queue Agent Service (Person 2's Implementation)
export {
    QueueAgentService,
    getQueueAgentService,
    isQueueRelatedPrompt,
    extractQueueCapabilities,
    type QueueGenerationRequest,
    type QueueGeneratedFile,
    type QueueGenerationResult,
} from './queue-agent-service.js';

// Test Agent Service (Person 2's Implementation)
export {
    TestAgentService,
    getTestAgentService,
    isTestRelatedPrompt,
    extractTestCapabilities,
    type TestGenerationRequest,
    type TestGeneratedFile,
    type TestGenerationResult,
} from './test-agent-service.js';

// Agent adapters - kept at root level for backward compatibility
// Import from ../adapters/ directly if needed

