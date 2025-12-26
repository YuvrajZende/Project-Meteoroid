/**
 * Resend Service Definition
 * Phase 21: Service Integration Framework
 */

import { ServiceDefinition, ServiceCategory } from '../types.js';

export const resendService: ServiceDefinition = {
    id: 'resend',
    name: 'Resend',
    category: ServiceCategory.EMAIL,
    description: 'Developer-first email API for transactional emails',
    documentation: 'https://resend.com/docs',
    website: 'https://resend.com',
    logo: 'resend',
    hasFreeTier: true,
    pricingUrl: 'https://resend.com/pricing',

    credentials: [
        {
            key: 'apiKey',
            label: 'API Key',
            type: 'api_key',
            required: true,
            sensitive: true,
            placeholder: 're_xxx...',
            description: 'Found in Resend dashboard → API Keys'
        }
    ],

    capabilities: ['Transactional email', 'Email templates', 'React Email support'],
    tags: ['email', 'transactional', 'notifications'],

    agentInstructions: `
When using Resend:
1. Import: \`import { Resend } from 'resend';\`
2. Initialize: \`const resend = new Resend(process.env.RESEND_API_KEY);\`
3. Send email: \`await resend.emails.send({ from, to, subject, html });\`
4. Use verified domain for 'from' address
  `.trim(),

    codeTemplates: {
        'send-email': {
            name: 'Send Email',
            description: 'Send a simple email',
            language: 'typescript',
            requiredPackages: ['resend'],
            envVars: ['RESEND_API_KEY'],
            code: `import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: 'noreply@yourdomain.com',
  to: ['user@example.com'],
  subject: 'Hello!',
  html: '<p>Welcome to our app!</p>'
});

if (error) throw error;
return data;`
        }
    }
};
