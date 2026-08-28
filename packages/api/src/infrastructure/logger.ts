/**
 * Logger Utility
 * Phase 1: Emergency Cleanup - Quick Win
 *
 * Provides a centralized, production-grade logging system with:
 * - Multiple log levels (error, warn, info, debug, trace)
 * - Structured logging with context
 * - Environment-aware output (development vs production)
 * - Request-scoped logging support
 * - No external dependencies for core functionality
 */

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4,
}

export interface LogContext {
    [key: string]: unknown;
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: LogContext;
    error?: Error;
}

interface LoggerConfig {
    level: LogLevel;
    includeTimestamp: boolean;
    includeLevel: boolean;
    colorize: boolean;
    prettyPrint: boolean;
}

/**
 * Logger class for structured logging
 */
export class Logger {
    private config: LoggerConfig;
    private readonly contextPrefix: string;

    constructor(
        context: string,
        config?: Partial<LoggerConfig>
    ) {
        this.contextPrefix = context;
        this.config = {
            level: this.getLogLevelFromEnv(),
            includeTimestamp: true,
            includeLevel: true,
            colorize: this.isDevelopment(),
            prettyPrint: this.isDevelopment(),
            ...config,
        };
    }

    /**
     * Get log level from environment variable
     */
    private getLogLevelFromEnv(): LogLevel {
        const envLevel = process.env.LOG_LEVEL?.toUpperCase();
        switch (envLevel) {
            case 'ERROR':
                return LogLevel.ERROR;
            case 'WARN':
                return LogLevel.WARN;
            case 'INFO':
                return LogLevel.INFO;
            case 'DEBUG':
                return LogLevel.DEBUG;
            case 'TRACE':
                return LogLevel.TRACE;
            default:
                // In production, only log errors and warnings
                // In development, log everything
                return this.isDevelopment() ? LogLevel.DEBUG : LogLevel.WARN;
        }
    }

    /**
     * Check if running in development environment
     */
    private isDevelopment(): boolean {
        return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    }

    /**
     * Check if a log level should be output
     */
    private shouldLog(level: LogLevel): boolean {
        return level <= this.config.level;
    }

    /**
     * Format log entry for output
     */
    private formatLogEntry(entry: LogEntry): string {
        const parts: string[] = [];

        if (this.config.includeTimestamp) {
            parts.push(`[${entry.timestamp}]`);
        }

        if (this.config.includeLevel) {
            const levelName = LogLevel[entry.level];
            const coloredLevel = this.config.colorize
                ? this.colorizeLevel(levelName, entry.level)
                : levelName;
            parts.push(`[${coloredLevel}]`);
        }

        parts.push(`[${this.contextPrefix}]`);
        parts.push(entry.message);

        return parts.join(' ');
    }

    /**
     * Add ANSI colors to log level
     */
    private colorizeLevel(level: string, logLevel: LogLevel): string {
        const colors = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m',  // Yellow
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[90m', // Gray
            TRACE: '\x1b[90m', // Gray
        };
        const reset = '\x1b[0m';
        return `${colors[level as keyof typeof colors] || ''}${level}${reset}`;
    }

    /**
     * Output log entry
     */
    private output(entry: LogEntry): void {
        if (!this.shouldLog(entry.level)) {
            return;
        }

        const formattedMessage = this.formatLogEntry(entry);
        const output = this.config.prettyPrint && entry.context
            ? `${formattedMessage}\n${JSON.stringify(entry.context, null, 2)}`
            : formattedMessage;

        // Write to appropriate stream
        const stream = entry.level >= LogLevel.ERROR ? console.error : console.log;
        stream(output);

        // If error present, log error details
        if (entry.error) {
            if (this.config.prettyPrint) {
                console.error(entry.error);
            } else {
                console.error({
                    error: {
                        name: entry.error.name,
                        message: entry.error.message,
                        stack: entry.error.stack,
                    },
                });
            }
        }
    }

    /**
     * Create a log entry
     */
    private createEntry(
        level: LogLevel,
        message: string,
        context?: LogContext,
        error?: Error
    ): LogEntry {
        return {
            level,
            message,
            timestamp: new Date().toISOString(),
            context,
            error,
        };
    }

    /**
     * Log error message
     */
    error(message: string, context?: LogContext, error?: Error): void {
        this.output(this.createEntry(LogLevel.ERROR, message, context, error));
    }

    /**
     * Log warning message
     */
    warn(message: string, context?: LogContext): void {
        this.output(this.createEntry(LogLevel.WARN, message, context));
    }

    /**
     * Log info message
     */
    info(message: string, context?: LogContext): void {
        this.output(this.createEntry(LogLevel.INFO, message, context));
    }

    /**
     * Log debug message
     */
    debug(message: string, context?: LogContext): void {
        this.output(this.createEntry(LogLevel.DEBUG, message, context));
    }

    /**
     * Log trace message
     */
    trace(message: string, context?: LogContext): void {
        this.output(this.createEntry(LogLevel.TRACE, message, context));
    }

    /**
     * Create a child logger with additional context
     */
    child(childContext: string): Logger {
        return new Logger(`${this.contextPrefix}:${childContext}`, this.config);
    }
}

/**
 * Default logger instance for root context
 */
export const rootLogger = new Logger('App');

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string, config?: Partial<LoggerConfig>): Logger {
    return new Logger(context, config);
}

/**
 * Convenience functions for quick logging without creating a logger instance
 */
export const log = {
    error: (message: string, context?: LogContext, error?: Error) => rootLogger.error(message, context, error),
    warn: (message: string, context?: LogContext) => rootLogger.warn(message, context),
    info: (message: string, context?: LogContext) => rootLogger.info(message, context),
    debug: (message: string, context?: LogContext) => rootLogger.debug(message, context),
    trace: (message: string, context?: LogContext) => rootLogger.trace(message, context),
};
