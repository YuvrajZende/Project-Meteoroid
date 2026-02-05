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

// Agent adapters - kept at root level for backward compatibility
// Import from ../adapters/ directly if needed
