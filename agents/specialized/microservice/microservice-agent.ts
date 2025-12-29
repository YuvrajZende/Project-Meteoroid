/**
 * ============================================
 * MICROSERVICE AGENT - CORE IMPLEMENTATION
 * ============================================
 * 
 * The Microservice Agent is responsible for generating
 * microservice architecture components and configurations.
 * 
 * Capabilities:
 * - Service mesh configuration (Istio, Linkerd)
 * - gRPC service generation
 * - Event-driven architecture (Kafka, RabbitMQ)
 * - Saga pattern implementation
 * - Service discovery
 * - API Gateway configuration
 * 
 * @author Person 4 (DevOps Engineer)
 */

// ============================================
// TYPES
// ============================================

export type ServiceMesh = 'istio' | 'linkerd' | 'consul' | 'none';
export type MessageBroker = 'kafka' | 'rabbitmq' | 'redis' | 'sqs';
export type CommunicationType = 'rest' | 'grpc' | 'graphql' | 'event-driven';

export interface MicroserviceConfig {
    serviceMesh: ServiceMesh;
    messageBroker: MessageBroker;
    communicationType: CommunicationType;
    serviceDiscovery: boolean;
    circuitBreaker: boolean;
    tracing: boolean;
}

export interface ServiceDefinition {
    name: string;
    description: string;
    port: number;
    dependencies: string[];
    endpoints: EndpointDef[];
    events?: EventDef[];
}

export interface EndpointDef {
    path: string;
    method: string;
    description: string;
}

export interface EventDef {
    name: string;
    type: 'publish' | 'subscribe';
    topic: string;
    schema: Record<string, string>;
}

export interface MicroserviceGeneratedFile {
    path: string;
    content: string;
    type: 'service' | 'proto' | 'config' | 'mesh' | 'event';
}

export interface MicroserviceGenerationResult {
    success: boolean;
    files: MicroserviceGeneratedFile[];
    services: string[];
    architecture: string;
}

// ============================================
// TEMPLATES
// ============================================

const GRPC_PROTO_TEMPLATE = `syntax = "proto3";

package {{package}};

option go_package = "./{{package}}";

service {{serviceName}}Service {
{{#each methods}}
    rpc {{name}}({{requestType}}) returns ({{responseType}});
{{/each}}
}

{{#each messages}}
message {{name}} {
{{#each fields}}
    {{type}} {{name}} = {{index}};
{{/each}}
}
{{/each}}
`;

const GRPC_SERVER_TEMPLATE = `import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/{{service}}.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);

// Service implementation
const serviceImpl = {
{{#each methods}}
    {{name}}: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
        // TODO: Implement {{name}}
        callback(null, { success: true });
    },
{{/each}}
};

export function startGrpcServer(port: number) {
    const server = new grpc.Server();
    
    server.addService(
        (proto as any).{{package}}.{{serviceName}}Service.service,
        serviceImpl
    );
    
    server.bindAsync(
        \`0.0.0.0:\${port}\`,
        grpc.ServerCredentials.createInsecure(),
        (err, boundPort) => {
            if (err) {
                console.error('Failed to start gRPC server:', err);
                return;
            }
            console.log(\`gRPC server running on port \${boundPort}\`);
        }
    );
    
    return server;
}
`;

const KAFKA_PRODUCER_TEMPLATE = `import { Kafka, Producer, Partitioners } from 'kafkajs';

const kafka = new Kafka({
    clientId: '{{serviceName}}',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let producer: Producer | null = null;

export async function initializeProducer() {
    producer = kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
    });
    
    await producer.connect();
    console.log('Kafka producer connected');
    
    return producer;
}

export async function publishEvent<T>(
    topic: string,
    event: {
        type: string;
        data: T;
        metadata?: Record<string, string>;
    }
) {
    if (!producer) {
        throw new Error('Producer not initialized');
    }
    
    const message = {
        key: event.type,
        value: JSON.stringify({
            ...event,
            timestamp: new Date().toISOString(),
            source: '{{serviceName}}',
        }),
        headers: event.metadata,
    };
    
    await producer.send({
        topic,
        messages: [message],
    });
    
    console.log(\`Event published to \${topic}: \${event.type}\`);
}

export async function disconnectProducer() {
    if (producer) {
        await producer.disconnect();
        producer = null;
    }
}
`;

const KAFKA_CONSUMER_TEMPLATE = `import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

const kafka = new Kafka({
    clientId: '{{serviceName}}',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

export type EventHandler<T = unknown> = (data: T, metadata: Record<string, string>) => Promise<void>;

const handlers = new Map<string, EventHandler>();

export function registerHandler<T>(eventType: string, handler: EventHandler<T>) {
    handlers.set(eventType, handler as EventHandler);
}

async function processMessage({ topic, partition, message }: EachMessagePayload) {
    try {
        const event = JSON.parse(message.value?.toString() || '{}');
        const handler = handlers.get(event.type);
        
        if (handler) {
            await handler(event.data, event.metadata || {});
            console.log(\`Processed event \${event.type} from \${topic}\`);
        } else {
            console.warn(\`No handler for event type: \${event.type}\`);
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

export async function startConsumer(topics: string[], groupId: string) {
    const consumer = kafka.consumer({ groupId });
    
    await consumer.connect();
    console.log('Kafka consumer connected');
    
    for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning: false });
    }
    
    await consumer.run({
        eachMessage: processMessage,
    });
    
    return consumer;
}
`;

const SAGA_ORCHESTRATOR_TEMPLATE = `/**
 * Saga Orchestrator
 * Implements the Saga pattern for distributed transactions
 */

export interface SagaStep<TContext> {
    name: string;
    execute: (context: TContext) => Promise<TContext>;
    compensate: (context: TContext) => Promise<TContext>;
}

export interface SagaResult<TContext> {
    success: boolean;
    context: TContext;
    completedSteps: string[];
    failedStep?: string;
    error?: Error;
}

export class SagaOrchestrator<TContext extends Record<string, unknown>> {
    private steps: SagaStep<TContext>[] = [];
    
    addStep(step: SagaStep<TContext>): this {
        this.steps.push(step);
        return this;
    }
    
    async execute(initialContext: TContext): Promise<SagaResult<TContext>> {
        let context = { ...initialContext };
        const completedSteps: string[] = [];
        
        try {
            for (const step of this.steps) {
                console.log(\`Executing saga step: \${step.name}\`);
                context = await step.execute(context);
                completedSteps.push(step.name);
            }
            
            return {
                success: true,
                context,
                completedSteps,
            };
        } catch (error) {
            console.error(\`Saga failed at step \${this.steps[completedSteps.length]?.name}\`);
            
            // Compensate in reverse order
            for (let i = completedSteps.length - 1; i >= 0; i--) {
                const step = this.steps[i];
                try {
                    console.log(\`Compensating step: \${step.name}\`);
                    context = await step.compensate(context);
                } catch (compensateError) {
                    console.error(\`Compensation failed for \${step.name}:\`, compensateError);
                }
            }
            
            return {
                success: false,
                context,
                completedSteps,
                failedStep: this.steps[completedSteps.length]?.name,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
}

// Example usage:
// const orderSaga = new SagaOrchestrator()
//     .addStep({
//         name: 'reserveInventory',
//         execute: async (ctx) => { ... },
//         compensate: async (ctx) => { ... },
//     })
//     .addStep({
//         name: 'processPayment',
//         execute: async (ctx) => { ... },
//         compensate: async (ctx) => { ... },
//     });
`;

const CIRCUIT_BREAKER_TEMPLATE = `/**
 * Circuit Breaker Pattern Implementation
 */

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
}

export class CircuitBreaker<T> {
    private state: CircuitState = CircuitState.CLOSED;
    private failures = 0;
    private successes = 0;
    private lastFailureTime?: Date;
    private readonly options: CircuitBreakerOptions;
    
    constructor(
        private readonly fn: () => Promise<T>,
        options?: Partial<CircuitBreakerOptions>
    ) {
        this.options = {
            failureThreshold: options?.failureThreshold ?? 5,
            successThreshold: options?.successThreshold ?? 2,
            timeout: options?.timeout ?? 10000,
            resetTimeout: options?.resetTimeout ?? 30000,
        };
    }
    
    async execute(): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.state = CircuitState.HALF_OPEN;
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await this.withTimeout(this.fn());
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private async withTimeout(promise: Promise<T>): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), this.options.timeout)
            ),
        ]);
    }
    
    private onSuccess() {
        this.failures = 0;
        
        if (this.state === CircuitState.HALF_OPEN) {
            this.successes++;
            if (this.successes >= this.options.successThreshold) {
                this.state = CircuitState.CLOSED;
                this.successes = 0;
            }
        }
    }
    
    private onFailure() {
        this.failures++;
        this.lastFailureTime = new Date();
        this.successes = 0;
        
        if (this.failures >= this.options.failureThreshold) {
            this.state = CircuitState.OPEN;
        }
    }
    
    private shouldAttemptReset(): boolean {
        if (!this.lastFailureTime) return true;
        const elapsed = Date.now() - this.lastFailureTime.getTime();
        return elapsed >= this.options.resetTimeout;
    }
    
    getState(): CircuitState {
        return this.state;
    }
}
`;

const SERVICE_DISCOVERY_TEMPLATE = `/**
 * Service Discovery Client
 * Implements service registration and discovery
 */

export interface ServiceInstance {
    id: string;
    name: string;
    host: string;
    port: number;
    metadata?: Record<string, string>;
    healthCheck?: string;
}

export interface ServiceRegistry {
    register(instance: ServiceInstance): Promise<void>;
    deregister(instanceId: string): Promise<void>;
    discover(serviceName: string): Promise<ServiceInstance[]>;
    watch(serviceName: string, callback: (instances: ServiceInstance[]) => void): void;
}

// In-memory registry for development
class InMemoryRegistry implements ServiceRegistry {
    private instances = new Map<string, ServiceInstance>();
    private watchers = new Map<string, Set<(instances: ServiceInstance[]) => void>>();
    
    async register(instance: ServiceInstance): Promise<void> {
        this.instances.set(instance.id, instance);
        this.notifyWatchers(instance.name);
        console.log(\`Registered service: \${instance.name} at \${instance.host}:\${instance.port}\`);
    }
    
    async deregister(instanceId: string): Promise<void> {
        const instance = this.instances.get(instanceId);
        if (instance) {
            this.instances.delete(instanceId);
            this.notifyWatchers(instance.name);
            console.log(\`Deregistered service: \${instanceId}\`);
        }
    }
    
    async discover(serviceName: string): Promise<ServiceInstance[]> {
        return Array.from(this.instances.values())
            .filter(i => i.name === serviceName);
    }
    
    watch(serviceName: string, callback: (instances: ServiceInstance[]) => void): void {
        if (!this.watchers.has(serviceName)) {
            this.watchers.set(serviceName, new Set());
        }
        this.watchers.get(serviceName)!.add(callback);
    }
    
    private notifyWatchers(serviceName: string) {
        const watchers = this.watchers.get(serviceName);
        if (watchers) {
            const instances = Array.from(this.instances.values())
                .filter(i => i.name === serviceName);
            watchers.forEach(callback => callback(instances));
        }
    }
}

// Singleton registry
let registry: ServiceRegistry | null = null;

export function getRegistry(): ServiceRegistry {
    if (!registry) {
        registry = new InMemoryRegistry();
    }
    return registry;
}

// Load balancer for discovered services
export class LoadBalancer {
    private index = 0;
    
    constructor(private readonly registry: ServiceRegistry) {}
    
    async getNextInstance(serviceName: string): Promise<ServiceInstance | null> {
        const instances = await this.registry.discover(serviceName);
        if (instances.length === 0) return null;
        
        const instance = instances[this.index % instances.length];
        this.index++;
        return instance;
    }
}
`;

// ============================================
// MICROSERVICE AGENT CLASS
// ============================================

export class MicroserviceAgent {
    private config: MicroserviceConfig;

    constructor(config?: Partial<MicroserviceConfig>) {
        this.config = {
            serviceMesh: config?.serviceMesh || 'none',
            messageBroker: config?.messageBroker || 'kafka',
            communicationType: config?.communicationType || 'rest',
            serviceDiscovery: config?.serviceDiscovery ?? true,
            circuitBreaker: config?.circuitBreaker ?? true,
            tracing: config?.tracing ?? true,
        };
    }

    /**
     * Analyze requirements
     */
    async analyzeRequirements(userRequest: string): Promise<ServiceDefinition[]> {
        const services: ServiceDefinition[] = [];
        const request = userRequest.toLowerCase();

        // Default services based on request
        if (request.includes('user') || request.includes('auth')) {
            services.push({
                name: 'user-service',
                description: 'User management and authentication',
                port: 3001,
                dependencies: [],
                endpoints: [
                    { path: '/users', method: 'GET', description: 'List users' },
                    { path: '/users/:id', method: 'GET', description: 'Get user' },
                    { path: '/auth/login', method: 'POST', description: 'Login' },
                ],
            });
        }

        if (request.includes('order') || request.includes('payment')) {
            services.push({
                name: 'order-service',
                description: 'Order management',
                port: 3002,
                dependencies: ['user-service'],
                endpoints: [
                    { path: '/orders', method: 'GET', description: 'List orders' },
                    { path: '/orders', method: 'POST', description: 'Create order' },
                ],
                events: [
                    { name: 'OrderCreated', type: 'publish', topic: 'orders', schema: { orderId: 'string', userId: 'string' } },
                ],
            });
        }

        if (request.includes('product') || request.includes('inventory')) {
            services.push({
                name: 'product-service',
                description: 'Product catalog and inventory',
                port: 3003,
                dependencies: [],
                endpoints: [
                    { path: '/products', method: 'GET', description: 'List products' },
                    { path: '/products/:id', method: 'GET', description: 'Get product' },
                ],
            });
        }

        // Default if nothing specific
        if (services.length === 0) {
            services.push({
                name: 'api-gateway',
                description: 'API Gateway service',
                port: 3000,
                dependencies: [],
                endpoints: [],
            });
        }

        return services;
    }

    /**
     * Generate all microservice files
     */
    async generate(userRequest: string): Promise<MicroserviceGenerationResult> {
        const services = await this.analyzeRequirements(userRequest);
        const files: MicroserviceGeneratedFile[] = [];

        // Generate Saga Orchestrator
        files.push({
            path: 'src/patterns/saga-orchestrator.ts',
            content: SAGA_ORCHESTRATOR_TEMPLATE,
            type: 'service',
        });

        // Generate Circuit Breaker
        if (this.config.circuitBreaker) {
            files.push({
                path: 'src/patterns/circuit-breaker.ts',
                content: CIRCUIT_BREAKER_TEMPLATE,
                type: 'service',
            });
        }

        // Generate Service Discovery
        if (this.config.serviceDiscovery) {
            files.push({
                path: 'src/discovery/service-registry.ts',
                content: SERVICE_DISCOVERY_TEMPLATE,
                type: 'service',
            });
        }

        // Generate Kafka Producer/Consumer
        if (this.config.messageBroker === 'kafka') {
            files.push({
                path: 'src/events/kafka-producer.ts',
                content: KAFKA_PRODUCER_TEMPLATE.replace(/\{\{serviceName\}\}/g, 'app'),
                type: 'event',
            });

            files.push({
                path: 'src/events/kafka-consumer.ts',
                content: KAFKA_CONSUMER_TEMPLATE.replace(/\{\{serviceName\}\}/g, 'app'),
                type: 'event',
            });
        }

        // Generate gRPC files
        if (this.config.communicationType === 'grpc') {
            for (const service of services) {
                files.push({
                    path: `proto/${service.name}.proto`,
                    content: this.generateProtoFile(service),
                    type: 'proto',
                });

                files.push({
                    path: `src/grpc/${service.name}-server.ts`,
                    content: GRPC_SERVER_TEMPLATE
                        .replace(/\{\{service\}\}/g, service.name)
                        .replace(/\{\{package\}\}/g, service.name.replace(/-/g, ''))
                        .replace(/\{\{serviceName\}\}/g, this.toPascalCase(service.name)),
                    type: 'service',
                });
            }
        }

        return {
            success: true,
            files,
            services: services.map(s => s.name),
            architecture: `${this.config.communicationType} with ${this.config.messageBroker}`,
        };
    }

    private generateProtoFile(service: ServiceDefinition): string {
        const packageName = service.name.replace(/-/g, '');
        const serviceName = this.toPascalCase(service.name);

        return `syntax = "proto3";

package ${packageName};

service ${serviceName}Service {
    rpc GetById(GetRequest) returns (${serviceName}Response);
    rpc List(ListRequest) returns (${serviceName}ListResponse);
    rpc Create(Create${serviceName}Request) returns (${serviceName}Response);
}

message GetRequest {
    string id = 1;
}

message ListRequest {
    int32 page = 1;
    int32 limit = 2;
}

message ${serviceName}Response {
    string id = 1;
    string name = 2;
    string created_at = 3;
}

message ${serviceName}ListResponse {
    repeated ${serviceName}Response items = 1;
    int32 total = 2;
}

message Create${serviceName}Request {
    string name = 1;
}
`;
    }

    private toPascalCase(str: string): string {
        return str
            .split(/[-_\s]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }
}

// ============================================
// SINGLETON
// ============================================

let microserviceAgent: MicroserviceAgent | null = null;

export function getMicroserviceAgent(): MicroserviceAgent {
    if (!microserviceAgent) {
        microserviceAgent = new MicroserviceAgent();
    }
    return microserviceAgent;
}

export const microserviceAgentInstance = getMicroserviceAgent();
export default microserviceAgentInstance;
