/**
 * Service Registry
 * Phase 21: Service Integration Framework
 * 
 * Central registry for all supported third-party services.
 * Manages service definitions, search, and retrieval.
 */

import {
    ServiceDefinition,
    ServiceCategory,
    RegistryStats,
    ServiceCategoryLabels
} from './types.js';

// ============================================================
// SERVICE REGISTRY CLASS
// ============================================================

export class ServiceRegistry {
    private services: Map<string, ServiceDefinition> = new Map();
    private initialized: boolean = false;

    constructor() {
        // Services will be loaded via loadDefaultServices()
    }

    /**
     * Initialize the registry with default services
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.loadDefaultServices();
        this.initialized = true;
    }

    /**
     * Register a new service definition
     */
    register(service: ServiceDefinition): void {
        if (this.services.has(service.id)) {
            console.warn(`[ServiceRegistry] Service '${service.id}' already registered, overwriting.`);
        }
        this.services.set(service.id, service);
    }

    /**
     * Register multiple services at once
     */
    registerMany(services: ServiceDefinition[]): void {
        for (const service of services) {
            this.register(service);
        }
    }

    /**
     * Get a service by ID
     */
    getService(id: string): ServiceDefinition | undefined {
        return this.services.get(id);
    }

    /**
     * Get all services in a category
     */
    getByCategory(category: ServiceCategory): ServiceDefinition[] {
        return Array.from(this.services.values())
            .filter(s => s.category === category)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Search services by query string
     * Searches name, description, capabilities, and tags
     */
    search(query: string): ServiceDefinition[] {
        const lowerQuery = query.toLowerCase().trim();

        if (!lowerQuery) {
            return this.getAllServices();
        }

        return Array.from(this.services.values())
            .filter(s =>
                s.name.toLowerCase().includes(lowerQuery) ||
                s.description.toLowerCase().includes(lowerQuery) ||
                s.capabilities.some(c => c.toLowerCase().includes(lowerQuery)) ||
                s.tags?.some(t => t.toLowerCase().includes(lowerQuery)) ||
                s.id.toLowerCase().includes(lowerQuery)
            )
            .sort((a, b) => {
                // Prioritize name matches
                const aNameMatch = a.name.toLowerCase().includes(lowerQuery);
                const bNameMatch = b.name.toLowerCase().includes(lowerQuery);
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                return a.name.localeCompare(b.name);
            });
    }

    /**
     * Get all registered services
     */
    getAllServices(): ServiceDefinition[] {
        return Array.from(this.services.values())
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get services grouped by category
     */
    getServicesGroupedByCategory(): Record<ServiceCategory, ServiceDefinition[]> {
        const grouped: Partial<Record<ServiceCategory, ServiceDefinition[]>> = {};

        for (const category of Object.values(ServiceCategory)) {
            const services = this.getByCategory(category);
            if (services.length > 0) {
                grouped[category] = services;
            }
        }

        return grouped as Record<ServiceCategory, ServiceDefinition[]>;
    }

    /**
     * Get category label
     */
    getCategoryLabel(category: ServiceCategory): string {
        return ServiceCategoryLabels[category] || category;
    }

    /**
     * Get all categories with their labels
     */
    getAllCategories(): Array<{ id: ServiceCategory; label: string; count: number }> {
        return Object.values(ServiceCategory).map(category => ({
            id: category,
            label: ServiceCategoryLabels[category],
            count: this.getByCategory(category).length
        }));
    }

    /**
     * Check if a service exists
     */
    hasService(id: string): boolean {
        return this.services.has(id);
    }

    /**
     * Get registry statistics
     */
    getStats(): RegistryStats {
        const byCategory: Record<ServiceCategory, number> = {} as Record<ServiceCategory, number>;

        for (const category of Object.values(ServiceCategory)) {
            byCategory[category] = this.getByCategory(category).length;
        }

        return {
            totalServices: this.services.size,
            byCategory,
            lastUpdated: new Date()
        };
    }

    /**
     * Get agent instructions for multiple services
     */
    getAgentInstructions(serviceIds: string[]): string {
        const instructions: string[] = [];

        for (const id of serviceIds) {
            const service = this.getService(id);
            if (service) {
                instructions.push(`## ${service.name} (${service.id})\n${service.agentInstructions}`);
            }
        }

        return instructions.join('\n\n');
    }

    /**
     * Get code templates for a service
     */
    getCodeTemplates(serviceId: string): Record<string, string> | undefined {
        const service = this.getService(serviceId);
        if (!service) return undefined;

        const templates: Record<string, string> = {};
        for (const [key, template] of Object.entries(service.codeTemplates)) {
            templates[key] = template.code;
        }

        return templates;
    }

    /**
     * Load default service definitions
     * This will be populated with actual service definitions
     */
    private async loadDefaultServices(): Promise<void> {
        // Import service definitions dynamically
        // This will be implemented as we add services

        // For now, we'll load the first 5 essential services
        const { getDefaultServices } = await import('./services/index.js');
        const defaultServices = getDefaultServices();
        this.registerMany(defaultServices);

        console.log(`[ServiceRegistry] Loaded ${this.services.size} services`);
    }

    /**
     * Clear all services (useful for testing)
     */
    clear(): void {
        this.services.clear();
        this.initialized = false;
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let registryInstance: ServiceRegistry | null = null;

/**
 * Get the singleton ServiceRegistry instance
 */
export function getServiceRegistry(): ServiceRegistry {
    if (!registryInstance) {
        registryInstance = new ServiceRegistry();
    }
    return registryInstance;
}

/**
 * Initialize the service registry (call once at startup)
 */
export async function initializeServiceRegistry(): Promise<ServiceRegistry> {
    const registry = getServiceRegistry();
    await registry.initialize();
    return registry;
}

// Re-export types
export * from './types.js';
