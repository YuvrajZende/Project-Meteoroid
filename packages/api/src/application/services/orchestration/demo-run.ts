/**
 * Demo Run
 * Simulates a full orchestration without calling any model or search provider.
 * Emits the same live events as a real run (thinking, web search, sub-agents, files)
 * and writes a small sample project, so the UI can be explored with no API keys.
 */

import { broadcastActivity, broadcastPipelineStep } from '../../../routes/websocket.js';
import { getFileWriter } from '../../../infrastructure/file-writer.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface DemoRunInput {
    projectId: string;
    taskId: string;
    prompt: string;
    maxSubtasks?: number;
    useWebSearch?: boolean;
    customAgents?: Array<{ id: string; name: string; role: string }>;
}

export interface DemoRunResult {
    success: boolean;
    taskId: string;
    projectId: string;
    totalDuration: number;
    steps: number;
    agentsExecuted: string[];
    generatedCode: Array<{ subtask: string; code: string; explanation: string; agent: string }>;
    intentAnalysis: { intent: string; confidence: number; language: string; framework: string; reasoning: string };
    vectorLearningUsed: boolean;
    filesWritten: string[];
    errors: string[];
}

const SUBTASKS = [
    { title: 'JWT authentication with refresh tokens', agent: 'auth-agent', files: ['src/auth/jwt.ts', 'src/auth/routes.ts'] },
    { title: 'Postgres schema and data access', agent: 'database-agent', files: ['src/db/schema.sql', 'src/db/client.ts'] },
    { title: 'Todo CRUD routes with pagination', agent: 'api-agent', files: ['src/routes/todos.ts'] },
    { title: 'Rate limiting and security headers', agent: 'security-agent', files: ['src/plugins/security.ts'] },
    { title: 'Health checks and structured logging', agent: 'monitoring-agent', files: ['src/plugins/health.ts'] },
];

const SOURCES = [
    { title: 'Fastify – Getting Started', url: 'https://fastify.dev/docs/latest/Guides/Getting-Started/' },
    { title: '@fastify/jwt – npm', url: 'https://www.npmjs.com/package/@fastify/jwt' },
    { title: 'node-postgres – Pooling', url: 'https://node-postgres.com/features/pooling' },
    { title: 'OWASP – Authentication Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html' },
];

const FILE_CONTENTS: Record<string, string> = {
    'package.json': JSON.stringify({
        name: 'todo-api',
        version: '1.0.0',
        type: 'module',
        scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' },
        dependencies: { fastify: '^5.0.0', '@fastify/jwt': '^9.0.0', '@fastify/rate-limit': '^10.0.0', '@fastify/helmet': '^12.0.0', pg: '^8.13.0', zod: '^3.23.0' },
        devDependencies: { typescript: '^5.7.0', tsx: '^4.19.0', '@types/pg': '^8.11.0' },
    }, null, 2) + '\n',
    'tsconfig.json': JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, outDir: 'dist', rootDir: 'src', esModuleInterop: true, skipLibCheck: true },
        include: ['src'],
    }, null, 2) + '\n',
    '.env.example': 'PORT=3000\nDATABASE_URL=postgres://user:password@localhost:5432/todos\nJWT_SECRET=change-me-to-a-32-char-random-string\n',
    'README.md': '# Todo API\n\nFastify + Postgres todo API with JWT auth, pagination and rate limiting.\n\n## Run\n\n```bash\nnpm install\ncp .env.example .env\npsql "$DATABASE_URL" -f src/db/schema.sql\nnpm run dev\n```\n\n## Endpoints\n\n| Method | Path | Auth |\n|---|---|---|\n| POST | /auth/register | – |\n| POST | /auth/login | – |\n| POST | /auth/refresh | – |\n| GET | /todos?page=1&limit=20 | Bearer |\n| POST | /todos | Bearer |\n| PATCH | /todos/:id | Bearer |\n| DELETE | /todos/:id | Bearer |\n| GET | /health | – |\n\n> Generated in Meteoroid demo mode.\n',
    'src/index.ts': `import Fastify from 'fastify';
import { authRoutes } from './auth/routes.js';
import { registerJwt } from './auth/jwt.js';
import { security } from './plugins/security.js';
import { health } from './plugins/health.js';
import { todoRoutes } from './routes/todos.js';

const app = Fastify({ logger: true });

await app.register(security);
await app.register(registerJwt);
await app.register(health);
await app.register(authRoutes, { prefix: '/auth' });
await app.register(todoRoutes, { prefix: '/todos' });

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
`,
    'src/auth/jwt.ts': `import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters');
}

export const registerJwt = fp(async (app) => {
  await app.register(jwt, { secret, sign: { expiresIn: '15m' } });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
`,
    'src/auth/routes.ts': `import type { FastifyInstance } from 'fastify';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { db } from '../db/client.js';

const scryptAsync = promisify(scrypt);
const Credentials = z.object({ email: z.string().email(), password: z.string().min(8) });

async function hash(password: string) {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return \`\${salt.toString('hex')}:\${key.toString('hex')}\`;
}

async function verify(password: string, stored: string) {
  const [salt, key] = stored.split(':');
  const derived = (await scryptAsync(password, Buffer.from(salt, 'hex'), 64)) as Buffer;
  return timingSafeEqual(derived, Buffer.from(key, 'hex'));
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const { email, password } = Credentials.parse(request.body);
    const { rows } = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase(), await hash(password)],
    );
    return reply.code(201).send(rows[0]);
  });

  app.post('/login', async (request, reply) => {
    const { email, password } = Credentials.parse(request.body);
    const { rows } = await db.query('SELECT id, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!rows[0] || !(await verify(password, rows[0].password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    return { accessToken: app.jwt.sign({ sub: rows[0].id }) };
  });
}
`,
    'src/db/schema.sql': `CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS todos_user_created_idx ON todos (user_id, created_at DESC);
`,
    'src/db/client.ts': `import pg from 'pg';

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});
`,
    'src/routes/todos.ts': `import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';

const Page = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
const NewTodo = z.object({ title: z.string().min(1).max(200) });
const Patch = z.object({ title: z.string().min(1).max(200).optional(), done: z.boolean().optional() });

export async function todoRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (request) => {
    const { page, limit } = Page.parse(request.query);
    const { rows } = await db.query(
      'SELECT id, title, done, created_at FROM todos WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [request.user.sub, limit, (page - 1) * limit],
    );
    return { page, limit, items: rows };
  });

  app.post('/', async (request, reply) => {
    const { title } = NewTodo.parse(request.body);
    const { rows } = await db.query(
      'INSERT INTO todos (user_id, title) VALUES ($1, $2) RETURNING id, title, done, created_at',
      [request.user.sub, title],
    );
    return reply.code(201).send(rows[0]);
  });

  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const patch = Patch.parse(request.body);
    const { rows } = await db.query(
      'UPDATE todos SET title = COALESCE($3, title), done = COALESCE($4, done) WHERE id = $1 AND user_id = $2 RETURNING id, title, done',
      [request.params.id, request.user.sub, patch.title ?? null, patch.done ?? null],
    );
    return rows[0] ?? reply.code(404).send({ error: 'Not found' });
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { rowCount } = await db.query('DELETE FROM todos WHERE id = $1 AND user_id = $2', [request.params.id, request.user.sub]);
    return rowCount ? reply.code(204).send() : reply.code(404).send({ error: 'Not found' });
  });
}
`,
    'src/plugins/security.ts': `import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

export const security = fp(async (app) => {
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
});
`,
    'src/plugins/health.ts': `import fp from 'fastify-plugin';
import { db } from '../db/client.js';

export const health = fp(async (app) => {
  app.get('/health', async () => {
    await db.query('SELECT 1');
    return { status: 'ok', uptime: process.uptime() };
  });
});
`,
};

export async function runDemo(input: DemoRunInput): Promise<DemoRunResult> {
    const start = Date.now();
    const writer = getFileWriter();
    let step = 0;
    const log = (phase: string, message: string, agent?: string) => broadcastPipelineStep(++step, phase, message, agent);

    log('init', 'Starting orchestration pipeline (demo mode)...');
    await sleep(500);
    log('init', 'Detecting user intent...');
    await sleep(700);
    log('init', 'Intent: FULL_BACKEND (94%)');
    await sleep(400);
    log('init', 'Extracted 2 entities: User, Todo');

    // Thinking
    log('thinking', 'Analyzing task...');
    broadcastActivity({ kind: 'thinking', status: 'start' });
    const thinkStart = Date.now();
    await sleep(900);
    log('thinking', 'Choosing stack: TypeScript + Fastify + Postgres');
    await sleep(900);
    log('thinking', 'Planning auth, data, routes and hardening as separate subtasks');
    await sleep(800);

    const custom = input.customAgents ?? [];
    const builtIn = Math.min(Math.max((input.maxSubtasks ?? 3) - custom.length, 1), SUBTASKS.length);
    const plan = [
        ...SUBTASKS.slice(0, builtIn),
        ...custom.map(a => {
            const path = `docs/${a.id.replace(/^custom-/, '')}.md`;
            FILE_CONTENTS[path] = `# ${a.name}

${a.role}

Demo output produced by your custom agent.
`;
            return { title: `${a.name}: ${a.role}`, agent: a.id, files: [path] };
        }),
    ];
    const count = plan.length;
    broadcastActivity({
        kind: 'thinking',
        status: 'end',
        complexity: count > 3 ? 'high' : 'medium',
        summary: `Split into ${count} subtasks for ${plan.map(p => p.agent).join(', ')}`,
        durationMs: Date.now() - thinkStart,
    });
    log('agent-selection', `Selected ${count} agents`);
    broadcastActivity({ kind: 'plan', subtasks: plan.map((p, id) => ({ id, title: p.title, agent: p.agent })) });
    await sleep(600);

    // Web research
    if (input.useWebSearch !== false) {
        const query = 'fastify typescript postgres jwt todo api best practices latest';
        const toolId = `search-${Date.now()}`;
        const searchStart = Date.now();
        log('research', `Searching the web: ${query}`);
        broadcastActivity({ kind: 'tool', id: toolId, tool: 'web_search', status: 'running', query });
        await sleep(2200);
        broadcastActivity({ kind: 'tool', id: toolId, tool: 'web_search', status: 'done', query, results: SOURCES, durationMs: Date.now() - searchStart });
        log('research', `Found ${SOURCES.length} sources`);
        await sleep(500);
    }

    // Sub-agents run concurrently with staggered finish times
    log('execution', `Processing ${count} subtasks (concurrency 3)...`);
    await writer.writeFileImmediate(input.projectId, { path: 'package.json', content: FILE_CONTENTS['package.json'] });
    await writer.writeFileImmediate(input.projectId, { path: 'tsconfig.json', content: FILE_CONTENTS['tsconfig.json'] });

    await Promise.all(plan.map(async (sub, id) => {
        await sleep(id * 700);
        const agentStart = Date.now();
        broadcastActivity({ kind: 'agent', id, agent: sub.agent, status: 'running' });
        log('execution', `Agent "${sub.agent}" processing subtask ${id + 1}/${count}`, sub.agent);
        await sleep(2500 + id * 1500);
        for (const path of sub.files) {
            await writer.writeFileImmediate(input.projectId, { path, content: FILE_CONTENTS[path] });
            log('file_write', `Writing ${path}`, sub.agent);
            await sleep(400);
        }
        broadcastActivity({ kind: 'agent', id, agent: sub.agent, status: 'done', files: sub.files.length, durationMs: Date.now() - agentStart });
        log('code-generation', `Code generated (${sub.files.length} files)`, sub.agent);
    }));

    for (const path of ['src/index.ts', '.env.example', 'README.md']) {
        await writer.writeFileImmediate(input.projectId, { path, content: FILE_CONTENTS[path] });
        log('file_write', `Writing ${path}`);
        await sleep(300);
    }
    log('quality', 'Quality: 92/100 (demo)');
    log('finalize', 'Done.');

    const filesWritten = await writer.listProjectFiles(input.projectId);
    return {
        success: true,
        taskId: input.taskId,
        projectId: input.projectId,
        totalDuration: Date.now() - start,
        steps: step,
        agentsExecuted: plan.map(p => p.agent),
        generatedCode: plan.map(p => ({
            subtask: p.title,
            code: p.files.map(f => `// ${f}\n${FILE_CONTENTS[f]}`).join('\n'),
            explanation: `Demo output for ${p.title.toLowerCase()}.`,
            agent: p.agent,
        })),
        intentAnalysis: {
            intent: 'FULL_BACKEND',
            confidence: 0.94,
            language: 'typescript',
            framework: 'fastify',
            reasoning: 'Demo mode: a REST API with authentication and persistence maps to a full backend.',
        },
        vectorLearningUsed: false,
        filesWritten: filesWritten.filter(f => !f.startsWith('.meteoroid')),
        errors: [],
    };
}
