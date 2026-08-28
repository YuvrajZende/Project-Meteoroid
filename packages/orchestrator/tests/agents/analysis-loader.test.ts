import { analysisLoaderAgent } from '@loveable/agents/core/analysis/analysis-loader-agent';
import { DEMO_ANALYSIS } from '../../src/pipeline/demo-analysis';

describe('AnalysisLoaderAgent', () => {
    it('validates and passes through a well-formed analysis', async () => {
        const out = await analysisLoaderAgent.execute({
            task: 'load analysis',
            context: { analysisJson: JSON.parse(JSON.stringify(DEMO_ANALYSIS)) },
        });
        expect(out.success).toBe(true);
        const data = out.metadata?.data as { framework: { type: string }; dataModels: unknown[] };
        expect(data.framework.type).toBe('react-vite');
        expect(data.dataModels.length).toBeGreaterThan(0);
    });

    it('normalizes analyzedAt string into Date', async () => {
        const json = JSON.parse(JSON.stringify(DEMO_ANALYSIS));
        json.analyzedAt = '2026-01-01T00:00:00.000Z';
        const out = await analysisLoaderAgent.execute({ task: 'x', context: { analysisJson: json } });
        expect((out.metadata?.data as { analyzedAt: Date }).analyzedAt instanceof Date).toBe(true);
    });

    it('rejects missing input', async () => {
        const out = await analysisLoaderAgent.execute({ task: 'x', context: {} });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('INVALID_ANALYSIS');
    });

    it('rejects structurally broken analysis', async () => {
        const out = await analysisLoaderAgent.execute({ task: 'x', context: { analysisJson: { framework: {} } } });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('INVALID_ANALYSIS');
    });
});
