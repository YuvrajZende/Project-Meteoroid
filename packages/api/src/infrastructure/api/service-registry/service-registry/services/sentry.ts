/**
 * Sentry Service Definition
 * Phase 21: Service Integration Framework
 * 
 * Sentry provides:
 * - Error tracking
 * - Performance monitoring
 * - Session replay
 * - Release tracking
 */

import { ServiceDefinition, ServiceCategory } from '../types.js';

export const sentryService: ServiceDefinition = {
    id: 'sentry',
    name: 'Sentry',
    category: ServiceCategory.MONITORING,
    description: 'Application monitoring platform for error tracking and performance',
    documentation: 'https://docs.sentry.io',
    website: 'https://sentry.io',
    logo: 'sentry',
    hasFreeTier: true,
    pricingUrl: 'https://sentry.io/pricing',

    credentials: [
        {
            key: 'dsn',
            label: 'DSN (Data Source Name)',
            type: 'connection_string',
            required: true,
            sensitive: true,
            placeholder: 'https://xxx@xxx.ingest.sentry.io/xxx',
            description: 'Found in Project Settings → Client Keys (DSN)',
            validation: '^https:\\/\\/[a-f0-9]+@[a-z0-9]+\\.ingest\\.sentry\\.io\\/[0-9]+$'
        },
        {
            key: 'authToken',
            label: 'Auth Token (Optional)',
            type: 'api_key',
            required: false,
            sensitive: true,
            placeholder: 'sntrys_xxx...',
            description: 'For release management and source maps. Found in User Settings → Auth Tokens'
        },
        {
            key: 'org',
            label: 'Organization Slug',
            type: 'api_key',
            required: false,
            sensitive: false,
            placeholder: 'my-org',
            description: 'Your Sentry organization slug (found in URL)'
        },
        {
            key: 'project',
            label: 'Project Slug',
            type: 'api_key',
            required: false,
            sensitive: false,
            placeholder: 'my-project',
            description: 'Your Sentry project slug'
        }
    ],

    capabilities: [
        'Error tracking',
        'Exception grouping',
        'Stack trace analysis',
        'Performance monitoring',
        'Transaction tracing',
        'Session replay',
        'Release tracking',
        'Source map support',
        'Alerting and notifications',
        'Issue assignment'
    ],

    tags: ['monitoring', 'errors', 'performance', 'apm', 'debugging', 'observability'],

    agentInstructions: `
When using Sentry:

1. **Initialization** (do this once at app startup):
   \`\`\`typescript
   import * as Sentry from '@sentry/node';
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV || 'development',
     tracesSampleRate: 1.0, // Adjust in production (0.1 = 10%)
   });
   \`\`\`

2. **Error Capturing**:
   - \`Sentry.captureException(error)\` for caught exceptions
   - \`Sentry.captureMessage('message')\` for custom messages
   - Errors are automatically captured for uncaught exceptions

3. **Context and Tags**:
   - Use \`Sentry.setUser({ id, email })\` to associate errors with users
   - Use \`Sentry.setTag('key', 'value')\` for filtering
   - Use \`Sentry.setContext('name', { data })\` for additional context

4. **Performance Monitoring**:
   - Wrap async operations with \`Sentry.startSpan()\`
   - Use \`tracesSampleRate\` to control sampling

5. **Best Practices**:
   - Don't log sensitive data (passwords, tokens)
   - Use breadcrumbs to track user actions
   - Set meaningful error levels (error, warning, info)
   - Filter out non-actionable errors in Sentry dashboard
  `.trim(),

    codeTemplates: {
        'initialization': {
            name: 'Initialize Sentry',
            description: 'Set up Sentry at application startup',
            language: 'typescript',
            requiredPackages: ['@sentry/node'],
            envVars: ['SENTRY_DSN', 'NODE_ENV'],
            code: `import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Release tracking (optional)
  release: process.env.npm_package_version,
  
  // Filter out non-errors
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  }
});

console.log('[Sentry] Initialized for', process.env.NODE_ENV);`
        },

        'error-capture': {
            name: 'Capture Exception',
            description: 'Capture and report an error to Sentry',
            language: 'typescript',
            requiredPackages: ['@sentry/node'],
            code: `try {
  // Your code that might throw
  {{code}}
} catch (error) {
  // Capture the exception with context
  Sentry.captureException(error, {
    tags: {
      {{#if tag}}{{tag.key}}: '{{tag.value}}',{{/if}}
      component: '{{component}}'
    },
    extra: {
      // Additional debugging info
      {{#if extra}}{{extra}}{{/if}}
    }
  });
  
  // Re-throw or handle as needed
  throw error;
}`
        },

        'user-context': {
            name: 'Set User Context',
            description: 'Associate errors with a user',
            language: 'typescript',
            requiredPackages: ['@sentry/node'],
            code: `// Set user context (call after user authenticates)
Sentry.setUser({
  id: '{{userId}}',
  email: '{{email}}',
  username: '{{username}}'
});

// Clear user context (call on logout)
// Sentry.setUser(null);`
        },

        'performance-span': {
            name: 'Performance Span',
            description: 'Track performance of an operation',
            language: 'typescript',
            requiredPackages: ['@sentry/node'],
            code: `const result = await Sentry.startSpan(
  {
    name: '{{operationName}}',
    op: '{{operationType}}' // e.g., 'db.query', 'http.request'
  },
  async (span) => {
    // Your operation here
    const data = await {{operation}};
    
    // Optionally set span data
    span.setAttribute('result.count', data.length);
    
    return data;
  }
);`
        },

        'breadcrumb': {
            name: 'Add Breadcrumb',
            description: 'Add a breadcrumb for debugging',
            language: 'typescript',
            requiredPackages: ['@sentry/node'],
            code: `Sentry.addBreadcrumb({
  category: '{{category}}', // e.g., 'auth', 'navigation', 'ui'
  message: '{{message}}',
  level: '{{level}}', // 'debug', 'info', 'warning', 'error'
  data: {
    {{#if data}}{{data}}{{/if}}
  }
});`
        },

        'express-middleware': {
            name: 'Express Error Handler',
            description: 'Sentry error handler for Express/Fastify',
            language: 'typescript',
            requiredPackages: ['@sentry/node'],
            code: `// Add this BEFORE your routes
app.use(Sentry.Handlers.requestHandler());

// Add this BEFORE your error handlers
app.use(Sentry.Handlers.errorHandler());

// Your custom error handler (after Sentry)
app.use((err, req, res, next) => {
  // Sentry has already captured the error
  res.status(500).json({
    error: 'Internal server error',
    eventId: res.sentry // Sentry event ID for support
  });
});`
        }
    }
};
