/**
 * DI Middleware for Fastify
 * Phase 1: Dependency Injection - Step 1.4
 *
 * This middleware integrates the DI container with Fastify's request lifecycle:
 * - Creates a request-scoped child container for each HTTP request
 * - Makes services available via request.di
 * - Ensures proper cleanup after request completion
 *
 * Benefits:
 * - Prevents memory leaks from singleton services
 * - Enables request-scoped services (ContextManager, LearningService, etc.)
 * - Automatic cleanup of transient services after each request
 * - Better testability with mock injection
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getDIContainer, type DIContainer } from '../di/types.js';
import { TYPES } from '../di/types.js';

// ============================================
// TYPES
// ============================================

/**
 * Request-scoped DI container interface
 * Extends Fastify request with DI capabilities
 */
export interface RequestWithDI extends Omit<FastifyRequest, 'di'> {
    di: {
        get: <T>(serviceIdentifier: symbol | string) => T;
        cleanup: () => void;
    };
    /**
     * Get a service from the request-scoped DI container
     */
    getService: <T>(serviceIdentifier: symbol) => T;
}

/**
 * DI Middleware options
 */
export interface DIMiddlewareOptions {
    /**
     * Enable request-scoped containers
     * When true, each request gets its own child container
     * When false, all requests share the global container
     */
    requestScoped?: boolean;

    /**
     * Log DI operations for debugging
     */
    debug?: boolean;
}

// ============================================
// MIDDLEWARE
// ============================================

const DEFAULT_OPTIONS: DIMiddlewareOptions = {
    requestScoped: true,
    debug: false,
};

/**
 * Register DI middleware with Fastify
 *
 * This function:
 * 1. Initializes the global DI container (if not already initialized)
 * 2. Adds request-scoped container to each request
 * 3. Decorates Fastify app with DI methods
 *
 * @param app - Fastify instance
 * @param options - Middleware options
 */
export async function registerDIMiddleware(
    app: FastifyInstance,
    options: DIMiddlewareOptions = {}
): Promise<void> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Initialize the global DI container if not already initialized
    const globalContainer = getDIContainer();

    if (opts.debug) {
        app.log.info('[DI Middleware] Registered with Fastify');
    }

    // Decorate the app with the global DI container
    app.decorate('diContainer', globalContainer);

    // Decorate the app with a helper method to get services
    app.decorate('getService', <T>(serviceIdentifier: symbol): T => {
        return globalContainer.get<T>(serviceIdentifier);
    });

    // Add onRequest hook to create request-scoped container
    if (opts.requestScoped) {
        app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
            const requestWithDI = request as RequestWithDI;

            // Create a request-scoped container wrapper
            const requestScopedContainer = globalContainer.createRequestScope();

            // Attach to request
            requestWithDI.di = requestScopedContainer;
            requestWithDI.getService = <T>(serviceIdentifier: symbol): T => {
                return requestScopedContainer.get<T>(serviceIdentifier);
            };

            if (opts.debug) {
                request.log.debug('[DI Middleware] Created request-scoped container');
            }
        });

        // Add onResponse hook to clean up request-scoped container
        app.addHook('onResponse', async (request: FastifyRequest, _reply: FastifyReply) => {
            const requestWithDI = request as RequestWithDI;

            // Clean up request-scoped container
            if (requestWithDI.di) {
                requestWithDI.di.cleanup();

                if (opts.debug) {
                    request.log.debug('[DI Middleware] Cleaned up request-scoped container');
                }
            }
        });

        // Also clean up on error
        app.addHook('onError', async (request: FastifyRequest) => {
            const requestWithDI = request as RequestWithDI;

            // Ensure cleanup happens even on error
            if (requestWithDI.di) {
                requestWithDI.di.cleanup();

                if (opts.debug) {
                    request.log.debug('[DI Middleware] Cleaned up request-scoped container after error');
                }
            }
        });
    } else {
        // If not request-scoped, wrap the global container with a no-op cleanup
        app.addHook('onRequest', async (request: FastifyRequest) => {
            const requestWithDI = request as RequestWithDI;
            // Wrap global container to match expected interface
            requestWithDI.di = {
                get: <T>(serviceIdentifier: symbol | string): T => {
                    return globalContainer.get<T>(serviceIdentifier);
                },
                cleanup: () => {
                    // No-op for global container
                },
            };
            requestWithDI.getService = <T>(serviceIdentifier: symbol): T => {
                return globalContainer.get<T>(serviceIdentifier);
            };
        });
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Get a service from the request-scoped DI container
 *
 * Usage in routes:
 * ```ts
 * const contextManager = getServiceFromRequest<IContextManager>(request, TYPES.ContextManager);
 * ```
 *
 * @param request - Fastify request
 * @param serviceIdentifier - Service identifier symbol
 * @returns Service instance
 */
export function getServiceFromRequest<T>(
    request: FastifyRequest,
    serviceIdentifier: symbol
): T {
    const requestWithDI = request as RequestWithDI;

    if (!requestWithDI.di) {
        throw new Error('DI container not available on request. Did you register DIMiddleware?');
    }

    return requestWithDI.di.get<T>(serviceIdentifier);
}

/**
 * Helper to get commonly used services from request
 *
 * Usage:
 * ```ts
 * const services = getRequestServices(request);
 * await services.contextManager.addMessage(...);
 * ```
 */
export function getRequestServices(request: FastifyRequest) {
    const requestWithDI = request as RequestWithDI;

    if (!requestWithDI.di) {
        throw new Error('DI container not available on request. Did you register DIMiddleware?');
    }

    return {
        contextManager: requestWithDI.di.get(TYPES.ContextManager),
        learningService: requestWithDI.di.get(TYPES.LearningService),
        vectorStore: requestWithDI.di.get(TYPES.VectorStore),
        database: requestWithDI.di.get(TYPES.Database),
        // Add more commonly used services as needed
    };
}

// ============================================
// FASTIFY DECORATOR TYPE DEFINITIONS
// ============================================

declare module 'fastify' {
    interface FastifyInstance {
        /**
         * Global DI container (singleton)
         */
        diContainer: DIContainer;

        /**
         * Get a service from the global DI container
         */
        getService: <T>(serviceIdentifier: symbol) => T;
    }

    interface FastifyRequest {
        /**
         * Request-scoped DI container (if requestScoped is enabled)
         */
        di?: {
            get: <T>(serviceIdentifier: symbol | string) => T;
            cleanup: () => void;
        };

        /**
         * Get a service from the request-scoped DI container
         */
        getService?: <T>(serviceIdentifier: symbol) => T;
    }
}
