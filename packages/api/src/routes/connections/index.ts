/**
 * Connections API Routes
 * Phase 21: Service Integration Framework
 * 
 * Endpoints for managing user service connections.
 * All routes require authentication.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getConnectionManager } from '../../infrastructure/api/connection-manager/index.js';
import { getServiceRegistry } from '../../infrastructure/api/service-registry/index.js';

interface ConnectionParams {
    id: string;
}

interface CreateConnectionBody {
    serviceId: string;
    connectionName: string;
    credentials: Record<string, string>;
    metadata?: Record<string, unknown>;
}

interface UpdateConnectionBody {
    connectionName?: string;
    credentials?: Record<string, string>;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
}

export async function connectionsRoutes(fastify: FastifyInstance): Promise<void> {
    const connectionManager = getConnectionManager();
    const registry = getServiceRegistry();

    // Auth hook - all routes require authentication
    fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        // Check for user in request (set by auth middleware)
        const user = (request as any).user;
        if (!user?.id) {
            return reply.status(401).send({
                success: false,
                error: 'Authentication required'
            });
        }
    });

    /**
     * GET /api/v1/connections
     * List all user connections
     */
    fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as any).user.id;

        try {
            const connections = await connectionManager.getUserConnections(userId);

            // Enrich with service info
            const enrichedConnections = connections.map(conn => {
                const service = registry.getService(conn.serviceId);
                return {
                    id: conn.id,
                    serviceId: conn.serviceId,
                    serviceName: service?.name || conn.serviceId,
                    serviceCategory: service?.category,
                    serviceLogo: service?.logo,
                    connectionName: conn.connectionName,
                    isActive: conn.isActive,
                    healthStatus: conn.healthStatus,
                    lastUsedAt: conn.lastUsedAt,
                    createdAt: conn.createdAt
                    // Note: credentials are NOT returned in listing
                };
            });

            return {
                success: true,
                data: {
                    connections: enrichedConnections,
                    total: enrichedConnections.length
                }
            };
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: (error as Error).message
            });
        }
    });

    /**
     * POST /api/v1/connections
     * Create a new connection
     */
    fastify.post<{ Body: CreateConnectionBody }>(
        '/',
        async (request, reply) => {
            const userId = (request as any).user.id;
            const { serviceId, connectionName, credentials, metadata } = request.body;

            // Validate service exists
            const service = registry.getService(serviceId);
            if (!service) {
                return reply.status(400).send({
                    success: false,
                    error: `Service not found: ${serviceId}`
                });
            }

            try {
                const connection = await connectionManager.createConnection({
                    userId,
                    serviceId,
                    connectionName,
                    credentials,
                    metadata
                });

                return reply.status(201).send({
                    success: true,
                    data: {
                        id: connection.id,
                        serviceId: connection.serviceId,
                        serviceName: service.name,
                        connectionName: connection.connectionName,
                        isActive: connection.isActive,
                        healthStatus: connection.healthStatus,
                        createdAt: connection.createdAt
                    },
                    message: `Connection to ${service.name} created successfully`
                });
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: (error as Error).message
                });
            }
        }
    );

    /**
     * GET /api/v1/connections/:id
     * Get connection details (includes decrypted credentials)
     */
    fastify.get<{ Params: ConnectionParams }>(
        '/:id',
        async (request, reply) => {
            const userId = (request as any).user.id;
            const { id } = request.params;

            try {
                const connection = await connectionManager.getConnection(userId, id);
                const service = registry.getService(connection.serviceId);

                return {
                    success: true,
                    data: {
                        ...connection,
                        serviceName: service?.name,
                        serviceCategory: service?.category
                    }
                };
            } catch (error) {
                return reply.status(404).send({
                    success: false,
                    error: (error as Error).message
                });
            }
        }
    );

    /**
     * PUT /api/v1/connections/:id
     * Update a connection
     */
    fastify.put<{ Params: ConnectionParams; Body: UpdateConnectionBody }>(
        '/:id',
        async (request, reply) => {
            const userId = (request as any).user.id;
            const { id } = request.params;
            const updates = request.body;

            try {
                const connection = await connectionManager.updateConnection(userId, id, updates);

                return {
                    success: true,
                    data: {
                        id: connection.id,
                        connectionName: connection.connectionName,
                        isActive: connection.isActive,
                        updatedAt: connection.updatedAt
                    },
                    message: 'Connection updated successfully'
                };
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: (error as Error).message
                });
            }
        }
    );

    /**
     * DELETE /api/v1/connections/:id
     * Delete a connection (soft delete)
     */
    fastify.delete<{ Params: ConnectionParams }>(
        '/:id',
        async (request, reply) => {
            const userId = (request as any).user.id;
            const { id } = request.params;

            try {
                await connectionManager.deleteConnection(userId, id);

                return {
                    success: true,
                    message: 'Connection deleted successfully'
                };
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: (error as Error).message
                });
            }
        }
    );

    /**
     * POST /api/v1/connections/:id/test
     * Test a connection
     */
    fastify.post<{ Params: ConnectionParams }>(
        '/:id/test',
        async (request, reply) => {
            const userId = (request as any).user.id;
            const { id } = request.params;

            try {
                const result = await connectionManager.testConnection(userId, id);

                return {
                    success: result.success,
                    data: {
                        ...result,
                        testedAt: new Date()
                    },
                    message: result.message
                };
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: (error as Error).message
                });
            }
        }
    );

    /**
     * GET /api/v1/connections/stats
     * Get usage statistics
     */
    fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
        const userId = (request as any).user.id;

        try {
            const stats = await connectionManager.getUsageStats(userId);

            return {
                success: true,
                data: {
                    stats,
                    period: '30 days'
                }
            };
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: (error as Error).message
            });
        }
    });
}

export default connectionsRoutes;
