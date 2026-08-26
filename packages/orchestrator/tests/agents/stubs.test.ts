import { monitoringAgentIAgent } from '@loveable/agents/core/monitoring';
import { queueAgentIAgent } from '@loveable/agents/core/queue';
import { cicdAgentIAgent } from '@loveable/agents/specialized/cicd';
import { infraAgentIAgent } from '@loveable/agents/specialized/infra';
import { microserviceAgentIAgent } from '@loveable/agents/specialized/microservice';
import { emailAgentIAgent } from '@loveable/agents/support/email';

const CASES: Array<[string, { execute(i: unknown): Promise<{ success: boolean; files?: Array<{ path: string }> ; metadata?: { data?: { stub?: boolean } } }> }, string]> = [
    ['monitoring', monitoringAgentIAgent, 'src/monitoring/health-route.ts'],
    ['queue', queueAgentIAgent, 'src/queue/queue-setup.ts'],
    ['cicd', cicdAgentIAgent, '.github/workflows/ci.yml'],
    ['infra', infraAgentIAgent, 'Dockerfile'],
    ['microservice', microserviceAgentIAgent, 'src/microservices/service-map.json'],
    ['email', emailAgentIAgent, 'src/email/mailer.ts'],
];

describe('stub agents', () => {
    for (const [label, agent, expectedPath] of CASES) {
        it(`${label} produces its fixed stub file flagged stub:true`, async () => {
            await agent.initialize({} as never);
            const out = await agent.execute({ task: label, context: { upstream: {} } } as never);
            expect(out.success).toBe(true);
            expect((out.files ?? []).map(f => f.path)).toContain(expectedPath);
            expect((out.metadata?.data as { stub?: boolean }).stub).toBe(true);
        });
    }
});
