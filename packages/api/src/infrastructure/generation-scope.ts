/**
 * Generation Scope
 * Carries the active projectId/taskId through async calls so real-time events
 * can be attributed to the generation that produced them.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface GenerationScope {
    projectId: string;
    taskId: string;
    /** Verified caller ('anonymous' when unauthenticated); events are delivered only to this user */
    userId: string;
}

const storage = new AsyncLocalStorage<GenerationScope>();

export function runInGenerationScope<T>(scope: GenerationScope, fn: () => T): T {
    return storage.run(scope, fn);
}

export function getGenerationScope(): GenerationScope | undefined {
    return storage.getStore();
}
