/**
 * Interactive Service Selector
 * Phase 21: Service Integration Framework
 * 
 * Handles the interactive questioning flow for users without configured services.
 * Recommends optimal services based on task requirements.
 */

import { getServiceRegistry } from '../infrastructure/api/service-registry/index.js';
import { getConnectionManager } from '../infrastructure/api/connection-manager/index.js';
import {
    ServiceCategory,
    ServiceQuestion,
    ServiceSelection,
    UserConnection
} from '../infrastructure/api/service-registry/types.js';

export class InteractiveServiceSelector {
    private registry = getServiceRegistry();
    private connectionManager = getConnectionManager();

    /**
     * Generate questions based on task requirements
     */
    async generateQuestions(task: string, userId: string): Promise<ServiceQuestion[]> {
        // Get user's existing connections
        const existingConnections = await this.connectionManager.getUserConnections(userId);

        const questions: ServiceQuestion[] = [];
        const taskLower = task.toLowerCase();

        // Question 1: Database (if task needs storage)
        if (this.needsDatabase(taskLower) && !this.hasCategory(existingConnections, ServiceCategory.DATABASE)) {
            questions.push({
                id: 'database',
                question: 'Do you have a preferred database?',
                category: ServiceCategory.DATABASE,
                required: true,
                options: [
                    { value: 'supabase', label: 'I have Supabase', isRecommend: false },
                    { value: 'mongodb', label: 'I have MongoDB', isRecommend: false },
                    { value: 'postgresql', label: 'I have PostgreSQL', isRecommend: false },
                    { value: 'recommend', label: "I don't know (recommend one)", isRecommend: true }
                ]
            });
        }

        // Question 2: Authentication (if task needs users)
        if (this.needsAuth(taskLower) && !this.hasCategory(existingConnections, ServiceCategory.AUTHENTICATION)) {
            questions.push({
                id: 'auth',
                question: 'Do you need user authentication?',
                category: ServiceCategory.AUTHENTICATION,
                required: false,
                options: [
                    { value: 'auth0', label: 'I have Auth0', isRecommend: false },
                    { value: 'clerk', label: 'I have Clerk', isRecommend: false },
                    { value: 'supabase-auth', label: 'Use Supabase Auth (built-in)', isRecommend: false },
                    { value: 'recommend', label: 'Yes, recommend a service', isRecommend: true },
                    { value: 'none', label: 'No authentication needed', isRecommend: false }
                ]
            });
        }

        // Question 3: Monitoring (always ask if not configured)
        if (!this.hasCategory(existingConnections, ServiceCategory.MONITORING)) {
            questions.push({
                id: 'monitoring',
                question: 'Want error monitoring in production?',
                category: ServiceCategory.MONITORING,
                required: false,
                options: [
                    { value: 'sentry', label: 'I have Sentry', isRecommend: false },
                    { value: 'datadog', label: 'I have Datadog', isRecommend: false },
                    { value: 'recommend', label: 'Yes, recommend a service', isRecommend: true },
                    { value: 'none', label: 'Not right now', isRecommend: false }
                ]
            });
        }

        // Question 4: Email (if task mentions notifications)
        if (this.needsEmail(taskLower) && !this.hasCategory(existingConnections, ServiceCategory.EMAIL)) {
            questions.push({
                id: 'email',
                question: 'Need to send emails (notifications, confirmations)?',
                category: ServiceCategory.EMAIL,
                required: false,
                options: [
                    { value: 'resend', label: 'I have Resend', isRecommend: false },
                    { value: 'sendgrid', label: 'I have SendGrid', isRecommend: false },
                    { value: 'recommend', label: 'Yes, recommend a service', isRecommend: true },
                    { value: 'none', label: 'No email needed', isRecommend: false }
                ]
            });
        }

        // Question 5: Payments (if task mentions commerce)
        if (this.needsPayments(taskLower) && !this.hasCategory(existingConnections, ServiceCategory.PAYMENT)) {
            questions.push({
                id: 'payment',
                question: 'Need payment processing?',
                category: ServiceCategory.PAYMENT,
                required: false,
                options: [
                    { value: 'stripe', label: 'I have Stripe', isRecommend: false },
                    { value: 'paypal', label: 'I have PayPal', isRecommend: false },
                    { value: 'recommend', label: 'Yes, recommend a service', isRecommend: true },
                    { value: 'none', label: 'No payments needed', isRecommend: false }
                ]
            });
        }

        return questions;
    }

    /**
     * Process user answers and select optimal services
     */
    async selectServices(
        task: string,
        answers: Record<string, string>
    ): Promise<ServiceSelection[]> {
        const selections: ServiceSelection[] = [];

        for (const [questionId, answer] of Object.entries(answers)) {
            if (answer === 'recommend') {
                // AI chooses best service
                const recommended = this.recommendService(questionId, task);
                selections.push({
                    serviceId: recommended.id,
                    reason: recommended.reason,
                    autoSelected: true
                });
            } else if (answer !== 'none' && answer !== '') {
                // User specified a service
                selections.push({
                    serviceId: answer,
                    reason: 'User-specified preference',
                    autoSelected: false
                });
            }
        }

        return selections;
    }

    /**
     * AI recommends best service for category
     */
    private recommendService(category: string, _task: string): { id: string; reason: string } {
        // Task parameter reserved for future AI-based recommendations

        switch (category) {
            case 'database':
                // Supabase is recommended for most cases
                return {
                    id: 'supabase',
                    reason: 'Supabase is easiest to set up, has built-in auth, and works great for most applications'
                };

            case 'auth':
                // If they chose Supabase for DB, recommend Supabase Auth
                return {
                    id: 'supabase-auth',
                    reason: 'Supabase Auth integrates seamlessly with your database and is free to start'
                };

            case 'monitoring':
                return {
                    id: 'sentry',
                    reason: 'Sentry is the industry standard for error tracking with an excellent free tier'
                };

            case 'email':
                return {
                    id: 'resend',
                    reason: 'Resend offers a developer-friendly API with React Email support and a generous free tier'
                };

            case 'payment':
                return {
                    id: 'stripe',
                    reason: 'Stripe is the most developer-friendly payment platform with excellent documentation'
                };

            default:
                return {
                    id: 'supabase',
                    reason: 'Recommended starter service for most use cases'
                };
        }
    }

    /**
     * Get the services the user already has configured
     */
    async getExistingServices(userId: string): Promise<{ serviceId: string; category: ServiceCategory }[]> {
        const connections = await this.connectionManager.getUserConnections(userId);

        return connections.map(conn => {
            const service = this.registry.getService(conn.serviceId);
            return {
                serviceId: conn.serviceId,
                category: service?.category || ServiceCategory.DATABASE
            };
        });
    }

    // ============================================================
    // TASK ANALYSIS HELPERS
    // ============================================================

    private needsDatabase(task: string): boolean {
        const keywords = [
            'store', 'save', 'database', 'crud', 'data', 'api',
            'users', 'products', 'posts', 'items', 'records',
            'list', 'fetch', 'query', 'table', 'persist'
        ];
        return keywords.some(kw => task.includes(kw));
    }

    private needsAuth(task: string): boolean {
        const keywords = [
            'auth', 'login', 'user', 'signup', 'account',
            'password', 'session', 'token', 'permission', 'role',
            'register', 'signin', 'logout'
        ];
        return keywords.some(kw => task.includes(kw));
    }

    private needsEmail(task: string): boolean {
        const keywords = [
            'email', 'notification', 'notify', 'send', 'welcome',
            'confirmation', 'invite', 'newsletter'
        ];
        return keywords.some(kw => task.includes(kw));
    }

    private needsPayments(task: string): boolean {
        const keywords = [
            'payment', 'pay', 'checkout', 'subscribe', 'subscription',
            'billing', 'invoice', 'purchase', 'buy', 'sell',
            'e-commerce', 'ecommerce', 'shop', 'cart'
        ];
        return keywords.some(kw => task.includes(kw));
    }

    private hasCategory(connections: UserConnection[], category: ServiceCategory): boolean {
        return connections.some(conn => {
            const service = this.registry.getService(conn.serviceId);
            return service?.category === category;
        });
    }
}

// Singleton instance
let selectorInstance: InteractiveServiceSelector | null = null;

export function getInteractiveServiceSelector(): InteractiveServiceSelector {
    if (!selectorInstance) {
        selectorInstance = new InteractiveServiceSelector();
    }
    return selectorInstance;
}

export { InteractiveServiceSelector as default };
