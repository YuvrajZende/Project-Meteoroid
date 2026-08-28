# Agent Template

This is a template for creating new agents for the Loveable Backend Orchestrator.

## Quick Start

1. **Copy this directory** to your agent location:
   ```
   agents/core/your-agent/     # For core agents (Tier 1)
   agents/specialized/your-agent/  # For specialized agents (Tier 2)
   agents/support/your-agent/  # For support agents (Tier 3)
   ```

2. **Rename and implement** the agent class in `index.ts`

3. **Export your agent** - The orchestrator will auto-discover it!

## Agent Tiers

| Tier | Type | Examples |
|------|------|----------|
| 1 | Core | auth, security, monitoring, database, api, queue |
| 2 | Specialized | cicd, infra, microservice |
| 3 | Support | test, codegen, email |

## IAgent Interface

Your agent MUST implement all required methods:

```typescript
interface IAgent {
  // Required properties
  readonly id: string;           // Unique kebab-case ID
  readonly name: string;         // Human-readable name
  readonly tier: 1 | 2 | 3;      // Agent tier
  readonly capabilities: string[]; // What this agent can do

  // Required methods
  initialize(config: AgentConfig): Promise<void>;
  execute(input: AgentInput): Promise<AgentOutput>;
  healthCheck(): Promise<AgentHealthStatus>;
  
  // Optional
  shutdown?(): Promise<void>;
}
```

## Capabilities

Capabilities are strings that describe what your agent can do. The orchestrator uses these to route tasks.

Example capabilities:
- `generate-auth-code`
- `database-migration`
- `run-tests`
- `deploy-application`

## Input/Output

### AgentInput
```typescript
{
  task: string;              // The task to perform
  context?: Record;          // Additional context
  previousOutputs?: [];      // Outputs from previous agents
  userId?: string;           // User making the request
  projectId?: string;        // Project context
  requestId?: string;        // For tracing
}
```

### AgentOutput
```typescript
{
  success: boolean;          // Did it work?
  files?: GeneratedFile[];   // Generated files
  message?: string;          // Human-readable result
  error?: { code, message }; // Error details if failed
  metadata?: {};             // Execution stats
}
```

## Testing Your Agent

1. Ensure your agent passes the `isValidAgent()` type guard
2. Run the orchestrator: `npm run dev`
3. Check the console for agent loading status
4. Use the `/api/v1/agents` endpoint to verify registration

## Need Help?

Contact Person 1 (Team Lead) for architecture questions.
