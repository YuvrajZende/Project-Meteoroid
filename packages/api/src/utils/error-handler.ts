/**
 * Error Handler
 * Custom error handling for the API
 */

import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { isProduction } from '../config/index.js';

/**
 * Standard error response format
 */
interface ErrorResponse {
    statusCode: number;
    error: string;
    message: string;
    requestId?: string;
    stack?: string;
}

/**
 * Register global error handler
 */
export function registerErrorHandler(app: FastifyInstance): void {
    app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        const statusCode = error.statusCode || 500;

        // Log error details
        app.log.error({
            requestId: request.id,
            statusCode,
            error: error.name,
            message: error.message,
            url: request.url,
            method: request.method,
            stack: error.stack,
        }, 'Request error');

        // Build error response
        const errorResponse: ErrorResponse = {
            statusCode,
            error: getErrorName(statusCode),
            message: isProduction && statusCode >= 500
                ? 'An internal server error occurred'
                : error.message,
            requestId: request.id,
        };

        // Include stack trace in development
        if (!isProduction) {
            errorResponse.stack = error.stack;
        }

        void reply.status(statusCode).send(errorResponse);
    });

    // Handle 404 (Not Found)
    app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
        const errorResponse: ErrorResponse = {
            statusCode: 404,
            error: 'Not Found',
            message: `Route ${request.method} ${request.url} not found`,
            requestId: request.id,
        };

        void reply.status(404).send(errorResponse);
    });

    app.log.info('[ERROR-HANDLER] Error handler registered');
}

/**
 * Get standard HTTP error name from status code
 */
function getErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        409: 'Conflict',
        422: 'Unprocessable Entity',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout',
    };

    return errorNames[statusCode] || 'Error';
}
