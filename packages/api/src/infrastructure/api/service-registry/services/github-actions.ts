/**
 * GitHub Actions Service Definition
 * Phase 21: Service Integration Framework
 */

import { ServiceDefinition, ServiceCategory } from '../types.js';

export const githubActionsService: ServiceDefinition = {
    id: 'github-actions',
    name: 'GitHub Actions',
    category: ServiceCategory.CICD,
    description: 'Automate workflows in your repository',
    documentation: 'https://docs.github.com/en/actions',
    website: 'https://github.com/features/actions',
    logo: 'github',
    hasFreeTier: true,
    pricingUrl: 'https://github.com/pricing',

    credentials: [
        {
            key: 'token',
            label: 'Personal Access Token',
            type: 'api_key',
            required: true,
            sensitive: true,
            placeholder: 'ghp_xxx...',
            description: 'Create at GitHub → Settings → Developer settings → Personal access tokens'
        }
    ],

    capabilities: ['CI/CD', 'Testing', 'Deployment', 'Docker builds', 'Cron jobs'],
    tags: ['ci', 'cd', 'automation', 'github'],

    agentInstructions: `
When generating GitHub Actions workflows:
1. Place workflows in \`.github/workflows/\` directory
2. Use \`actions/checkout@v4\` to clone the repo
3. Use \`actions/setup-node@v4\` for Node.js
4. Pin action versions (use @v4, not @main)
5. Use \`\${{ secrets.NAME }}\` for secrets
  `.trim(),

    codeTemplates: {
        'basic-ci': {
            name: 'Basic CI',
            description: 'Simple CI workflow',
            language: 'typescript',
            code: `name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test`
        }
    }
};
