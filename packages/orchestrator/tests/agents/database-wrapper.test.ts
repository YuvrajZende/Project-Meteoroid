import { databaseAgentIAgent } from '@loveable/agents/core/database';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

describe('database wrapper consumes analysis', () => {
    it('builds schema FROM analysis models and emits prisma + services', async () => {
        const out = await databaseAgentIAgent.execute({
            task: 'generate database layer',
            context: { upstream: { 'analysis-agent': makeDemoAnalysis() } },
        });
        expect(out.success).toBe(true);
        const paths = (out.files ?? []).map(f => f.path);
        expect(paths).toContain('prisma/schema.prisma');

        const prisma = (out.files ?? []).find(f => f.path === 'prisma/schema.prisma')!.content;
        expect(prisma).toContain('model Product');
        expect(prisma).toContain('model Order');

        const data = out.metadata?.data as { schema: { tables: Array<{ name: string }> } };
        expect(data.schema.tables.map(t => t.name).sort()).toEqual(['order', 'product']);
    });

    it('fails cleanly without upstream analysis', async () => {
        const out = await databaseAgentIAgent.execute({ task: 'x', context: {} });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('MISSING_UPSTREAM');
    });
});
