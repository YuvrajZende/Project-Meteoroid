import { authAgentIAgent } from '@loveable/agents/core/auth';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

describe('auth wrapper consumes analysis', () => {
    it('maps clerk detection to clerk provider generation', async () => {
        const out = await authAgentIAgent.execute({
            task: 'generate auth',
            context: { upstream: { 'analysis-agent': makeDemoAnalysis() } },
        });
        expect(out.success).toBe(true);
        expect((out.files ?? []).length).toBeGreaterThan(0);
        expect((out.metadata?.data as { provider: string }).provider).toBe('clerk');
    });

    it('falls back to custom when strategy says none', async () => {
        const analysis = makeDemoAnalysis();
        analysis.authStrategy.provider = 'none';
        const out = await authAgentIAgent.execute({
            task: 'generate auth',
            context: { upstream: { 'analysis-agent': analysis } },
        });
        expect(out.success).toBe(true);
        expect((out.metadata?.data as { provider: string }).provider).toBe('custom');
    });

    it('fails cleanly without upstream', async () => {
        const out = await authAgentIAgent.execute({ task: 'x', context: {} });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('MISSING_UPSTREAM');
    });
});
