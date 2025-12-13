/**
 * Sentry Error Tracking
 * Integration for capturing and reporting errors
 */

// Note: Sentry SDK would be imported here
// import * as Sentry from '@sentry/node';

/**
 * Sentry configuration
 */
export interface SentryConfig {
    dsn?: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
    profilesSampleRate?: number;
    enabled?: boolean;
}

/**
 * User context for Sentry
 */
export interface SentryUserContext {
    id: string;
    email?: string;
    tier?: string;
}

/**
 * Initialize Sentry
 */
export function initSentry(config: SentryConfig = {}): void {
    const dsn = config.dsn || process.env.SENTRY_DSN;

    if (!dsn) {
        return;
    }

    const environment = config.environment || process.env.NODE_ENV || 'development';
    const release = config.release || `loveable-api@${process.env.npm_package_version || '1.0.0'}`;

    // Placeholder for Sentry initialization
    // Sentry.init({
    //   dsn,
    //   environment,
    //   release,
    //   tracesSampleRate: config.tracesSampleRate ?? 0.1,
    //   profilesSampleRate: config.profilesSampleRate ?? 0.1,
    //   integrations: [
    //     new Sentry.Integrations.Http({ tracing: true }),
    //   ],
    // });
}

/**
 * Capture an exception
 */
export function captureException(
    error: Error,
    context?: {
        user?: SentryUserContext;
        tags?: Record<string, string>;
        extra?: Record<string, unknown>;
    }
): string {
    // Set user context if provided
    if (context?.user) {
        // Sentry.setUser({
        //   id: context.user.id,
        //   email: context.user.email,
        //   tier: context.user.tier,
        // });
    }

    // Set tags if provided
    if (context?.tags) {
        // Sentry.setTags(context.tags);
    }

    // Capture with extra context
    // const eventId = Sentry.captureException(error, {
    //   extra: context?.extra,
    // });

    const eventId = `mock-event-${Date.now()}`;

    console.error(`[SENTRY] Captured: ${error.message} (${eventId})`);

    return eventId;
}

/**
 * Capture a message
 */
export function captureMessage(
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): string {
    // const eventId = Sentry.captureMessage(message, level);
    const eventId = `mock-msg-${Date.now()}`;

    console.log(`[SENTRY] Message: ${message} (${level})`);

    return eventId;
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
    category: string,
    message: string,
    _level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    _data?: Record<string, unknown>
): void {
    // Sentry.addBreadcrumb({
    //   category,
    //   message,
    //   level,
    //   data,
    //   timestamp: Date.now() / 1000,
    // });

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[BREADCRUMB] ${category}: ${message}`);
    }
}

/**
 * Set user context
 */
export function setUser(_user: SentryUserContext | null): void {
    // Sentry.setUser(user);
}

/**
 * Set tag
 */
export function setTag(_key: string, _value: string): void {
    // Sentry.setTag(key, value);
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
    name: string,
    op: string
): { finish: () => void } {
    // const transaction = Sentry.startTransaction({ name, op });
    const startTime = Date.now();

    return {
        finish: () => {
            const duration = Date.now() - startTime;
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[TRANSACTION] ${op}:${name} completed in ${duration}ms`);
            }
        },
    };
}

/**
 * Flush pending events
 */
export async function flush(_timeout: number = 2000): Promise<boolean> {
    // return Sentry.flush(timeout);
    return true;
}
