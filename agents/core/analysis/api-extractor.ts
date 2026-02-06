/**
 * API Call Extractor
 * 
 * Extracts API calls from frontend source files by analyzing:
 * - fetch() calls
 * - axios usage
 * - SWR/React Query hooks
 * - tRPC client calls
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
    ExtractedAPICall,
    HttpMethod,
    ApiLibraryType,
    InferredType
} from './types.js';

// Patterns for detecting API calls
const API_PATTERNS = {
    // Fetch patterns
    fetch: [
        // fetch('/api/endpoint')
        /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
        // fetch(url, { method: 'POST' })
        /fetch\s*\([^)]*['"`]([^'"`]+)['"`][^)]*method\s*:\s*['"`](\w+)['"`]/gi,
    ],

    // Axios patterns
    axios: [
        // axios.get('/api/endpoint')
        /axios\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
        // axios({ url: '/api/endpoint', method: 'POST' })
        /axios\s*\(\s*\{[^}]*url\s*:\s*['"`]([^'"`]+)['"`][^}]*method\s*:\s*['"`](\w+)['"`]/gi,
    ],

    // SWR patterns
    swr: [
        // useSWR('/api/endpoint')
        /useSWR\s*\(\s*['"`]([^'"`]+)['"`]/g,
        // useSWR(() => '/api/endpoint')
        /useSWR\s*\(\s*\(\s*\)\s*=>\s*['"`]([^'"`]+)['"`]/g,
    ],

    // React Query patterns
    reactQuery: [
        // useQuery({ queryKey: ['users'], queryFn: () => fetch('/api/users') })
        /useQuery\s*\([^)]*fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
        // useQuery(['users'], () => axios.get('/api/users'))
        /useQuery\s*\([^)]*axios\s*\.\s*(\w+)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    ],

    // tRPC patterns
    trpc: [
        // trpc.users.list.useQuery()
        /trpc\.(\w+)\.(\w+)\.(useQuery|useMutation)/g,
        // api.users.list.useQuery()
        /api\.(\w+)\.(\w+)\.(useQuery|useMutation)/g,
    ],
};

// Patterns for detecting authentication requirements
const AUTH_PATTERNS = [
    /Authorization/i,
    /Bearer\s+/i,
    /token/i,
    /auth/i,
    /credentials\s*:\s*['"`]include['"`]/i,
    /withCredentials\s*:\s*true/i,
];

export class APICallExtractor {
    private rootPath: string;
    private extractedCalls: ExtractedAPICall[] = [];

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    /**
     * Extract API calls from a single file
     */
    private async extractFromFile(filePath: string): Promise<ExtractedAPICall[]> {
        const calls: ExtractedAPICall[] = [];

        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const relativePath = path.relative(this.rootPath, filePath);

            // Detect library type used in file
            const libraryType = this.detectLibraryType(content);

            // Extract fetch calls
            for (const pattern of API_PATTERNS.fetch) {
                let match;
                pattern.lastIndex = 0;
                while ((match = pattern.exec(content)) !== null) {
                    const endpoint = match[1];
                    const method = (match[2]?.toUpperCase() || 'GET') as HttpMethod;

                    if (this.isValidEndpoint(endpoint)) {
                        const lineNumber = this.getLineNumber(content, match.index);
                        calls.push({
                            endpoint: this.normalizeEndpoint(endpoint),
                            method,
                            library: 'fetch',
                            sourceFile: relativePath,
                            lineNumber,
                            requiresAuth: this.detectAuthRequirement(content, match.index),
                            pathParams: this.extractPathParams(endpoint),
                            codeSnippet: this.getCodeSnippet(lines, lineNumber),
                        });
                    }
                }
            }

            // Extract axios calls
            for (const pattern of API_PATTERNS.axios) {
                let match;
                pattern.lastIndex = 0;
                while ((match = pattern.exec(content)) !== null) {
                    let method: HttpMethod;
                    let endpoint: string;

                    if (match[2]) {
                        // axios.get(url) pattern
                        method = match[1].toUpperCase() as HttpMethod;
                        endpoint = match[2];
                    } else {
                        // axios({ url, method }) pattern
                        endpoint = match[1];
                        method = (match[2]?.toUpperCase() || 'GET') as HttpMethod;
                    }

                    if (this.isValidEndpoint(endpoint)) {
                        const lineNumber = this.getLineNumber(content, match.index);
                        calls.push({
                            endpoint: this.normalizeEndpoint(endpoint),
                            method,
                            library: 'axios',
                            sourceFile: relativePath,
                            lineNumber,
                            requiresAuth: this.detectAuthRequirement(content, match.index),
                            pathParams: this.extractPathParams(endpoint),
                            codeSnippet: this.getCodeSnippet(lines, lineNumber),
                        });
                    }
                }
            }

            // Extract SWR calls (always GET)
            for (const pattern of API_PATTERNS.swr) {
                let match;
                pattern.lastIndex = 0;
                while ((match = pattern.exec(content)) !== null) {
                    const endpoint = match[1];

                    if (this.isValidEndpoint(endpoint)) {
                        const lineNumber = this.getLineNumber(content, match.index);
                        calls.push({
                            endpoint: this.normalizeEndpoint(endpoint),
                            method: 'GET',
                            library: 'swr',
                            sourceFile: relativePath,
                            lineNumber,
                            requiresAuth: this.detectAuthRequirement(content, match.index),
                            pathParams: this.extractPathParams(endpoint),
                            codeSnippet: this.getCodeSnippet(lines, lineNumber),
                        });
                    }
                }
            }

            // Extract React Query calls
            for (const pattern of API_PATTERNS.reactQuery) {
                let match;
                pattern.lastIndex = 0;
                while ((match = pattern.exec(content)) !== null) {
                    const endpoint = match[2] || match[1];
                    const method = match[1]?.toUpperCase() as HttpMethod || 'GET';

                    if (this.isValidEndpoint(endpoint)) {
                        const lineNumber = this.getLineNumber(content, match.index);
                        calls.push({
                            endpoint: this.normalizeEndpoint(endpoint),
                            method,
                            library: 'tanstack-query',
                            sourceFile: relativePath,
                            lineNumber,
                            requiresAuth: this.detectAuthRequirement(content, match.index),
                            pathParams: this.extractPathParams(endpoint),
                            codeSnippet: this.getCodeSnippet(lines, lineNumber),
                        });
                    }
                }
            }

        } catch {
            // Skip files that can't be read
        }

        return calls;
    }

    /**
     * Detect which API library is primarily used in the file
     */
    private detectLibraryType(content: string): ApiLibraryType {
        if (content.includes('import') || content.includes('require')) {
            if (/from\s+['"]axios['"]/.test(content)) return 'axios';
            if (/from\s+['"]swr['"]/.test(content)) return 'swr';
            if (/from\s+['"]@tanstack\/react-query['"]/.test(content)) return 'tanstack-query';
            if (/from\s+['"]react-query['"]/.test(content)) return 'react-query';
            if (/from\s+['"]@trpc/.test(content)) return 'trpc';
            if (/from\s+['"]@apollo/.test(content)) return 'apollo';
        }
        return 'fetch';
    }

    /**
     * Check if an endpoint string is valid
     */
    private isValidEndpoint(endpoint: string): boolean {
        // Filter out non-API endpoints
        if (!endpoint) return false;
        if (endpoint.startsWith('http://localhost')) return true;
        if (endpoint.startsWith('https://')) return false; // External API
        if (endpoint.startsWith('/api/') || endpoint.startsWith('/api')) return true;
        if (endpoint.startsWith('/v1/') || endpoint.startsWith('/v2/')) return true;
        if (endpoint.match(/^\/\w+/)) return true; // Other relative paths
        return false;
    }

    /**
     * Normalize endpoint (remove query params, template literals)
     */
    private normalizeEndpoint(endpoint: string): string {
        // Remove query string
        let normalized = endpoint.split('?')[0];

        // Convert template literal variables to path params
        normalized = normalized.replace(/\$\{([^}]+)\}/g, ':$1');

        // Convert bracket notation [id] to :id
        normalized = normalized.replace(/\[([^\]]+)\]/g, ':$1');

        return normalized;
    }

    /**
     * Extract path parameters from endpoint
     */
    private extractPathParams(endpoint: string): string[] {
        const params: string[] = [];

        // Match :param patterns
        const colonParams = endpoint.match(/:(\w+)/g);
        if (colonParams) {
            params.push(...colonParams.map(p => p.substring(1)));
        }

        // Match [param] patterns
        const bracketParams = endpoint.match(/\[([^\]]+)\]/g);
        if (bracketParams) {
            params.push(...bracketParams.map(p => p.slice(1, -1)));
        }

        // Match ${param} patterns
        const templateParams = endpoint.match(/\$\{([^}]+)\}/g);
        if (templateParams) {
            params.push(...templateParams.map(p => p.slice(2, -1)));
        }

        return [...new Set(params)];
    }

    /**
     * Get line number from character index
     */
    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Get code snippet around a line
     */
    private getCodeSnippet(lines: string[], lineNumber: number, context: number = 2): string {
        const start = Math.max(0, lineNumber - context - 1);
        const end = Math.min(lines.length, lineNumber + context);
        return lines.slice(start, end).join('\n');
    }

    /**
     * Detect if an API call requires authentication
     */
    private detectAuthRequirement(content: string, callIndex: number): boolean {
        // Look in a window around the API call
        const windowStart = Math.max(0, callIndex - 500);
        const windowEnd = Math.min(content.length, callIndex + 500);
        const window = content.substring(windowStart, windowEnd);

        return AUTH_PATTERNS.some(pattern => pattern.test(window));
    }

    /**
     * Recursively find all source files
     */
    private async findSourceFiles(dir: string, extensions: string[] = ['.js', '.jsx', '.ts', '.tsx']): Promise<string[]> {
        const files: string[] = [];
        const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit'];

        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (!excludeDirs.includes(entry.name)) {
                        files.push(...await this.findSourceFiles(fullPath, extensions));
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch {
            // Skip directories that can't be read
        }

        return files;
    }

    /**
     * Deduplicate API calls (same endpoint + method)
     */
    private deduplicateCalls(calls: ExtractedAPICall[]): ExtractedAPICall[] {
        const seen = new Map<string, ExtractedAPICall>();

        for (const call of calls) {
            const key = `${call.method}:${call.endpoint}`;
            if (!seen.has(key)) {
                seen.set(key, call);
            } else {
                // Merge auth requirement (if any call requires auth, mark as requiring auth)
                const existing = seen.get(key)!;
                if (call.requiresAuth) {
                    existing.requiresAuth = true;
                }
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Extract all API calls from the repository
     */
    async extract(): Promise<ExtractedAPICall[]> {
        const sourceFiles = await this.findSourceFiles(this.rootPath);
        const allCalls: ExtractedAPICall[] = [];

        for (const file of sourceFiles) {
            const calls = await this.extractFromFile(file);
            allCalls.push(...calls);
        }

        this.extractedCalls = this.deduplicateCalls(allCalls);
        return this.extractedCalls;
    }

    /**
     * Get extracted calls grouped by endpoint
     */
    getGroupedByEndpoint(): Map<string, ExtractedAPICall[]> {
        const grouped = new Map<string, ExtractedAPICall[]>();

        for (const call of this.extractedCalls) {
            const existing = grouped.get(call.endpoint) || [];
            existing.push(call);
            grouped.set(call.endpoint, existing);
        }

        return grouped;
    }
}

export default APICallExtractor;
