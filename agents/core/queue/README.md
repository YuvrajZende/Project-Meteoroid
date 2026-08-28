# ⚙️ Queue Agent

**Assigned to:** Person 2 (AI/ML Engineer)  
**Status:** ✅ Implemented  
**Version:** 1.0.0

## Overview

The Queue Agent handles background job processing, job scheduling, and async task management using **BullMQ** with **Redis**. It generates production-ready queue systems with workers, retry strategies, monitoring, and more.

## Purpose

The Queue Agent is responsible for:
- Message queue operations
- Job scheduling (cron-based)
- Async task processing
- Worker generation
- Retry logic and error handling
- Dead letter queue management
- Rate limiting
- Queue monitoring and metrics

## Capabilities

| Capability | ID | Description |
|------------|------|-------------|
| BullMQ Integration | `bullmq` | Generate BullMQ queue configurations |
| Redis Queues | `redis-queues` | Redis-based queue management |
| Job Scheduling | `job-scheduling` | Cron-based job scheduling |
| Background Tasks | `background-tasks` | Async background processing |
| Rate Limiting | `rate-limiting` | Queue and job rate limiting |
| Worker Generation | `worker-generation` | Generate worker classes |
| Job Types | `job-types` | Type-safe job definitions |
| Retry Logic | `retry-logic` | Configurable retry strategies |
| Dead Letter Queue | `dead-letter-queue` | Failed job capture |
| Job Priority | `job-priority` | Priority-based processing |
| Cron Jobs | `cron-jobs` | Time-based scheduling |
| Queue Monitoring | `queue-monitoring` | Health checks and metrics |

## Files

| File | Description |
|------|-------------|
| `queue-agent.ts` | Main Queue Agent implementation |
| `queue-agent-iagent.ts` | IAgent interface wrapper |
| `queue-agent.config.json` | Configuration file |
| `types.ts` | Type definitions |
| `index.ts` | Module exports |
| `templates/index.ts` | BullMQ templates |

## Usage

### Basic Usage

```typescript
import { queueAgent } from '@loveable/agents/core/queue';

// Generate a queue system from requirements
const result = await queueAgent.generateQueueSystem({
    requirements: 'Email notification queue with retry logic',
    generateWorkers: true,
    generateDLQ: true,
    generateMonitoring: true,
});

console.log('Generated files:', result.files.length);
```

### Using via Orchestrator

```typescript
import { orchestrator } from '@loveable/orchestrator';

const result = await orchestrator.execute({
    task: 'Create background job system for file processing with thumbnails',
    agent: 'queue-agent',
});
```

### Template Sets

The Queue Agent supports different template sets based on complexity:

| Set | Templates Included |
|-----|-------------------|
| `basic` | queue-config, worker, job-types |
| `standard` | + queue-setup, processor, retry-strategy |
| `advanced` | + dead-letter-queue, monitoring |
| `enterprise` | + scheduler, flow, rate-limiter |

## Generated Structure

```
src/queue/
├── queue-setup.ts           # Redis connection & setup
├── queues/
│   ├── notifications.queue.ts
│   └── file-processing.queue.ts
├── workers/
│   ├── notifications-worker.ts
│   └── file-processing-worker.ts
├── types/
│   └── job-types.ts         # Type-safe job definitions
├── handlers/
│   └── dead-letter-queue.ts # Failed job handler
├── scheduler/
│   └── job-scheduler.ts     # Cron-based scheduling
├── monitoring/
│   └── queue-monitoring.ts  # Metrics & health checks
├── utils/
│   ├── retry-strategy.ts    # Retry configurations
│   └── rate-limiter.ts      # Rate limiting utilities
├── flows/
│   └── job-flows.ts         # Job dependencies
└── index.ts                 # Module exports
```

## Dependencies

```json
{
    "bullmq": "^5.0.0",
    "ioredis": "^5.0.0"
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `REDIS_TLS` | Enable TLS | `false` |

## Features

### 1. Queue Configuration
- Connection pooling
- Default job options
- Rate limiting per queue
- Queue prefix configuration

### 2. Worker Generation
- Typed processors
- Concurrency control
- Stalled job handling
- Graceful shutdown

### 3. Retry Strategies
- Fixed delay
- Exponential backoff
- Linear backoff
- Custom strategies

### 4. Dead Letter Queue
- Automatic failed job capture
- Error analysis
- Retry from DLQ
- DLQ statistics

### 5. Job Scheduling
- Cron pattern support
- Timezone support
- Repeatable jobs
- Dynamic scheduling

### 6. Monitoring
- Queue metrics (waiting, active, failed)
- Health checks
- Prometheus export
- Event listeners

### 7. Job Flows
- Parent-child dependencies
- Complex workflows
- Flow producer

## Integration

### With Database Agent
```typescript
// Generate DB schema first, then queue for data sync
await orchestrator.chain([
    { agent: 'database-agent', task: 'Create user schema' },
    { agent: 'queue-agent', task: 'Create user sync queue' },
]);
```

### With Monitoring Agent
```typescript
// Queue metrics are automatically compatible with monitoring agent
const metrics = await getQueueMetrics(queue);
monitoringAgent.recordMetrics(metrics);
```

## Author

**Person 2** - AI/ML Engineer  
Last Updated: December 26, 2024

## Contact

For questions about the interface or integration, contact Person 1 (Team Lead).
