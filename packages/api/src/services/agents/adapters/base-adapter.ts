/**
 * Base Service Adapter
 * Phase 21: Service Integration Framework
 * 
 * Abstract base class for all service adapters.
 * Each service implements its own adapter extending this class.
 */

import { AdapterTestResult, AdapterCodeGenerationContext, CodeTemplate } from '../../service-registry/types.js';

export abstract class BaseAdapter {
    constructor(public readonly serviceId: string) { }

    /**
     * Test the connection with provided credentials
     */
    abstract test(credentials: Record<string, string>): Promise<AdapterTestResult>;

    /**
     * Generate code template for a specific operation
     */
    abstract generateCodeTemplate(
        operation: string,
        context: AdapterCodeGenerationContext
    ): string;

    /**
     * Get all available code templates
     */
    abstract getCodeTemplates(): Record<string, CodeTemplate>;

    /**
     * Get agent instructions for using this service
     */
    abstract getAgentInstructions(): string;

    /**
     * Get environment variable names for this service
     */
    abstract getEnvVarNames(): string[];
}

export { BaseAdapter as default };
