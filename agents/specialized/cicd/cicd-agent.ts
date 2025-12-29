/**
 * ============================================
 * CI/CD AGENT - CORE IMPLEMENTATION
 * ============================================
 * 
 * The CI/CD Agent is responsible for generating pipeline
 * configurations for various CI/CD platforms.
 * 
 * Capabilities:
 * - GitHub Actions workflow generation
 * - GitLab CI pipeline generation
 * - Docker/Dockerfile generation
 * - Kubernetes deployment configs
 * - Environment configuration
 * 
 * @author Person 3 (API Specialist)
 */

// ============================================
// TYPES
// ============================================

export type CICDPlatform = 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci' | 'azure-devops';
export type DeploymentTarget = 'docker' | 'kubernetes' | 'vercel' | 'netlify' | 'aws' | 'gcp' | 'azure';
export type BuildTool = 'npm' | 'yarn' | 'pnpm' | 'bun';

export interface CICDAgentConfig {
    platform: CICDPlatform;
    deploymentTarget: DeploymentTarget;
    buildTool: BuildTool;
    nodeVersion: string;
    testEnabled: boolean;
    lintEnabled: boolean;
    cacheEnabled: boolean;
}

export interface WorkflowDefinition {
    name: string;
    triggers: WorkflowTrigger[];
    jobs: JobDefinition[];
    environment?: Record<string, string>;
}

export interface WorkflowTrigger {
    type: 'push' | 'pull_request' | 'schedule' | 'workflow_dispatch' | 'release';
    branches?: string[];
    tags?: string[];
    paths?: string[];
    cron?: string;
}

export interface JobDefinition {
    name: string;
    runsOn: string;
    needs?: string[];
    steps: StepDefinition[];
    environment?: string;
    condition?: string;
}

export interface StepDefinition {
    name: string;
    uses?: string;
    run?: string;
    with?: Record<string, string>;
    env?: Record<string, string>;
    condition?: string;
}

export interface CICDGeneratedFile {
    path: string;
    content: string;
    type: 'workflow' | 'dockerfile' | 'kubernetes' | 'config';
}

export interface CICDGenerationResult {
    success: boolean;
    files: CICDGeneratedFile[];
    workflows: string[];
    platform: CICDPlatform;
}

// ============================================
// TEMPLATES
// ============================================

const GITHUB_ACTIONS_CI_TEMPLATE = `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '{{nodeVersion}}'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: '{{buildTool}}'
      
      - name: Install dependencies
        run: {{installCommand}}
      
      {{#if lintEnabled}}
      - name: Run linter
        run: {{lintCommand}}
      {{/if}}
      
      {{#if testEnabled}}
      - name: Run tests
        run: {{testCommand}}
      {{/if}}
      
      - name: Build
        run: {{buildCommand}}

  {{#if dockerEnabled}}
  docker:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ secrets.REGISTRY_URL }}
          username: \${{ secrets.REGISTRY_USERNAME }}
          password: \${{ secrets.REGISTRY_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ secrets.REGISTRY_URL }}/\${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
  {{/if}}
`;

const GITHUB_ACTIONS_CD_TEMPLATE = `name: CD

on:
  push:
    branches: [main]
  release:
    types: [published]

env:
  NODE_VERSION: '{{nodeVersion}}'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: '{{buildTool}}'
      
      - name: Install dependencies
        run: {{installCommand}}
      
      - name: Build
        run: {{buildCommand}}
        env:
          NODE_ENV: production
      
      {{#if k8sEnabled}}
      - name: Configure kubectl
        uses: azure/setup-kubectl@v3
      
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f k8s/
          kubectl rollout status deployment/{{appName}}
      {{/if}}
      
      {{#if vercelEnabled}}
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
      {{/if}}
`;

const DOCKERFILE_NODE_TEMPLATE = `# Build stage
FROM node:{{nodeVersion}}-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
{{#if yarnLock}}
COPY yarn.lock ./
{{/if}}
{{#if pnpmLock}}
COPY pnpm-lock.yaml ./
{{/if}}

# Install dependencies
RUN {{installCommand}}

# Copy source code
COPY . .

# Build application
RUN {{buildCommand}}

# Production stage
FROM node:{{nodeVersion}}-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
`;

const DOCKER_COMPOSE_TEMPLATE = `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=\${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=\${DB_USER:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_NAME:-app}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`;

const K8S_DEPLOYMENT_TEMPLATE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{appName}}
  labels:
    app: {{appName}}
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{appName}}
  template:
    metadata:
      labels:
        app: {{appName}}
    spec:
      containers:
        - name: {{appName}}
          image: {{imageName}}:{{imageTag}}
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{appName}}-secrets
                  key: database-url
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: {{appName}}
spec:
  selector:
    app: {{appName}}
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{appName}}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - {{domain}}
      secretName: {{appName}}-tls
  rules:
    - host: {{domain}}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{appName}}
                port:
                  number: 80
`;

const GITLAB_CI_TEMPLATE = `stages:
  - build
  - test
  - deploy

variables:
  NODE_VERSION: "{{nodeVersion}}"

.node-cache:
  cache:
    key: \$CI_COMMIT_REF_SLUG
    paths:
      - node_modules/
    policy: pull-push

build:
  stage: build
  image: node:\$NODE_VERSION
  extends: .node-cache
  script:
    - {{installCommand}}
    - {{buildCommand}}
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

test:
  stage: test
  image: node:\$NODE_VERSION
  extends: .node-cache
  script:
    - {{installCommand}}
    - {{testCommand}}
  coverage: '/All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/'

deploy:
  stage: deploy
  image: docker:latest
  services:
    - docker:dind
  only:
    - main
  script:
    - docker build -t \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA .
    - docker push \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA
`;

// ============================================
// CICD AGENT CLASS
// ============================================

export class CICDAgent {
    private config: CICDAgentConfig;

    constructor(config?: Partial<CICDAgentConfig>) {
        this.config = {
            platform: config?.platform || 'github-actions',
            deploymentTarget: config?.deploymentTarget || 'docker',
            buildTool: config?.buildTool || 'npm',
            nodeVersion: config?.nodeVersion || '20',
            testEnabled: config?.testEnabled ?? true,
            lintEnabled: config?.lintEnabled ?? true,
            cacheEnabled: config?.cacheEnabled ?? true,
        };
    }

    /**
     * Analyze requirements and determine CI/CD configurations needed
     */
    async analyzeRequirements(userRequest: string): Promise<WorkflowDefinition[]> {
        const workflows: WorkflowDefinition[] = [];
        const request = userRequest.toLowerCase();

        // Determine workflows needed
        if (request.includes('ci') || request.includes('test') || request.includes('build')) {
            workflows.push(this.createCIWorkflow());
        }

        if (request.includes('cd') || request.includes('deploy') || request.includes('release')) {
            workflows.push(this.createCDWorkflow());
        }

        // If nothing specific, create both
        if (workflows.length === 0) {
            workflows.push(this.createCIWorkflow());
            workflows.push(this.createCDWorkflow());
        }

        return workflows;
    }

    private createCIWorkflow(): WorkflowDefinition {
        return {
            name: 'CI',
            triggers: [
                { type: 'push', branches: ['main', 'develop'] },
                { type: 'pull_request', branches: ['main'] },
            ],
            jobs: [
                {
                    name: 'build',
                    runsOn: 'ubuntu-latest',
                    steps: [
                        { name: 'Checkout', uses: 'actions/checkout@v4' },
                        { name: 'Setup Node.js', uses: 'actions/setup-node@v4' },
                        { name: 'Install dependencies', run: this.getInstallCommand() },
                        { name: 'Lint', run: this.getLintCommand() },
                        { name: 'Test', run: this.getTestCommand() },
                        { name: 'Build', run: this.getBuildCommand() },
                    ],
                },
            ],
        };
    }

    private createCDWorkflow(): WorkflowDefinition {
        return {
            name: 'CD',
            triggers: [
                { type: 'push', branches: ['main'] },
                { type: 'release', tags: ['v*'] },
            ],
            jobs: [
                {
                    name: 'deploy',
                    runsOn: 'ubuntu-latest',
                    environment: 'production',
                    steps: [
                        { name: 'Checkout', uses: 'actions/checkout@v4' },
                        { name: 'Setup Node.js', uses: 'actions/setup-node@v4' },
                        { name: 'Install dependencies', run: this.getInstallCommand() },
                        { name: 'Build', run: this.getBuildCommand() },
                        { name: 'Deploy', run: 'echo "Deploy step"' },
                    ],
                },
            ],
        };
    }

    private getInstallCommand(): string {
        switch (this.config.buildTool) {
            case 'yarn': return 'yarn install --frozen-lockfile';
            case 'pnpm': return 'pnpm install --frozen-lockfile';
            case 'bun': return 'bun install --frozen-lockfile';
            default: return 'npm ci';
        }
    }

    private getLintCommand(): string {
        switch (this.config.buildTool) {
            case 'yarn': return 'yarn lint';
            case 'pnpm': return 'pnpm lint';
            case 'bun': return 'bun run lint';
            default: return 'npm run lint';
        }
    }

    private getTestCommand(): string {
        switch (this.config.buildTool) {
            case 'yarn': return 'yarn test';
            case 'pnpm': return 'pnpm test';
            case 'bun': return 'bun test';
            default: return 'npm test';
        }
    }

    private getBuildCommand(): string {
        switch (this.config.buildTool) {
            case 'yarn': return 'yarn build';
            case 'pnpm': return 'pnpm build';
            case 'bun': return 'bun run build';
            default: return 'npm run build';
        }
    }

    /**
     * Generate GitHub Actions workflow
     */
    generateGitHubActionsCI(): string {
        return GITHUB_ACTIONS_CI_TEMPLATE
            .replace(/\{\{nodeVersion\}\}/g, this.config.nodeVersion)
            .replace(/\{\{buildTool\}\}/g, this.config.buildTool)
            .replace(/\{\{installCommand\}\}/g, this.getInstallCommand())
            .replace(/\{\{lintCommand\}\}/g, this.getLintCommand())
            .replace(/\{\{testCommand\}\}/g, this.getTestCommand())
            .replace(/\{\{buildCommand\}\}/g, this.getBuildCommand())
            .replace(/\{\{#if lintEnabled\}\}[\s\S]*?\{\{\/if\}\}/g,
                this.config.lintEnabled ? '' : '')
            .replace(/\{\{#if testEnabled\}\}[\s\S]*?\{\{\/if\}\}/g,
                this.config.testEnabled ? '' : '');
    }

    /**
     * Generate Dockerfile
     */
    generateDockerfile(): string {
        const lockFile = this.config.buildTool === 'yarn' ? 'yarn.lock' :
            this.config.buildTool === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json';

        return DOCKERFILE_NODE_TEMPLATE
            .replace(/\{\{nodeVersion\}\}/g, this.config.nodeVersion)
            .replace(/\{\{installCommand\}\}/g, this.getInstallCommand())
            .replace(/\{\{buildCommand\}\}/g, this.getBuildCommand())
            .replace(/\{\{#if yarnLock\}\}[\s\S]*?\{\{\/if\}\}/g,
                this.config.buildTool === 'yarn' ? `COPY yarn.lock ./` : '')
            .replace(/\{\{#if pnpmLock\}\}[\s\S]*?\{\{\/if\}\}/g,
                this.config.buildTool === 'pnpm' ? `COPY pnpm-lock.yaml ./` : '');
    }

    /**
     * Generate Docker Compose
     */
    generateDockerCompose(): string {
        return DOCKER_COMPOSE_TEMPLATE;
    }

    /**
     * Generate Kubernetes manifests
     */
    generateKubernetesManifests(appName: string, domain: string): string {
        return K8S_DEPLOYMENT_TEMPLATE
            .replace(/\{\{appName\}\}/g, appName)
            .replace(/\{\{imageName\}\}/g, `${appName}`)
            .replace(/\{\{imageTag\}\}/g, 'latest')
            .replace(/\{\{replicas\}\}/g, '3')
            .replace(/\{\{domain\}\}/g, domain);
    }

    /**
     * Generate all CI/CD files
     */
    async generate(userRequest: string): Promise<CICDGenerationResult> {
        const files: CICDGeneratedFile[] = [];
        const workflows: string[] = [];
        const request = userRequest.toLowerCase();

        // Generate GitHub Actions workflows
        if (this.config.platform === 'github-actions') {
            files.push({
                path: '.github/workflows/ci.yml',
                content: this.generateGitHubActionsCI(),
                type: 'workflow',
            });
            workflows.push('ci');

            if (request.includes('deploy') || request.includes('cd')) {
                files.push({
                    path: '.github/workflows/cd.yml',
                    content: GITHUB_ACTIONS_CD_TEMPLATE
                        .replace(/\{\{nodeVersion\}\}/g, this.config.nodeVersion)
                        .replace(/\{\{buildTool\}\}/g, this.config.buildTool)
                        .replace(/\{\{installCommand\}\}/g, this.getInstallCommand())
                        .replace(/\{\{buildCommand\}\}/g, this.getBuildCommand()),
                    type: 'workflow',
                });
                workflows.push('cd');
            }
        }

        // Generate GitLab CI
        if (this.config.platform === 'gitlab-ci') {
            files.push({
                path: '.gitlab-ci.yml',
                content: GITLAB_CI_TEMPLATE
                    .replace(/\{\{nodeVersion\}\}/g, this.config.nodeVersion)
                    .replace(/\{\{installCommand\}\}/g, this.getInstallCommand())
                    .replace(/\{\{testCommand\}\}/g, this.getTestCommand())
                    .replace(/\{\{buildCommand\}\}/g, this.getBuildCommand()),
                type: 'workflow',
            });
            workflows.push('gitlab-ci');
        }

        // Generate Docker files
        if (request.includes('docker') || this.config.deploymentTarget === 'docker') {
            files.push({
                path: 'Dockerfile',
                content: this.generateDockerfile(),
                type: 'dockerfile',
            });

            files.push({
                path: 'docker-compose.yml',
                content: this.generateDockerCompose(),
                type: 'dockerfile',
            });

            files.push({
                path: '.dockerignore',
                content: `node_modules\nnpm-debug.log\n.env\n.git\n.gitignore\nREADME.md\ndist\ncoverage`,
                type: 'config',
            });
        }

        // Generate Kubernetes manifests
        if (request.includes('kubernetes') || request.includes('k8s') ||
            this.config.deploymentTarget === 'kubernetes') {
            const appName = 'app';
            const domain = 'app.example.com';

            files.push({
                path: 'k8s/deployment.yaml',
                content: this.generateKubernetesManifests(appName, domain),
                type: 'kubernetes',
            });
        }

        return {
            success: true,
            files,
            workflows,
            platform: this.config.platform,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let cicdAgent: CICDAgent | null = null;

export function getCICDAgent(): CICDAgent {
    if (!cicdAgent) {
        cicdAgent = new CICDAgent();
    }
    return cicdAgent;
}

export const cicdAgentInstance = getCICDAgent();
export default cicdAgentInstance;
