/**
 * API Agent Module Exports
 */

export {
    APIAgent,
    getAPIAgent,
    apiAgentInstance,
    type APIAgentConfig,
    type APIFramework,
    type APIType,
    type HTTPMethod,
    type AuthType,
    type EndpointDefinition,
    type SchemaDefinition,
    type PropertyDefinition,
    type ParameterDefinition,
    type RateLimitConfig,
    type RouterDefinition,
    type APIGeneratedFile,
    type APIGenerationResult,
} from './api-agent.js';

export {
    APIAgentWrapper,
    getAPIAgentWrapper,
    apiAgentIAgent,
} from './api-agent-iagent.js';

export default apiAgentIAgent;
