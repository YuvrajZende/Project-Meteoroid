/**
 * Structured Logger
 * Pino-based JSON logging with request context
 * 
 * Professional logging for production environments
 */

import pino from 'pino';

/**
 * Log levels
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Logger configuration
 */
export interface LoggerConfig {
    level?: LogLevel;
    prettyPrint?: boolean;
    redactFields?: string[];
}

/**
 * Create the Pino logger instance
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
    const isProd = process.env.NODE_ENV === 'production';
    const level = config.level || (process.env.LOG_LEVEL as LogLevel) || (isProd ? 'info' : 'debug');

    const redactPaths = [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'token',
        'apiKey',
        'secret',
        ...(config.redactFields || []),
    ];

    // Base configuration
    const baseConfig: pino.LoggerOptions = {
        level,
        redact: redactPaths,
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            level: (label) => ({ level: label.toUpperCase() }),
            bindings: (bindings) => ({
                pid: bindings.pid,
                host: bindings.hostname,
                service: 'loveable-api',
                version: process.env.npm_package_version || '1.0.0',
            }),
        },
        serializers: {
            req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                path: req.routeOptions?.url,
                parameters: req.params,
                headers: {
                    host: req.headers.host,
                    'user-agent': req.headers['user-agent'],
                    'content-type': req.headers['content-type'],
                },
            }),
            res: (res) => ({
                statusCode: res.statusCode,
            }),
            err: pino.stdSerializers.err,
        },
    };

    // Development: pretty print with clean format
    if (!isProd && (config.prettyPrint !== false)) {
        return pino({
            ...baseConfig,
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'UTC:yyyy-mm-dd HH:MM:ss',
                    ignore: 'pid,hostname,service,version',
                    singleLine: true,
                    messageFormat: '[{level}] {msg}',
                },
            },
        });
    }

    // Production: JSON logs
    return pino(baseConfig);
}

/**
 * Child logger with request context
 */
export function createRequestLogger(
    logger: pino.Logger,
    requestId: string,
    userId?: string
): pino.Logger {
    return logger.child({
        requestId,
        userId,
    });
}

/**
 * Log level labels (no emojis, professional)
 */
export const LOG_LABELS: Record<LogLevel, string> = {
    fatal: 'FATAL',
    error: 'ERROR',
    warn: 'WARN',
    info: 'INFO',
    debug: 'DEBUG',
    trace: 'TRACE',
};

// Default logger instance
let defaultLogger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
    if (!defaultLogger) {
        defaultLogger = createLogger();
    }
    return defaultLogger;
}

export function setLogger(logger: pino.Logger): void {
    defaultLogger = logger;
}

/**
 * Console log helper for startup messages (before logger is ready)
 */
export function logStartup(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [STARTUP] ${message}`);
}

export function logError(message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`);
    if (error) {
        console.error(`[${timestamp}] [ERROR]   ${error.message}`);
    }
}
