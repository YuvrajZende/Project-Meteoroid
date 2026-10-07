/**
 * Real-Time Routes
 * SSE endpoints for agent progress and orchestrator updates
 * Note: WebSocket support requires @fastify/websocket plugin
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAgentMonitor, getAgentRegistry } from '../services/index.js';
import { getGenerationScope } from '../infrastructure/generation-scope.js';
import { env } from '../config/index.js';
import { authenticate } from '../middleware/auth-middleware.js';
import { sseCorsHeaders } from '../plugins/sse-cors.js';
import { getFileWriter, isValidProjectId } from '../infrastructure/file-writer.js';
import { canAccess, readOutputMeta } from './outputs.js';

// ============================================
// TYPES
// ============================================

interface SSEClient {
    id: string;
    reply: FastifyReply;
    channels: Set<string>;
    keepAlive: NodeJS.Timeout;
    /** When set, the client only receives events for this project */
    projectId?: string;
    /** Subscriber identity for project streams ('anonymous' when unauthenticated) */
    userId?: string;
    /** Unscoped stream allowed to see project events (local dev clients only, e.g. the TUI) */
    seesProjectEvents?: boolean;
}

// ============================================
// SSE MANAGER
// ============================================

class SSEManager {
    private clients: Map<string, SSEClient> = new Map();
    private static instance: SSEManager;

    static getInstance(): SSEManager {
        if (!SSEManager.instance) {
            SSEManager.instance = new SSEManager();
        }
        return SSEManager.instance;
    }

    /**
     * Add a new SSE client
     */
    addClient(id: string, reply: FastifyReply, channel: string, projectId?: string, userId?: string, seesProjectEvents = false): void {
        const keepAlive = setInterval(() => {
            try {
                reply.raw.write(`: keepalive\n\n`);
            } catch {
                this.removeClient(id);
            }
        }, 15000);

        this.clients.set(id, {
            id,
            reply,
            channels: new Set([channel]),
            keepAlive,
            projectId,
            userId,
            seesProjectEvents,
        });

        console.log(`[SSE] Client connected: ${id}. Total: ${this.clients.size}`);
    }

    /**
     * Remove a client
     */
    removeClient(id: string): void {
        const client = this.clients.get(id);
        if (client) {
            clearInterval(client.keepAlive);
            this.clients.delete(id);
            console.log(`[SSE] Client disconnected: ${id}. Total: ${this.clients.size}`);
        }
    }

    /**
     * Broadcast to all clients in a channel
     */
    broadcast(channel: string, event: string, data: unknown): void {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        const eventProjectId = typeof data === 'object' && data !== null
            ? (data as { projectId?: unknown }).projectId
            : undefined;
        // Owner of the generation that produced this event (from the request's async scope)
        const eventUserId = getGenerationScope()?.userId;

        for (const client of this.clients.values()) {
            // Project streams get only their project's events, and only for the owner.
            // Unscoped streams see project events only when flagged (local dev clients).
            const deliver = client.projectId
                ? eventProjectId === client.projectId && eventUserId === client.userId
                : (client.channels.has(channel) || client.channels.has('*'))
                    && (!eventProjectId || client.seesProjectEvents === true);
            if (deliver) {
                try {
                    client.reply.raw.write(payload);
                } catch (error) {
                    this.removeClient(client.id);
                }
            }
        }
    }

    /**
     * Send to specific client
     */
    send(clientId: string, event: string, data: unknown): void {
        const client = this.clients.get(clientId);
        if (client) {
            try {
                client.reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (error) {
                this.removeClient(clientId);
            }
        }
    }

    /**
     * Get client count
     */
    get clientCount(): number {
        return this.clients.size;
    }
}

export const sseManager = SSEManager.getInstance();

function isLoopback(ip: string): boolean {
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// ============================================
// STREAM TICKETS
// ============================================

const STREAM_TICKET_TTL_MS = 60_000;
const MAX_TICKETS = 5_000;
const streamTickets = new Map<string, { projectId: string; userId: string; expiresAt: number }>();

function issueStreamTicket(projectId: string, userId: string): string {
    const now = Date.now();
    for (const [key, t] of streamTickets) {
        if (t.expiresAt < now || streamTickets.size >= MAX_TICKETS) streamTickets.delete(key);
        else break;
    }
    const ticket = randomBytes(24).toString('base64url');
    streamTickets.set(ticket, { projectId, userId, expiresAt: now + STREAM_TICKET_TTL_MS });
    return ticket;
}

/** Single use: returns the ticket's user if valid for this project, else null. */
function redeemStreamTicket(ticket: string | undefined, projectId: string): string | null {
    if (!ticket) return null;
    const entry = streamTickets.get(ticket);
    streamTickets.delete(ticket);
    if (!entry || entry.expiresAt < Date.now() || entry.projectId !== projectId) return null;
    return entry.userId;
}

// ============================================
// SSE ROUTES
// ============================================

/**
 * Register SSE routes for real-time updates
 */
export async function registerSSERoutes(app: FastifyInstance): Promise<void> {

    /**
     * SSE endpoint for task progress
     */
    app.get('/api/v1/events/tasks/:taskId', async (request: FastifyRequest<{
        Params: { taskId: string }
    }>, reply) => {
        const { taskId } = request.params;
        const clientId = `task-${taskId}-${randomUUID()}`;

        // Set SSE headers
        reply.hijack();
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });

        // Add client
        sseManager.addClient(clientId, reply, `task:${taskId}`);

        // Send initial connection event
        reply.raw.write(`event: connected\ndata: ${JSON.stringify({
            taskId,
            clientId,
            timestamp: new Date().toISOString(),
        })}\n\n`);

        // Cleanup on close
        request.raw.on('close', () => {
            sseManager.removeClient(clientId);
        });

        // Don't end the response - keep it open for SSE
        return reply;
    });

    /**
     * SSE endpoint for agent updates
     */
    app.get('/api/v1/events/agents', async (request, reply) => {
        const clientId = `agents-${randomUUID()}`;

        // Set SSE headers
        reply.hijack();
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });

        // Add client
        sseManager.addClient(clientId, reply, 'agents');

        const registry = getAgentRegistry();
        const agents = registry.getAll();

        // Send initial agent list
        reply.raw.write(`event: agents\ndata: ${JSON.stringify(agents.map(a => ({
            id: a.id,
            name: a.name,
            tier: a.tier,
            capabilities: a.capabilities.length,
        })))}\n\n`);

        // Cleanup on close
        request.raw.on('close', () => {
            sseManager.removeClient(clientId);
        });

        return reply;
    });

    /**
     * SSE endpoint for orchestrator events
     */
    app.get('/api/v1/events/orchestrator', async (request, reply) => {
        const clientId = `orchestrator-${randomUUID()}`;

        // Set SSE headers
        reply.hijack();
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });

        // Add client
        sseManager.addClient(clientId, reply, 'orchestrator');

        // Send initial status
        reply.raw.write(`event: connected\ndata: ${JSON.stringify({
            status: 'ready',
            timestamp: new Date().toISOString(),
        })}\n\n`);

        // Cleanup on close
        request.raw.on('close', () => {
            sseManager.removeClient(clientId);
        });

        return reply;
    });

    /**
     * SSE endpoint for all events (global)
     */
    app.get('/api/v1/events', async (request, reply) => {
        const clientId = `global-${randomUUID()}`;

        // Set SSE headers
        reply.hijack();
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });

        // Add client to all channels
        // Project events on the global stream: only for same-machine clients in dev (the TUI).
        // Everyone else gets them through the ticketed per-project stream.
        sseManager.addClient(clientId, reply, '*', undefined, undefined, !env.AUTH_REQUIRED && isLoopback(request.ip));

        // Send initial status
        const registry = getAgentRegistry();
        const monitor = getAgentMonitor();

        reply.raw.write(`event: connected\ndata: ${JSON.stringify({
            status: 'ready',
            agents: registry.getAll().length,
            activeExecutions: monitor.getAllStatus().filter(s => s.status === 'running').length,
            timestamp: new Date().toISOString(),
        })}\n\n`);

        // Cleanup on close
        request.raw.on('close', () => {
            sseManager.removeClient(clientId);
        });

        return reply;
    });

    /**
     * POST /api/v1/events/tickets - Short-lived, single-use ticket for a project stream.
     * EventSource can't send an Authorization header, and access tokens must not appear in URLs.
     */
    app.post<{ Body: { projectId: string } }>('/api/v1/events/tickets', {
        preHandler: authenticate({ required: env.AUTH_REQUIRED, allowApiKey: false }),
        schema: {
            body: {
                type: 'object',
                required: ['projectId'],
                properties: { projectId: { type: 'string', maxLength: 128 } },
            },
        },
    }, async (request, reply) => {
        const { projectId } = request.body;
        if (!isValidProjectId(projectId)) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid project ID' });
        }
        // Existing projects must belong to the caller; new IDs carry no data until their owner starts a run,
        // and events are additionally filtered by owner at delivery time.
        const meta = await readOutputMeta(getFileWriter().getProjectPath(projectId));
        if (meta.userId && !canAccess(meta, request.authUser?.id)) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
        }
        return { ticket: issueStreamTicket(projectId, request.authUser?.id ?? 'anonymous'), expiresIn: STREAM_TICKET_TTL_MS / 1000 };
    });

    /**
     * SSE stream for one project's generation (pipeline steps, files, agent activity). Requires a ticket.
     */
    app.get<{ Params: { projectId: string }; Querystring: { ticket?: string } }>('/api/v1/events/projects/:projectId', async (request, reply) => {
        const { projectId } = request.params;
        const userId = redeemStreamTicket(request.query.ticket, projectId);
        if (!userId) {
            return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing or expired stream ticket' });
        }

        const clientId = `project-${projectId}-${randomUUID()}`;
        reply.hijack();
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            ...sseCorsHeaders(request),
        });
        sseManager.addClient(clientId, reply, 'project', projectId, userId);
        reply.raw.write(`event: connected\ndata: ${JSON.stringify({ projectId, timestamp: new Date().toISOString() })}\n\n`);
        request.raw.on('close', () => sseManager.removeClient(clientId));
        return reply;
    });

    app.log.info('[ROUTES] SSE routes registered: /api/v1/events/*');
}

// ============================================
// HELPER FUNCTIONS FOR BROADCASTING
// ============================================

/**
 * Broadcast agent progress update
 */
export function broadcastAgentProgress(agentId: string, progress: number, message: string): void {
    sseManager.broadcast('agents', 'agentProgress', {
        agentId,
        progress,
        message,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Broadcast task update
 */
export function broadcastTaskUpdate(taskId: string, status: string, data?: unknown): void {
    sseManager.broadcast(`task:${taskId}`, 'taskUpdate', {
        taskId,
        status,
        data,
        timestamp: new Date().toISOString(),
    });

    // Also broadcast to global
    sseManager.broadcast('*', 'taskUpdate', {
        taskId,
        status,
        data,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Broadcast orchestrator event
 */
export function broadcastOrchestratorEvent(event: string, data?: unknown): void {
    sseManager.broadcast('orchestrator', event, {
        data,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Broadcast to all clients
 */
export function broadcastGlobal(event: string, data?: unknown): void {
    sseManager.broadcast('*', event, {
        data,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Broadcast file written event (for streaming file generation)
 */
export function broadcastFileWritten(projectId: string, filePath: string, size: number): void {
    sseManager.broadcast('*', 'fileWritten', {
        taskId: getGenerationScope()?.taskId,
        projectId,
        filePath,
        size,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Broadcast pipeline step event
 */
export function broadcastPipelineStep(stepNumber: number, phase: string, message: string, agent?: string): void {
    const scope = getGenerationScope();
    sseManager.broadcast('*', 'pipelineStep', {
        projectId: scope?.projectId,
        taskId: scope?.taskId,
        stepNumber,
        phase,
        message,
        agent,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Broadcast generation progress
 */
export function broadcastGenerationProgress(taskId: string, progress: number, message: string): void {
    sseManager.broadcast('*', 'taskUpdate', {
        taskId,
        status: 'generating',
        progress,
        message,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Structured agent activity for the live UI (thinking, tool calls, sub-agent allocation).
 */
export type ActivityEvent =
    | { kind: 'thinking'; status: 'start' | 'end'; summary?: string; complexity?: string; durationMs?: number }
    | { kind: 'plan'; subtasks: Array<{ id: number; title: string; agent: string }> }
    | { kind: 'tool'; id: string; tool: 'web_search'; status: 'running' | 'done' | 'error'; query: string; results?: Array<{ title: string; url: string }>; error?: string; durationMs?: number }
    | { kind: 'agent'; id: number; agent: string; status: 'running' | 'done' | 'failed'; files?: number; error?: string; durationMs?: number };

export function broadcastActivity(activity: ActivityEvent): void {
    const scope = getGenerationScope();
    sseManager.broadcast('*', 'activity', {
        projectId: scope?.projectId,
        taskId: scope?.taskId,
        ...activity,
        timestamp: new Date().toISOString(),
    });
}
