import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let dir: string;
let store: typeof import('../custom-agents.js');

const input = {
    name: 'Code Reviewer',
    role: 'a strict reviewer',
    instructions: 'Validate every route with zod.',
    capabilities: ['review'],
    useWebSearch: false,
    color: 'violet' as const,
};

beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'custom-agents-'));
    process.env.DATA_DIR = dir;
    store = await import('../custom-agents.js');
});

afterAll(async () => {
    delete process.env.DATA_DIR;
    await fs.rm(dir, { recursive: true, force: true });
});

describe('custom agents store', () => {
    it('creates, lists, updates and deletes an agent for its owner', async () => {
        const created = await store.createCustomAgent('user-a', input);
        expect(created.id).toMatch(/^custom-code-reviewer-[0-9a-f]{6}$/);

        expect(await store.listCustomAgents('user-a')).toHaveLength(1);

        const updated = await store.updateCustomAgent('user-a', created.id, { ...input, name: 'Strict Reviewer' });
        expect(updated?.name).toBe('Strict Reviewer');

        expect(await store.deleteCustomAgent('user-a', created.id)).toBe(true);
        expect(await store.listCustomAgents('user-a')).toHaveLength(0);
    });

    it('isolates agents between users', async () => {
        const mine = await store.createCustomAgent('user-b', input);

        expect(await store.listCustomAgents('user-c')).toHaveLength(0);
        expect(await store.getCustomAgents('user-c', [mine.id])).toHaveLength(0);
        expect(await store.updateCustomAgent('user-c', mine.id, input)).toBeNull();
        expect(await store.deleteCustomAgent('user-c', mine.id)).toBe(false);
        expect(await store.getCustomAgents('user-b', [mine.id])).toHaveLength(1);
    });

    it('persists to disk and serializes concurrent writes', async () => {
        await Promise.all(Array.from({ length: 5 }, (_, i) => store.createCustomAgent('user-d', { ...input, name: `Agent ${i}` })));
        const saved = JSON.parse(await fs.readFile(path.join(dir, 'custom-agents.json'), 'utf-8')) as Array<{ userId: string }>;
        expect(saved.filter(a => a.userId === 'user-d')).toHaveLength(5);
    });
});
