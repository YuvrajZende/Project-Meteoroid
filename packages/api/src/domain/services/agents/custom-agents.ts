/**
 * Custom Agents
 * User-defined agents with their own instructions. The orchestrator gives each selected
 * custom agent its own subtask and adds its instructions to that subtask's generation prompt.
 *
 * Stored as JSON on disk (DATA_DIR, default <repo>/data/custom-agents.json); writes are serialized.
 */

import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { REPO_ROOT } from '../../../infrastructure/repo-root.js';

export interface CustomAgent {
    id: string;
    userId: string;
    name: string;
    role: string;
    instructions: string;
    capabilities: string[];
    useWebSearch: boolean;
    color: string;
    createdAt: string;
    updatedAt: string;
}

export type CustomAgentInput = Pick<CustomAgent, 'name' | 'role' | 'instructions' | 'capabilities' | 'useWebSearch' | 'color'>;

export const AGENT_COLORS = ['ember', 'blue', 'green', 'amber', 'violet', 'pink', 'teal', 'gray'] as const;
const MAX_AGENTS_PER_USER = 50;

function dataFile(): string {
    const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(REPO_ROOT, 'data');
    return path.join(dir, 'custom-agents.json');
}

let cache: CustomAgent[] | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<CustomAgent[]> {
    if (cache) return cache;
    try {
        const parsed = JSON.parse(await fs.readFile(dataFile(), 'utf-8')) as unknown;
        cache = Array.isArray(parsed) ? (parsed as CustomAgent[]) : [];
    } catch {
        cache = [];
    }
    return cache;
}

async function persist(agents: CustomAgent[]): Promise<void> {
    const file = dataFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(agents, null, 2), 'utf-8');
    await fs.rename(tmp, file);
    cache = agents;
}

/** Serialize read-modify-write cycles so concurrent requests can't drop each other's changes. */
function mutate<T>(fn: (agents: CustomAgent[]) => Promise<T> | T): Promise<T> {
    const run = queue.then(async () => fn(await load()));
    queue = run.catch(() => undefined);
    return run;
}

function slug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'agent';
}

export async function listCustomAgents(userId: string): Promise<CustomAgent[]> {
    return (await load()).filter(a => a.userId === userId);
}

export async function getCustomAgents(userId: string, ids: string[]): Promise<CustomAgent[]> {
    const wanted = new Set(ids);
    return (await load()).filter(a => a.userId === userId && wanted.has(a.id));
}

export function createCustomAgent(userId: string, input: CustomAgentInput): Promise<CustomAgent> {
    return mutate(async (agents) => {
        if (agents.filter(a => a.userId === userId).length >= MAX_AGENTS_PER_USER) {
            throw Object.assign(new Error(`You can create up to ${MAX_AGENTS_PER_USER} agents`), { statusCode: 409 });
        }
        const now = new Date().toISOString();
        const agent: CustomAgent = {
            ...input,
            id: `custom-${slug(input.name)}-${randomBytes(3).toString('hex')}`,
            userId,
            createdAt: now,
            updatedAt: now,
        };
        await persist([...agents, agent]);
        return agent;
    });
}

export function updateCustomAgent(userId: string, id: string, input: CustomAgentInput): Promise<CustomAgent | null> {
    return mutate(async (agents) => {
        const existing = agents.find(a => a.id === id && a.userId === userId);
        if (!existing) return null;
        const updated: CustomAgent = { ...existing, ...input, updatedAt: new Date().toISOString() };
        await persist(agents.map(a => (a.id === id ? updated : a)));
        return updated;
    });
}

export function deleteCustomAgent(userId: string, id: string): Promise<boolean> {
    return mutate(async (agents) => {
        const next = agents.filter(a => !(a.id === id && a.userId === userId));
        if (next.length === agents.length) return false;
        await persist(next);
        return true;
    });
}

/**
 * Prompt block for a custom agent's subtask. Instructions come from the run's own owner.
 */
export function formatAgentInstructions(agent: Pick<CustomAgent, 'name' | 'role' | 'instructions'>): string {
    return `\n\nAGENT ROLE: You are "${agent.name}", ${agent.role}.\nAGENT INSTRUCTIONS:\n${agent.instructions}\n`;
}
