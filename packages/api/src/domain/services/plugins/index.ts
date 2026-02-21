/**
 * Plugins Module - Phase 28
 * Backend-aware plugin registry with validation, connectivity testing, and context building
 */

export {
    PluginRegistryService,
    getPluginRegistry,
    type PluginDefinition,
    type PluginCategory,
    type PluginCredentialField,
    type PluginConfig,
    type PluginValidationResult,
    type PluginConnectionTestResult,
    type ContextTreeNode,
    type PluginContextResult,
} from './plugin-registry.js';
