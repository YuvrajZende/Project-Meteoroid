import type { FrontendAnalysisResult } from '@loveable/agents/core/analysis/types';

const fields = (defs: Array<[string, string, boolean?]>) =>
    defs.map(([name, type, optional]) => ({
        name,
        type: type as never,
        optional: optional ?? false,
    }));

/** Built-in sample so `npm run agents -- --demo` runs with zero prerequisites. */
export function makeDemoAnalysis(): FrontendAnalysisResult {
    return {
        analyzedAt: new Date(),
        repositoryPath: 'demo://mini-commerce',
        framework: {
            type: 'react-vite', version: '5.4.0', isMetaFramework: false,
            usesTypeScript: true, buildTool: 'vite', uiLibrary: 'tailwind',
            stateManagement: null, confidence: 0.95,
        },
        apiCalls: [
            { endpoint: '/api/products', method: 'GET', library: 'axios', sourceFile: 'demo', lineNumber: 1, requiresAuth: false },
            { endpoint: '/api/orders', method: 'POST', library: 'fetch', sourceFile: 'demo', lineNumber: 2, requiresAuth: true },
        ],
        dataModels: [
            {
                name: 'Product',
                confidence: 0.9,
                primaryKey: 'id',
                sources: [{ file: 'demo/types.ts', type: 'interface' }],
                relationships: [
                    { targetModel: 'Order', type: 'one-to-many', fieldName: 'orders' },
                ],
                fields: fields([
                    ['id', 'uuid'], ['name', 'string'], ['description', 'string'],
                    ['priceCents', 'number'], ['inStock', 'boolean'], ['createdAt', 'date'],
                ]),
            },
            {
                name: 'Order',
                confidence: 0.85,
                primaryKey: 'id',
                sources: [{ file: 'demo/types.ts', type: 'interface' }],
                relationships: [],
                fields: fields([
                    ['id', 'uuid'], ['userId', 'uuid'], ['productId', 'uuid'],
                    ['quantity', 'number'], ['totalCents', 'number'], ['status', 'string'],
                ]),
            },
        ],
        authStrategy: {
            provider: 'clerk',
            features: { socialLogin: true, emailPassword: true, magicLink: false, phoneAuth: false, mfa: false, sso: false },
            protectedRoutes: ['/account'],
            authFiles: [], authHooks: [], tokenStorage: 'cookie', confidence: 0.9,
        },
        routes: [],
        dependencies: [],
        filesAnalyzed: 2,
        stats: { totalFiles: 2, jsxFiles: 1, tsFiles: 1, apiCallsFound: 2, modelsInferred: 2, routesDetected: 0 },
        warnings: [],
        suggestions: { recommendedDatabase: 'postgresql', recommendedOrm: 'prisma', recommendedAuth: 'clerk', apiStyle: 'rest' },
    };
}

/** Frozen sample instance consumed by pipeline tests and the `--demo` CLI flag. */
export const DEMO_ANALYSIS: FrontendAnalysisResult = makeDemoAnalysis();
