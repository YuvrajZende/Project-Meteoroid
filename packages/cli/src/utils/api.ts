/**
 * Loveable CLI - API Client
 * Handles all HTTP requests to the backend server
 */

import { formatDuration } from './theme.js';

export interface APIResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
    duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

let config = {
    baseUrl: 'http://localhost:3000',
    token: '',
    timeout: 900000, // 15 minutes for very long AI operations (Integrated Orchestrator can take 8-12 minutes)
};

export function configure(options: Partial<typeof config>): void {
    config = { ...config, ...options };
}

export function getConfig(): typeof config {
    return { ...config };
}

export function setToken(token: string): void {
    config.token = token;
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export async function request<T = unknown>(
    endpoint: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: unknown;
        headers?: Record<string, string>;
        timeout?: number;
    } = {}
): Promise<APIResponse<T>> {
    const { method = 'GET', body, headers = {}, timeout = config.timeout } = options;

    // Build URL - note: /health is at root, /api/v1/* for other endpoints
    let url: string;
    if (endpoint.startsWith('http')) {
        url = endpoint;
    } else if (endpoint === '/health' || endpoint.startsWith('/health/')) {
        // Health endpoints are at root level
        url = `${config.baseUrl}${endpoint}`;
    } else {
        // Other API endpoints under /api/v1
        url = `${config.baseUrl}/api/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        // Use keepalive to prevent Windows from dropping long connections
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Connection': 'keep-alive',
                ...(config.token && { Authorization: `Bearer ${config.token}` }),
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
            keepalive: true, // Keep connection alive for long requests
        });

        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        let data: T | undefined;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
            try {
                data = await response.json() as T;
            } catch {
                // Failed to parse JSON
            }
        }

        return {
            success: response.ok,
            data,
            status: response.status,
            duration,
            ...(response.ok ? {} : { error: getErrorMessage(response.status, data) }),
        };
    } catch (err) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (err instanceof Error) {
            if (err.name === 'AbortError') {
                return { success: false, error: `Request timed out after ${formatDuration(timeout)}`, status: 0, duration };
            }
            return { success: false, error: err.message, status: 0, duration };
        }

        return { success: false, error: 'Unknown error', status: 0, duration };
    }
}

function getErrorMessage(status: number, data: unknown): string {
    if (data && typeof data === 'object') {
        if ('error' in data) return String((data as { error: unknown }).error);
        if ('message' in data) return String((data as { message: unknown }).message);
    }

    switch (status) {
        case 400: return 'Bad request';
        case 401: return 'Unauthorized';
        case 403: return 'Forbidden';
        case 404: return 'Not found';
        case 429: return 'Rate limited';
        case 500: return 'Server error';
        default: return `HTTP ${status}`;
    }
}

// Convenience methods
export const get = <T = unknown>(endpoint: string) => request<T>(endpoint, { method: 'GET' });
export const post = <T = unknown>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'POST', body });
export const put = <T = unknown>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PUT', body });
export const patch = <T = unknown>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PATCH', body });
export const del = <T = unknown>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' });

// Long-running operation methods with explicit timeouts (for code generation)
export const postWithTimeout = <T = unknown>(endpoint: string, body?: unknown, timeoutMs?: number) =>
    request<T>(endpoint, { method: 'POST', body, timeout: timeoutMs || config.timeout });

// Health check
export async function checkHealth(): Promise<{ online: boolean; latency: number }> {
    const response = await get('/health');
    return { online: response.success, latency: response.duration };
}

export default { configure, getConfig, setToken, request, get, post, postWithTimeout, put, patch, del, checkHealth };
