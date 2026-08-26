import type { IAgent, AgentHealthStatus } from '@loveable/shared';
import type { AgentId } from './types';

import { analysisLoaderAgent } from '@loveable/agents/core/analysis/analysis-loader-agent';
import { databaseAgentIAgent } from '@loveable/agents/core/database';
import { apiAgentIAgent } from '@loveable/agents/core/api';
import { authAgentIAgent } from '@loveable/agents/core/auth';
import { securityAgentIAgent } from '@loveable/agents/core/security';
import { codegenAgent } from '@loveable/agents/support/codegen';
import { testAgentIAgent } from '@loveable/agents/support/test';
import { monitoringAgentIAgent } from '@loveable/agents/core/monitoring';
import { queueAgentIAgent } from '@loveable/agents/core/queue';
import { cicdAgentIAgent } from '@loveable/agents/specialized/cicd';
import { infraAgentIAgent } from '@loveable/agents/specialized/infra';
import { microserviceAgentIAgent } from '@loveable/agents/specialized/microservice';
import { emailAgentIAgent } from '@loveable/agents/support/email';

export class AgentRegistry {
    private agents = new Map<string, IAgent>();

    register(agent: IAgent): void {
        this.agents.set(agent.id, agent);
    }

    get(id: AgentId): IAgent {
        const agent = this.agents.get(id);
        if (!agent) throw new Error(`Agent not registered: ${id}`);
        return agent;
    }

    all(): IAgent[] {
        return [...this.agents.values()];
    }

    async initializeAll(): Promise<Map<AgentId, AgentHealthStatus>> {
        const health = new Map<AgentId, AgentHealthStatus>();
        for (const agent of this.agents.values()) {
            try {
                await agent.initialize({});
                health.set(agent.id as AgentId, await agent.healthCheck());
            } catch (err) {
                health.set(agent.id as AgentId, {
                    healthy: false,
                    message: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return health;
    }
}

export function buildDefaultRegistry(): AgentRegistry {
    const registry = new AgentRegistry();
    registry.register(analysisLoaderAgent);
    registry.register(databaseAgentIAgent);
    registry.register(apiAgentIAgent);
    registry.register(authAgentIAgent);
    registry.register(securityAgentIAgent);
    registry.register(codegenAgent);
    registry.register(testAgentIAgent);
    registry.register(monitoringAgentIAgent);
    registry.register(queueAgentIAgent);
    registry.register(cicdAgentIAgent);
    registry.register(infraAgentIAgent);
    registry.register(microserviceAgentIAgent);
    registry.register(emailAgentIAgent);
    return registry;
}
