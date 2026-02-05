/**
 * Services API Routes
 * Phase 21: Service Integration Framework
 * 
 * Endpoints for browsing available services.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getServiceRegistry } from '../../infrastructure/api/service-registry/index.js';
import { ServiceCategory } from '../../infrastructure/api/service-registry/types.js';

interface SearchQuery {
    q?: string;
}

interface CategoryParams {
    category: string;
}

interface ServiceParams {
    id: string;
}

export async function servicesRoutes(fastify: FastifyInstance): Promise<void> {
    const registry = getServiceRegistry();

    /**
     * GET /api/v1/services
     * List all available services
     */
    fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const services = registry.getAllServices();

        return {
            success: true,
            data: {
                services: services.map(s => ({
                    id: s.id,
                    name: s.name,
                    category: s.category,
                    description: s.description,
                    logo: s.logo,
                    hasFreeTier: s.hasFreeTier,
                    capabilities: s.capabilities.slice(0, 5) // First 5 for preview
                })),
                total: services.length
            }
        };
    });

    /**
     * GET /api/v1/services/stats
     * Get service registry statistics
     */
    fastify.get('/stats', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const stats = registry.getStats();
        const categories = registry.getAllCategories();

        return {
            success: true,
            data: {
                totalServices: stats.totalServices,
                categories: categories.filter(c => c.count > 0),
                lastUpdated: stats.lastUpdated
            }
        };
    });

    /**
     * GET /api/v1/services/categories
     * List all categories with counts
     */
    fastify.get('/categories', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const categories = registry.getAllCategories();

        return {
            success: true,
            data: categories.filter(c => c.count > 0)
        };
    });

    /**
     * GET /api/v1/services/search?q=query
     * Search services
     */
    fastify.get<{ Querystring: SearchQuery }>(
        '/search',
        async (request, _reply) => {
            const { q } = request.query;

            if (!q || q.length < 2) {
                return {
                    success: true,
                    data: {
                        services: [],
                        query: q || '',
                        message: 'Query must be at least 2 characters'
                    }
                };
            }

            const services = registry.search(q);

            return {
                success: true,
                data: {
                    services: services.map(s => ({
                        id: s.id,
                        name: s.name,
                        category: s.category,
                        description: s.description,
                        logo: s.logo
                    })),
                    query: q,
                    total: services.length
                }
            };
        }
    );

    /**
     * GET /api/v1/services/category/:category
     * Get services by category
     */
    fastify.get<{ Params: CategoryParams }>(
        '/category/:category',
        async (request, reply) => {
            const { category } = request.params;

            // Validate category
            if (!Object.values(ServiceCategory).includes(category as ServiceCategory)) {
                return reply.status(400).send({
                    success: false,
                    error: `Invalid category: ${category}`,
                    validCategories: Object.values(ServiceCategory)
                });
            }

            const services = registry.getByCategory(category as ServiceCategory);
            const categoryLabel = registry.getCategoryLabel(category as ServiceCategory);

            return {
                success: true,
                data: {
                    category,
                    categoryLabel,
                    services: services.map(s => ({
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        logo: s.logo,
                        hasFreeTier: s.hasFreeTier,
                        capabilities: s.capabilities
                    })),
                    total: services.length
                }
            };
        }
    );

    /**
     * GET /api/v1/services/:id
     * Get full service details
     */
    fastify.get<{ Params: ServiceParams }>(
        '/:id',
        async (request, reply) => {
            const { id } = request.params;
            const service = registry.getService(id);

            if (!service) {
                return reply.status(404).send({
                    success: false,
                    error: `Service not found: ${id}`
                });
            }

            return {
                success: true,
                data: {
                    ...service,
                    // Don't expose full code templates in listing
                    codeTemplates: Object.keys(service.codeTemplates).map(key => ({
                        key,
                        name: service.codeTemplates[key].name,
                        description: service.codeTemplates[key].description
                    }))
                }
            };
        }
    );

    /**
     * GET /api/v1/services/:id/templates
     * Get code templates for a service
     */
    fastify.get<{ Params: ServiceParams }>(
        '/:id/templates',
        async (request, reply) => {
            const { id } = request.params;
            const templates = registry.getCodeTemplates(id);

            if (!templates) {
                return reply.status(404).send({
                    success: false,
                    error: `Service not found: ${id}`
                });
            }

            return {
                success: true,
                data: {
                    serviceId: id,
                    templates
                }
            };
        }
    );
}

export default servicesRoutes;
