/**
 * Stripe Service Definition
 * Phase 21: Service Integration Framework
 */

import { ServiceDefinition, ServiceCategory } from '../types.js';

export const stripeService: ServiceDefinition = {
    id: 'stripe',
    name: 'Stripe',
    category: ServiceCategory.PAYMENT,
    description: 'Payment processing platform for internet businesses',
    documentation: 'https://stripe.com/docs',
    website: 'https://stripe.com',
    logo: 'stripe',
    hasFreeTier: false,
    pricingUrl: 'https://stripe.com/pricing',

    credentials: [
        {
            key: 'secretKey',
            label: 'Secret Key',
            type: 'api_key',
            required: true,
            sensitive: true,
            placeholder: 'sk_test_xxx or sk_live_xxx',
            description: 'Found in Stripe Dashboard → Developers → API keys'
        },
        {
            key: 'publishableKey',
            label: 'Publishable Key',
            type: 'api_key',
            required: false,
            sensitive: false,
            placeholder: 'pk_test_xxx or pk_live_xxx',
            description: 'For client-side usage'
        },
        {
            key: 'webhookSecret',
            label: 'Webhook Secret',
            type: 'api_key',
            required: false,
            sensitive: true,
            placeholder: 'whsec_xxx',
            description: 'For webhook signature verification'
        }
    ],

    capabilities: ['Payments', 'Subscriptions', 'Invoicing', 'Webhooks', 'Checkout'],
    tags: ['payment', 'billing', 'subscriptions', 'checkout'],

    agentInstructions: `
When using Stripe:
1. Import: \`import Stripe from 'stripe';\`
2. Initialize: \`const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);\`
3. Always use test keys (sk_test_) during development
4. Verify webhooks using stripe.webhooks.constructEvent()
5. Handle errors with try/catch block
  `.trim(),

    codeTemplates: {
        'create-checkout': {
            name: 'Create Checkout Session',
            description: 'Create a Stripe Checkout session',
            language: 'typescript',
            requiredPackages: ['stripe'],
            envVars: ['STRIPE_SECRET_KEY'],
            code: `import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: { name: 'Product Name' },
      unit_amount: 1000 // $10.00
    },
    quantity: 1
  }],
  success_url: 'https://yoursite.com/success',
  cancel_url: 'https://yoursite.com/cancel'
});

return { url: session.url };`
        }
    }
};
