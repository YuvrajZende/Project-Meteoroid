import { buildDefaultRegistry } from '../src/pipeline/registry';
import { isValidAgent } from '@loveable/shared';

const ALL_IDS = [
    'analysis-agent', 'database-agent', 'api-agent', 'auth-agent',
    'security-agent', 'codegen-agent', 'test-agent', 'monitoring-agent',
    'queue-agent', 'cicd-agent', 'infra-agent', 'microservice-agent', 'email-agent',
];

describe('buildDefaultRegistry', () => {
    it('registers exactly the 13 canonical agents with canonical ids', () => {
        const reg = buildDefaultRegistry();
        const ids = reg.all().map(a => a.id).sort();
        expect(ids).toEqual([...ALL_IDS].sort());
    });

    it('every registration satisfies isValidAgent', () => {
        const reg = buildDefaultRegistry();
        for (const agent of reg.all()) {
            expect(isValidAgent(agent)).toBe(true);
        }
    });

    it('initializeAll returns a health entry per agent', async () => {
        const reg = buildDefaultRegistry();
        const health = await reg.initializeAll();
        expect(health.size).toBe(13);
        for (const id of ALL_IDS) {
            expect(health.get(id as never)).toBeDefined();
        }
    });
});
