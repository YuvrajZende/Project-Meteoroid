import { securityAgentIAgent } from '@loveable/agents/core/security';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

const upstream = () => ({
    'analysis-agent': makeDemoAnalysis(),
    'api-agent': { success: true, files: [], routers: ['productsRouter'], endpoints: 5 },
    'auth-agent': { provider: 'clerk' },
});

describe('security wrapper consumes upstream', () => {
    it('reports secured endpoints and auth provider in metadata', async () => {
        const out = await securityAgentIAgent.execute({ task: 'secure it', context: { upstream: upstream() } });
        expect(out.success).toBe(true);
        expect((out.files ?? []).length).toBeGreaterThan(0);
        const data = out.metadata?.data as { securedEndpoints: number; authProvider: string };
        expect(data.securedEndpoints).toBe(5);
        expect(data.authProvider).toBe('clerk');
    });
});
