/**
 * Custom Agent Routes
 * CRUD for user-defined agents that the orchestrator can allocate subtasks to.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../config/index.js';
import { authenticate } from '../middleware/auth-middleware.js';
import {
    AGENT_COLORS,
    createCustomAgent,
    deleteCustomAgent,
    listCustomAgents,
    updateCustomAgent,
} from '../domain/services/agents/custom-agents.js';

export const CustomAgentSchema = z.object({
    name: z.string().trim().min(2).max(40),
    role: z.string().trim().min(3).max(140),
    instructions: z.string().trim().min(10).max(4000),
    capabilities: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
    useWebSearch: z.boolean().default(false),
    color: z.enum(AGENT_COLORS).default('ember'),
});

type IdParams = { Params: { id: string } };

export function ownerOf(request: FastifyRequest): string {
    return request.authUser?.id ?? 'anonymous';
}

export async function registerCustomAgentRoutes(app: FastifyInstance): Promise<void> {
    const auth = authenticate({ required: env.AUTH_REQUIRED });

    app.get('/api/v1/custom-agents', {
        preHandler: auth,
        schema: { tags: ['Agents'], summary: 'List your custom agents' },
    }, async (request) => ({ agents: await listCustomAgents(ownerOf(request)) }));

    app.post('/api/v1/custom-agents', {
        preHandler: auth,
        schema: { tags: ['Agents'], summary: 'Create a custom agent' },
    }, async (request, reply) => {
        const agent = await createCustomAgent(ownerOf(request), CustomAgentSchema.parse(request.body));
        return reply.status(201).send({ agent });
    });

    app.put<IdParams>('/api/v1/custom-agents/:id', {
        preHandler: auth,
        schema: { tags: ['Agents'], summary: 'Update a custom agent' },
    }, async (request, reply: FastifyReply) => {
        const agent = await updateCustomAgent(ownerOf(request), request.params.id, CustomAgentSchema.parse(request.body));
        if (!agent) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Agent not found' });
        return { agent };
    });

    app.delete<IdParams>('/api/v1/custom-agents/:id', {
        preHandler: auth,
        schema: { tags: ['Agents'], summary: 'Delete a custom agent' },
    }, async (request, reply: FastifyReply) => {
        const deleted = await deleteCustomAgent(ownerOf(request), request.params.id);
        if (!deleted) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Agent not found' });
        return { success: true };
    });
}
