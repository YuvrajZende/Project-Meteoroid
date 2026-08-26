import { apiAgentIAgent } from '@loveable/agents/core/api';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

describe('api wrapper consumes analysis', () => {
    it('generates routers for detected resources plus middleware', async () => {
        const out = await apiAgentIAgent.execute({
            task: 'generate api',
            context: { upstream: { 'analysis-agent': makeDemoAnalysis() }, requestName: 'mini commerce' },
        });
        expect(out.success).toBe(true);
        const paths = (out.files ?? []).map(f => f.path);
        expect(paths.some(p => p.startsWith('src/routes/'))).toBe(true);
        expect(paths).toContain('src/middleware/error-handler.ts');

        const data = out.metadata?.data as { endpoints: number };
        expect(data.endpoints).toBeGreaterThan(0);
    });

    it('still succeeds (middleware-only) when no known resources match', async () => {
        const analysis = makeDemoAnalysis();
        analysis.dataModels = [];   // no product/order words -> no CRUD routers
        const out = await apiAgentIAgent.execute({
            task: 'generate api',
            context: { upstream: { 'analysis-agent': analysis }, requestName: 'weird project' },
        });
        expect(out.success).toBe(true);
        expect((out.files ?? []).length).toBeGreaterThan(0);   // middleware + docs still emitted
    });
});
