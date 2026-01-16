# GitHub Actions - Complete Guide

## 🌟 What Is GitHub Actions?

GitHub Actions is a CI/CD (Continuous Integration/Continuous Deployment) platform that allows you to automate your software development workflows directly within GitHub. Think of it as **having a team of robots that automatically build, test, and deploy your code every time you make changes**.

### **The Assembly Line Analogy**
- **Manual Process**: You manually build, test, and deploy each change
- **GitHub Actions**: Automated assembly line that builds, tests, and deploys automatically

### **Core Philosophy**
- **Event-Driven**: Workflows trigger on specific events (push, PR, etc.)
- **YAML Configuration**: Define workflows in simple YAML files
- **Parallel Execution**: Run multiple jobs simultaneously
- **Marketplace**: Extensive ecosystem of pre-built actions

## 🎯 Why We Use GitHub Actions in This Project

### **Perfect for API Generation CI/CD**
GitHub Actions provides ideal automation for our API generation platform:
- **Automated Testing**: Test generated APIs automatically
- **Multi-Environment Support**: Deploy to staging and production
- **Parallel Processing**: Generate and test multiple APIs simultaneously
- **Integration Testing**: Test integration between components

### **Developer Experience Benefits**
- **Native GitHub Integration**: No external services needed
- **Visual Workflow Editor**: Easy to create and debug workflows
- **Artifact Storage**: Store build artifacts and test results
- **Secret Management**: Secure handling of API keys and credentials

### **Enterprise-Ready Features**
- **Scalability**: Run multiple workflows in parallel
- **Security**: Built-in security scanning and dependency checks
- **Compliance**: Audit logs and approval workflows
- **Monitoring**: Built-in workflow monitoring and alerting

## 🏗️ Key Features & Concepts

### **1. Workflows**
Workflows are automated processes that run in response to events.

```yaml
# .github/workflows/api-generation.yml
name: API Generation Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      api_type:
        description: 'Type of API to generate'
        required: true
        default: 'rest'
        type: choice
        options:
        - rest
        - graphql
        - trpc

jobs:
  generate-api:
    runs-on: ubuntu-latest
    steps:
      - name: Generate API
        run: echo "Generating ${{ github.event.inputs.api_type }} API"
```

**Workflow Triggers:**
- **Push**: Code pushed to repository
- **Pull Request**: PR opened or updated
- **Schedule**: Cron-based triggers
- **Manual**: workflow_dispatch for manual execution
- **Webhook**: External service triggers

### **2. Jobs**
Jobs are individual units of work within a workflow.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run Tests
        run: npm test

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: Build Application
        run: npm run build

  deploy:
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        run: npm run deploy
```

**Job Features:**
- **Dependencies**: Jobs can depend on other jobs
- **Parallel Execution**: Multiple jobs run simultaneously
- **Conditional Execution**: Jobs run based on conditions
- **Matrix Strategy**: Run jobs with different configurations

### **3. Steps**
Steps are individual commands within a job.

```yaml
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      # Checkout code
      - name: Checkout repository
        uses: actions/checkout@v4

      # Setup Node.js
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Install dependencies
      - name: Install dependencies
        run: npm ci

      # Run linting
      - name: Run linting
        run: npm run lint

      # Run tests
      - name: Run tests
        run: npm run test:coverage

      # Upload coverage
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

**Step Types:**
- **Run**: Execute shell commands
- **Uses**: Use pre-built actions from marketplace
- **With**: Pass parameters to actions
- **Env**: Set environment variables

### **4. Actions**
Actions are reusable units of code that can be used in workflows.

```yaml
# Using pre-built actions
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'

- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_PASSWORD }}

# Custom action in repository
- name: Generate API
  uses: ./.github/actions/generate-api
  with:
    type: 'rest'
    framework: 'nestjs'
```

**Action Types:**
- **Official Actions**: Maintained by GitHub
- **Marketplace Actions**: Community-contributed
- **Local Actions**: Custom actions in your repository
- **Docker Actions**: Actions that run in Docker containers

## 🚀 Deep Dive: Technical Implementation

### **Workflow for API Generation**
```yaml
# .github/workflows/api-generation.yml
name: API Generation and Testing

on:
  push:
    branches: [main, develop]
    paths: ['api-specs/**']
  pull_request:
    branches: [main]
    paths: ['api-specs/**']
  workflow_dispatch:
    inputs:
      spec_file:
        description: 'API specification file'
        required: true
        default: 'api-specs/user-api.json'

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Job 1: Validate API specifications
  validate-specs:
    runs-on: ubuntu-latest
    outputs:
      spec-files: ${{ steps.list-files.outputs.files }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: List specification files
        id: list-files
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "files=${{ github.event.inputs.spec_file }}" >> $GITHUB_OUTPUT
          else
            files=$(find api-specs -name "*.json" -type f | tr '\n' ' ')
            echo "files=$files" >> $GITHUB_OUTPUT
          fi

      - name: Validate API specifications
        run: |
          for file in ${{ steps.list-files.outputs.files }}; do
            echo "Validating $file"
            npm run validate-spec -- "$file"
          done

  # Job 2: Generate APIs (matrix strategy)
  generate-apis:
    runs-on: ubuntu-latest
    needs: validate-specs
    strategy:
      matrix:
        api-type: [rest, graphql, trpc]
        framework: [nestjs, express, fastify]
        exclude:
          - api-type: trpc
            framework: express
          - api-type: trpc
            framework: fastify
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate API
        run: |
          for spec in ${{ needs.validate-specs.outputs.spec-files }}; do
            echo "Generating ${{ matrix.api-type }} API with ${{ matrix.framework }} from $spec"
            npm run generate-api \
              -- --type="${{ matrix.api-type }}" \
              --framework="${{ matrix.framework }}" \
              --spec="$spec" \
              --output="generated/${{ matrix.api-type }}-${{ matrix.framework }}"
          done

      - name: Upload generated APIs
        uses: actions/upload-artifact@v4
        with:
          name: generated-api-${{ matrix.api-type }}-${{ matrix.framework }}
          path: generated/
          retention-days: 7

  # Job 3: Test generated APIs
  test-apis:
    runs-on: ubuntu-latest
    needs: generate-apis
    strategy:
      matrix:
        api-type: [rest, graphql, trpc]
        framework: [nestjs, express, fastify]
        exclude:
          - api-type: trpc
            framework: express
          - api-type: trpc
            framework: fastify
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Download generated APIs
        uses: actions/download-artifact@v4
        with:
          name: generated-api-${{ matrix.api-type }}-${{ matrix.framework }}
          path: generated/

      - name: Install generated API dependencies
        run: |
          cd "generated/${{ matrix.api-type }}-${{ matrix.framework }}"
          npm ci

      - name: Start API server
        run: |
          cd "generated/${{ matrix.api-type }}-${{ matrix.framework }}"
          npm run start &
          sleep 10

      - name: Run API tests
        run: |
          cd "generated/${{ matrix.api-type }}-${{ matrix.framework }}"
          npm run test

      - name: Run integration tests
        run: |
          npm run test:integration -- \
            --api-type="${{ matrix.api-type }}" \
            --framework="${{ matrix.framework }}" \
            --url="http://localhost:3000"

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.api-type }}-${{ matrix.framework }}
          path: |
            generated/*/coverage/
            generated/*/test-results/

  # Job 4: Security scanning
  security-scan:
    runs-on: ubuntu-latest
    needs: generate-apis
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Download generated APIs
        uses: actions/download-artifact@v4
        with:
          pattern: generated-api-*
          path: generated/
          merge-multiple: true

      - name: Run security scan
        run: |
          npm install -g audit-ci
          for api_dir in generated/*/; do
            echo "Scanning $api_dir"
            cd "$api_dir"
            npm ci
            audit-ci --moderate
            cd ../..
          done

      - name: Run SAST scan
        uses: github/super-linter@v4
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VALIDATE_JAVASCRIPT_ES: true
          VALIDATE_TYPESCRIPT_ES: true

  # Job 5: Build and push Docker images
  build-and-push:
    runs-on: ubuntu-latest
    needs: [generate-apis, test-apis, security-scan]
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        api-type: [rest, graphql, trpc]
        framework: [nestjs, express, fastify]
        exclude:
          - api-type: trpc
            framework: express
          - api-type: trpc
            framework: fastify
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Download generated APIs
        uses: actions/download-artifact@v4
        with:
          name: generated-api-${{ matrix.api-type }}-${{ matrix.framework }}
          path: generated/

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.api-type }}-${{ matrix.framework }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: generated/${{ matrix.api-type }}-${{ matrix.framework }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Job 6: Deploy to staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment"
          # Add deployment commands here

  # Job 7: Deploy to production
  deploy-production:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying to production environment"
          # Add deployment commands here
```

### **Custom Action for API Generation**
```yaml
# .github/actions/generate-api/action.yml
name: 'Generate API'
description: 'Generate API from specifications'
inputs:
  type:
    description: 'Type of API to generate'
    required: true
    default: 'rest'
  framework:
    description: 'Framework to use'
    required: true
    default: 'nestjs'
  spec-file:
    description: 'Specification file path'
    required: true
  output-dir:
    description: 'Output directory'
    required: false
    default: 'generated'
outputs:
  api-path:
    description: 'Path to generated API'
    value: ${{ steps.generate.outputs.api-path }}
  success:
    description: 'Generation success status'
    value: ${{ steps.generate.outputs.success }}

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      shell: bash
      run: npm ci

    - name: Generate API
      id: generate
      shell: bash
      run: |
        echo "Generating ${{ inputs.type }} API with ${{ inputs.framework }}"
        
        output_dir="${{ inputs.output-dir }}/${{ inputs.type }}-${{ inputs.framework }}"
        mkdir -p "$output_dir"
        
        # Run API generation
        npm run generate-api \
          -- --type="${{ inputs.type }}" \
          --framework="${{ inputs.framework }}" \
          --spec="${{ inputs.spec-file }}" \
          --output="$output_dir"
        
        if [ $? -eq 0 ]; then
          echo "success=true" >> $GITHUB_OUTPUT
          echo "api-path=$output_dir" >> $GITHUB_OUTPUT
        else
          echo "success=false" >> $GITHUB_OUTPUT
          exit 1
        fi

    - name: Validate generated API
      shell: bash
      run: |
        if [ "${{ steps.generate.outputs.success }}" = "true" ]; then
          echo "Validating generated API at ${{ steps.generate.outputs.api-path }}"
          cd "${{ steps.generate.outputs.api-path }}"
          npm ci
          npm run build
          npm run test
        else
          echo "API generation failed, skipping validation"
          exit 1
        fi
```

### **Environment and Secret Management**
```yaml
# Environment-specific configurations
environments:
  staging:
    url: https://staging-api.example.com
    database_url: ${{ secrets.STAGING_DATABASE_URL }}
    redis_url: ${{ secrets.STAGING_REDIS_URL }}
    
  production:
    url: https://api.example.com
    database_url: ${{ secrets.PRODUCTION_DATABASE_URL }}
    redis_url: ${{ secrets.PRODUCTION_REDIS_URL }}

# Secret management in workflows
- name: Deploy with secrets
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.API_KEY }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
  run: |
    echo "Deploying with secure configuration"
    npm run deploy
```

## 💻 Code Examples

### **Multi-Environment Deployment**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Environments

on:
  push:
    branches: [main, develop, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref == 'refs/heads/main' && 'production' || github.ref == 'refs/heads/develop' && 'staging' || 'dev' }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup environment
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "ENVIRONMENT=production" >> $GITHUB_ENV
            echo "DOMAIN=api.example.com" >> $GITHUB_ENV
          elif [ "${{ github.ref }}" = "refs/heads/develop" ]; then
            echo "ENVIRONMENT=staging" >> $GITHUB_ENV
            echo "DOMAIN=staging-api.example.com" >> $GITHUB_ENV
          else
            echo "ENVIRONMENT=dev" >> $GITHUB_ENV
            echo "DOMAIN=dev-api.example.com" >> $GITHUB_ENV
          fi

      - name: Deploy to ${{ env.ENVIRONMENT }}
        run: |
          echo "Deploying to ${{ env.ENVIRONMENT }} (${{ env.DOMAIN }})"
          # Deployment commands
```

### **Testing and Quality Gates**
```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on:
  pull_request:
    branches: [main]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Check test coverage
        run: |
          coverage=$(npm run test:coverage:check)
          if [ $? -ne 0 ]; then
            echo "Test coverage below threshold"
            exit 1
          fi

      - name: Run security audit
        run: npm audit --audit-level moderate

      - name: Check bundle size
        run: |
          npm run build
          size=$(du -sh dist/ | cut -f1)
          echo "Bundle size: $size"
          # Add size checks here

      - name: Performance tests
        run: npm run test:performance

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

## 🔗 Integration with Our Stack

### **With Docker**
```yaml
# Docker integration
- name: Build Docker image
  run: |
    docker build -t my-api:${{ github.sha }} .
    docker tag my-api:${{ github.sha }} my-api:latest

- name: Push to registry
  run: |
    docker push my-api:${{ github.sha }}
    docker push my-api:latest
```

### **With Kubernetes**
```yaml
# Kubernetes deployment
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/api-api my-api=my-api:${{ github.sha }}
    kubectl rollout status deployment/api-api
```

### **With Terraform**
```yaml
# Terraform integration
- name: Apply Terraform
  run: |
    terraform init
    terraform plan -out=tfplan
    terraform apply -auto-approve tfplan
```

## 📚 Additional Resources

### **Official Documentation**
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Context and Expression Syntax](https://docs.github.com/en/actions/learn-github-actions/contexts)

### **Marketplace Actions**
- [GitHub Marketplace](https://github.com/marketplace?type=actions)
- [Awesome Actions](https://github.com/sdras/awesome-actions)
- [Action Toolkit](https://github.com/actions/toolkit)

### **Learning Resources**
- [GitHub Actions Learning Lab](https://lab.github.com/githubtraining/github-actions)
- [GitHub Actions Tutorial](https://docs.github.com/en/actions/guides)
- [Best Practices](https://docs.github.com/en/actions/guides)

---

**🎯 GitHub Actions provides powerful automation capabilities that perfectly complement our API generation platform, enabling automated testing, deployment, and quality assurance with minimal configuration.**