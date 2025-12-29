/**
 * Setup Guide Generator
 * Phase 21: Service Integration Framework
 * 
 * Generates step-by-step setup instructions for selected services.
 */

import { getServiceRegistry } from '../services/service-registry/index.js';
import { SetupGuide, SetupStep, ServiceDefinition } from '../services/service-registry/types.js';

// Service-specific setup guides
const SERVICE_SETUP_GUIDES: Record<string, Omit<SetupStep, 'service' | 'requiredCredentials'>> = {
    supabase: {
        title: 'Create Supabase Project',
        instructions: [
            '1. Go to https://supabase.com',
            '2. Click "Start your project" and sign up/login',
            '3. Click "New Project"',
            '4. Choose a name, password, and region',
            '5. Wait for project to be created (~2 minutes)',
            '6. Go to Settings → API',
            '7. Copy "Project URL" and "anon/public key"'
        ],
        connectUrl: '/dashboard/connections?add=supabase',
        videoTutorial: 'https://www.youtube.com/watch?v=dU7GwCOgvNY',
        estimatedTime: '3 minutes'
    },

    sentry: {
        title: 'Create Sentry Project',
        instructions: [
            '1. Go to https://sentry.io',
            '2. Sign up or login',
            '3. Click "Create Project"',
            '4. Select "Node.js" as platform',
            '5. Choose a project name',
            '6. Copy the DSN from the setup page'
        ],
        connectUrl: '/dashboard/connections?add=sentry',
        estimatedTime: '2 minutes'
    },

    'github-actions': {
        title: 'Create GitHub Personal Access Token',
        instructions: [
            '1. Go to GitHub → Settings → Developer settings',
            '2. Click "Personal access tokens" → "Tokens (classic)"',
            '3. Click "Generate new token (classic)"',
            '4. Select scopes: repo, workflow',
            '5. Click "Generate token"',
            '6. Copy the token immediately (shown only once!)'
        ],
        connectUrl: '/dashboard/connections?add=github-actions',
        estimatedTime: '2 minutes'
    },

    resend: {
        title: 'Create Resend Account',
        instructions: [
            '1. Go to https://resend.com',
            '2. Sign up with GitHub or email',
            '3. Go to API Keys page',
            '4. Click "Create API Key"',
            '5. Copy the API key'
        ],
        connectUrl: '/dashboard/connections?add=resend',
        estimatedTime: '2 minutes'
    },

    stripe: {
        title: 'Get Stripe API Keys',
        instructions: [
            '1. Go to https://stripe.com',
            '2. Sign up or login to Dashboard',
            '3. Go to Developers → API Keys',
            '4. Copy "Publishable key" and "Secret key"',
            '5. For testing, use keys starting with pk_test_ and sk_test_'
        ],
        connectUrl: '/dashboard/connections?add=stripe',
        estimatedTime: '2 minutes'
    },

    auth0: {
        title: 'Create Auth0 Application',
        instructions: [
            '1. Go to https://auth0.com',
            '2. Sign up and create a tenant',
            '3. Go to Applications → Create Application',
            '4. Choose "Regular Web Application"',
            '5. Copy Domain and Client ID from Settings'
        ],
        connectUrl: '/dashboard/connections?add=auth0',
        estimatedTime: '3 minutes'
    },

    clerk: {
        title: 'Create Clerk Application',
        instructions: [
            '1. Go to https://clerk.com',
            '2. Sign up and create an application',
            '3. Go to API Keys',
            '4. Copy "Publishable key" and "Secret key"'
        ],
        connectUrl: '/dashboard/connections?add=clerk',
        estimatedTime: '2 minutes'
    }
};

export class SetupGuideGenerator {
    private registry = getServiceRegistry();

    /**
     * Generate complete setup guide for selected services
     */
    generate(serviceIds: string[]): SetupGuide {
        const steps: SetupStep[] = [];
        const envVars: Array<{ key: string; source: string }> = [];

        for (let i = 0; i < serviceIds.length; i++) {
            const serviceId = serviceIds[i];
            const service = this.registry.getService(serviceId);

            if (!service) continue;

            // Generate setup step
            const step = this.generateServiceStep(service, i + 1);
            steps.push(step);

            // Collect environment variables
            for (const cred of service.credentials) {
                if (cred.required) {
                    const envKey = this.getEnvVarName(serviceId, cred.key);
                    envVars.push({
                        key: envKey,
                        source: cred.description || `From ${service.name} dashboard`
                    });
                }
            }
        }

        const totalMinutes = steps.reduce((sum, step) => {
            const mins = parseInt(step.estimatedTime) || 2;
            return sum + mins;
        }, 0);

        return {
            title: `Connect Your Services (${totalMinutes} minutes)`,
            estimatedTime: `${totalMinutes} minutes`,
            steps,
            envVarsNeeded: {
                message: 'Add these to your .env file after setup:',
                variables: envVars
            },
            nextSteps: [
                {
                    action: 'Configure Services Now',
                    url: '/dashboard/connections',
                    primary: true
                },
                {
                    action: 'Download Code',
                    url: '/download/project',
                    primary: false
                }
            ]
        };
    }

    /**
     * Generate setup step for a single service
     */
    private generateServiceStep(service: ServiceDefinition, stepNumber: number): SetupStep {
        const guide = SERVICE_SETUP_GUIDES[service.id];

        if (guide) {
            return {
                service: service.id,
                title: `Step ${stepNumber}: ${guide.title}`,
                instructions: guide.instructions,
                connectUrl: guide.connectUrl,
                requiredCredentials: service.credentials
                    .filter(c => c.required)
                    .map(c => c.label),
                videoTutorial: guide.videoTutorial,
                estimatedTime: guide.estimatedTime
            };
        }

        // Fallback for services without specific guides
        return {
            service: service.id,
            title: `Step ${stepNumber}: Setup ${service.name}`,
            instructions: [
                `1. Visit ${service.website || service.documentation}`,
                '2. Create an account if needed',
                '3. Navigate to API Keys or Settings',
                '4. Copy the required credentials',
                '5. Return here to connect'
            ],
            connectUrl: `/dashboard/connections?add=${service.id}`,
            requiredCredentials: service.credentials
                .filter(c => c.required)
                .map(c => c.label),
            estimatedTime: '5 minutes'
        };
    }

    /**
     * Generate environment variable name from service ID and credential key
     */
    private getEnvVarName(serviceId: string, credKey: string): string {
        const prefix = serviceId.toUpperCase().replace(/-/g, '_');
        const suffix = credKey.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2');
        return `${prefix}_${suffix}`;
    }
}

// Singleton instance
let generatorInstance: SetupGuideGenerator | null = null;

export function getSetupGuideGenerator(): SetupGuideGenerator {
    if (!generatorInstance) {
        generatorInstance = new SetupGuideGenerator();
    }
    return generatorInstance;
}

export { SetupGuideGenerator as default };
