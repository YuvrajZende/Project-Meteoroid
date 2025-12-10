/**
 * Real-Time Routes
 * SSE endpoints for agent progress and orchestrator updates
 * Note: WebSocket support requires @fastify/websocket plugin
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getAgentMonitor } from '../services/core-services.js';
import { getAgentRegistry } from '../services/agent-registry.js';

// ============================================
// TYPES
// ============================================

interface SSEClient {
    id: string;
    reply: any;
    channels: Set<string>;
    keepAlive: NodeJS.Timeout;
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
    addClient(id: string, reply: any, channel: string): void {
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
        });

        console.log(`� SSE client connected: ${id}. Total: ${this.clients.size}`);
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

        for (const client of this.clients.values()) {
            if (client.channels.has(channel) || client.channels.has('*')) {
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
        const clientId = `task-${taskId}-${Date.now()}`;

        // Set SSE headers
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
        const clientId = `agents-${Date.now()}`;

        // Set SSE headers
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
        const clientId = `orchestrator-${Date.now()}`;

        // Set SSE headers
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
        const clientId = `global-${Date.now()}`;

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });

        // Add client to all channels
        sseManager.addClient(clientId, reply, '*');

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
