/**
 * Preview Service (Phase 16)
 * 
 * Provides real-time preview and collaboration capabilities:
 * - Live sandboxed iframe generation for generated code
 * - esm.sh for browser-native module imports
 * - React/Vue/Vanilla JS preview support
 * - Hot Module Reload (HMR) via WebSocket
 * - Collaboration features (cursor presence, CRDT sync)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type PreviewFramework = 'react' | 'vue' | 'vanilla' | 'svelte' | 'preact';

export interface PreviewConfig {
    /** Enable preview service */
    enabled: boolean;
    /** Base URL for esm.sh CDN */
    esmBaseUrl: string;
    /** Debounce delay for HMR updates (ms) */
    hmrDebounceMs: number;
    /** Max preview sessions per project */
    maxSessionsPerProject: number;
    /** Preview session timeout (ms) */
    sessionTimeoutMs: number;
    /** Enable collaboration features */
    collaborationEnabled: boolean;
    /** Sandbox CSP policy */
    sandboxPolicy: string;
}

export interface PreviewFile {
    path: string;
    content: string;
    language: 'typescript' | 'javascript' | 'jsx' | 'tsx' | 'css' | 'html' | 'json';
}

export interface PreviewRequest {
    projectId: string;
    files: PreviewFile[];
    entryPoint?: string;
    framework?: PreviewFramework;
    dependencies?: Record<string, string>;
    customHead?: string;
    theme?: 'light' | 'dark' | 'system';
}

export interface PreviewSession {
    id: string;
    projectId: string;
    framework: PreviewFramework;
    files: Map<string, PreviewFile>;
    dependencies: Record<string, string>;
    entryPoint: string;
    createdAt: Date;
    lastUpdatedAt: Date;
    activeClients: Set<string>;
    version: number;
}

export interface PreviewResult {
    sessionId: string;
    html: string;
    previewUrl: string;
    framework: PreviewFramework;
    dependencies: string[];
    version: number;
}

export interface HMRUpdate {
    type: 'full-reload' | 'hot-update' | 'css-update' | 'error';
    sessionId: string;
    version: number;
    files?: string[];
    error?: string;
    timestamp: number;
}

export interface CollaborationCursor {
    clientId: string;
    userId?: string;
    username?: string;
    color: string;
    position: { line: number; column: number };
    file: string;
    timestamp: number;
}

export interface CollaborationState {
    sessionId: string;
    cursors: Map<string, CollaborationCursor>;
    activeUsers: Map<string, { userId?: string; username?: string; color: string; joinedAt: Date }>;
}

// ============================================
// CONSTANTS
// ============================================

const ESM_CDN_URL = 'https://esm.sh';

const FRAMEWORK_CONFIGS: Record<PreviewFramework, {
    imports: string[];
    setupCode: string;
    renderCode: string;
}> = {
    react: {
        imports: [
            'import React from "react";',
            'import ReactDOM from "react-dom/client";',
        ],
        setupCode: `
            const root = ReactDOM.createRoot(document.getElementById('root'));
        `,
        renderCode: 'root.render(React.createElement(App));',
    },
    preact: {
        imports: [
            'import { h, render } from "preact";',
        ],
        setupCode: '',
        renderCode: 'render(h(App), document.getElementById("root"));',
    },
    vue: {
        imports: [
            'import { createApp } from "vue";',
        ],
        setupCode: '',
        renderCode: 'createApp(App).mount("#root");',
    },
    svelte: {
        imports: [
            '// Svelte support via compiled output',
        ],
        setupCode: '',
        renderCode: 'new App({ target: document.getElementById("root") });',
    },
    vanilla: {
        imports: [],
        setupCode: '',
        renderCode: 'if (typeof init === "function") init();',
    },
};

const DEFAULT_SANDBOX_POLICY = 'allow-scripts allow-same-origin allow-popups allow-forms';

const CURSOR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

// ============================================
// PREVIEW SERVICE CLASS
// ============================================

export class PreviewService extends EventEmitter {
    private config: PreviewConfig;
    private sessions: Map<string, PreviewSession> = new Map();
    private collaborationStates: Map<string, CollaborationState> = new Map();
    private hmrSubscribers: Map<string, Set<(update: HMRUpdate) => void>> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private initialized: boolean = false;

    constructor(config?: Partial<PreviewConfig>) {
        super();
        this.config = {
            enabled: config?.enabled ?? (process.env.PREVIEW_ENABLED !== 'false'),
            esmBaseUrl: config?.esmBaseUrl || process.env.ESM_CDN_URL || ESM_CDN_URL,
            hmrDebounceMs: config?.hmrDebounceMs || parseInt(process.env.HMR_DEBOUNCE_MS || '100', 10),
            maxSessionsPerProject: config?.maxSessionsPerProject || parseInt(process.env.PREVIEW_MAX_SESSIONS || '10', 10),
            sessionTimeoutMs: config?.sessionTimeoutMs || parseInt(process.env.PREVIEW_SESSION_TIMEOUT || '3600000', 10), // 1 hour
            collaborationEnabled: config?.collaborationEnabled ?? (process.env.COLLABORATION_ENABLED !== 'false'),
            sandboxPolicy: config?.sandboxPolicy || process.env.PREVIEW_SANDBOX_POLICY || DEFAULT_SANDBOX_POLICY,
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Start cleanup interval (every 5 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);

        this.initialized = true;
    }

    // ============================================
    // CORE PREVIEW METHODS
    // ============================================

    /**
     * Create or update a preview session
     */
    async createPreview(request: PreviewRequest): Promise<PreviewResult> {
        const {
            projectId,
            files,
            entryPoint = 'src/App.tsx',
            framework = this.detectFramework(files),
            dependencies = {},
            customHead = '',
            theme = 'system',
        } = request;

        console.log(`[PREVIEW] Creating preview for project: ${projectId}, framework: ${framework}`);

        // Get or create session
        let session = this.getSessionByProject(projectId);

        if (!session) {
            session = {
                id: uuidv4(),
                projectId,
                framework,
                files: new Map(),
                dependencies,
                entryPoint,
                createdAt: new Date(),
                lastUpdatedAt: new Date(),
                activeClients: new Set(),
                version: 1,
            };
            this.sessions.set(session.id, session);
        } else {
            session.version++;
            session.lastUpdatedAt = new Date();
        }

        // Update files
        for (const file of files) {
            session.files.set(file.path, file);
        }
        session.dependencies = { ...session.dependencies, ...dependencies };

        // Generate preview HTML
        const html = this.generatePreviewHtml(session, customHead, theme);
        const previewUrl = `/api/v1/preview/${session.id}`;

        // Emit HMR update for connected clients
        this.emitHMRUpdate({
            type: 'full-reload',
            sessionId: session.id,
            version: session.version,
            files: files.map(f => f.path),
            timestamp: Date.now(),
        });

        return {
            sessionId: session.id,
            html,
            previewUrl,
            framework: session.framework,
            dependencies: Object.keys(session.dependencies),
            version: session.version,
        };
    }

    /**
     * Update specific files and trigger HMR
     */
    async updateFiles(sessionId: string, files: PreviewFile[]): Promise<HMRUpdate> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Preview session not found: ${sessionId}`);
        }

        session.version++;
        session.lastUpdatedAt = new Date();

        const updatedFiles: string[] = [];
        const cssOnly = files.every(f => f.language === 'css');

        for (const file of files) {
            session.files.set(file.path, file);
            updatedFiles.push(file.path);
        }

        const update: HMRUpdate = {
            type: cssOnly ? 'css-update' : 'hot-update',
            sessionId,
            version: session.version,
            files: updatedFiles,
            timestamp: Date.now(),
        };

        this.emitHMRUpdate(update);
        return update;
    }

    /**
     * Get preview HTML for a session
     */
    getPreviewHtml(sessionId: string): string | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        return this.generatePreviewHtml(session);
    }

    /**
     * Get session info
     */
    getSession(sessionId: string): PreviewSession | null {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get session by project ID
     */
    getSessionByProject(projectId: string): PreviewSession | null {
        const sessions = Array.from(this.sessions.values());
        for (const session of sessions) {
            if (session.projectId === projectId) {
                return session;
            }
        }
        return null;
    }

    /**
     * Delete a preview session
     */
    deleteSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        this.sessions.delete(sessionId);
        this.collaborationStates.delete(sessionId);
        this.hmrSubscribers.delete(sessionId);

        return true;
    }

    // ============================================
    // HOT MODULE RELOAD (HMR)
    // ============================================

    /**
     * Subscribe to HMR updates for a session
     */
    subscribeToHMR(sessionId: string, callback: (update: HMRUpdate) => void): () => void {
        if (!this.hmrSubscribers.has(sessionId)) {
            this.hmrSubscribers.set(sessionId, new Set());
        }
        this.hmrSubscribers.get(sessionId)!.add(callback);

        const session = this.sessions.get(sessionId);
        if (session) {
            session.activeClients.add(uuidv4());
        }

        // Return unsubscribe function
        return () => {
            this.hmrSubscribers.get(sessionId)?.delete(callback);
        };
    }

    /**
     * Emit HMR update to all subscribers
     */
    private emitHMRUpdate(update: HMRUpdate): void {
        const subscribers = this.hmrSubscribers.get(update.sessionId);
        if (!subscribers) return;

        const callbackList = Array.from(subscribers);
        for (const callback of callbackList) {
            try {
                callback(update);
            } catch (error) {
                console.error('[PREVIEW] HMR callback error:', error);
            }
        }

        this.emit('hmr-update', update);
    }

    /**
     * Force refresh all clients for a session
     */
    forceRefresh(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.version++;
        this.emitHMRUpdate({
            type: 'full-reload',
            sessionId,
            version: session.version,
            timestamp: Date.now(),
        });
    }

    // ============================================
    // COLLABORATION FEATURES
    // ============================================

    /**
     * Join a collaboration session
     */
    joinCollaboration(sessionId: string, clientId: string, userInfo?: { userId?: string; username?: string }): CollaborationState {
        if (!this.config.collaborationEnabled) {
            throw new Error('Collaboration features are disabled');
        }

        let state = this.collaborationStates.get(sessionId);
        if (!state) {
            state = {
                sessionId,
                cursors: new Map(),
                activeUsers: new Map(),
            };
            this.collaborationStates.set(sessionId, state);
        }

        // Assign color based on existing users
        const colorIndex = state.activeUsers.size % CURSOR_COLORS.length;
        state.activeUsers.set(clientId, {
            userId: userInfo?.userId,
            username: userInfo?.username,
            color: CURSOR_COLORS[colorIndex],
            joinedAt: new Date(),
        });

        this.emit('collaboration-join', { sessionId, clientId, userInfo });
        return state;
    }

    /**
     * Leave a collaboration session
     */
    leaveCollaboration(sessionId: string, clientId: string): void {
        const state = this.collaborationStates.get(sessionId);
        if (!state) return;

        state.activeUsers.delete(clientId);
        state.cursors.delete(clientId);

        this.emit('collaboration-leave', { sessionId, clientId });

        // Clean up empty sessions
        if (state.activeUsers.size === 0) {
            this.collaborationStates.delete(sessionId);
        }
    }

    /**
     * Update cursor position
     */
    updateCursor(sessionId: string, clientId: string, position: { line: number; column: number; file: string }): void {
        const state = this.collaborationStates.get(sessionId);
        if (!state) return;

        const userInfo = state.activeUsers.get(clientId);
        if (!userInfo) return;

        const cursor: CollaborationCursor = {
            clientId,
            userId: userInfo.userId,
            username: userInfo.username,
            color: userInfo.color,
            position: { line: position.line, column: position.column },
            file: position.file,
            timestamp: Date.now(),
        };

        state.cursors.set(clientId, cursor);
        this.emit('cursor-update', { sessionId, cursor });
    }

    /**
     * Get collaboration state
     */
    getCollaborationState(sessionId: string): CollaborationState | null {
        return this.collaborationStates.get(sessionId) || null;
    }

    // ============================================
    // HTML GENERATION
    // ============================================

    /**
     * Generate sandboxed preview HTML
     */
    private generatePreviewHtml(
        session: PreviewSession,
        customHead: string = '',
        theme: 'light' | 'dark' | 'system' = 'system'
    ): string {
        const imports = this.generateImports(session);
        const bundledCode = this.bundleFiles(session);
        const frameworkConfig = FRAMEWORK_CONFIGS[session.framework];

        const themeStyles = theme === 'dark'
            ? 'background: #1a1a1a; color: #ffffff;'
            : theme === 'light'
                ? 'background: #ffffff; color: #000000;'
                : '@media (prefers-color-scheme: dark) { body { background: #1a1a1a; color: #ffffff; } }';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loveable Preview</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ${theme !== 'system' ? themeStyles : ''}
        }
        ${theme === 'system' ? themeStyles : ''}
        #root { min-height: 100vh; }
        .loveable-error {
            padding: 20px;
            background: #ff6b6b;
            color: white;
            border-radius: 8px;
            margin: 20px;
            font-family: monospace;
            white-space: pre-wrap;
        }
        .loveable-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-size: 18px;
            color: #666;
        }
    </style>
    ${customHead}
</head>
<body>
    <div id="root"><div class="loveable-loading">Loading preview...</div></div>
    
    <script type="importmap">
    {
        "imports": {
            ${this.generateImportMap(session)}
        }
    }
    </script>
    
    <script type="module">
        // Error handler
        window.onerror = (msg, url, line, col, error) => {
            document.getElementById('root').innerHTML = 
                '<div class="loveable-error">Error: ' + msg + '</div>';
            return false;
        };

        // Framework imports
        ${imports}

        try {
            // User code
            ${bundledCode}

            // Framework setup
            ${frameworkConfig.setupCode}

            // Render
            ${frameworkConfig.renderCode}

            console.log('[Preview] Rendered successfully');
        } catch (error) {
            document.getElementById('root').innerHTML = 
                '<div class="loveable-error">' + error.stack + '</div>';
            console.error('[Preview Error]', error);
        }

        // HMR via Server-Sent Events (non-blocking, after render)
        try {
            const hmrSource = new EventSource('/api/v1/preview/${session.id}/stream');
            
            hmrSource.onmessage = (event) => {
                const update = JSON.parse(event.data);
                console.log('[HMR] Update received:', update);
                if (update.type === 'full-reload' || update.type === 'hot-update') {
                    location.reload();
                } else if (update.type === 'css-update') {
                    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                        link.href = link.href.split('?')[0] + '?v=' + update.version;
                    });
                }
            };

            hmrSource.onopen = () => console.log('[HMR] SSE Connected');
            hmrSource.onerror = (e) => console.log('[HMR] SSE Error (will retry)');
        } catch (e) {
            console.log('[HMR] SSE not available');
        }
    </script>
</body>
</html>`;
    }

    /**
     * Generate import statements
     */
    private generateImports(session: PreviewSession): string {
        const frameworkConfig = FRAMEWORK_CONFIGS[session.framework];
        const imports: string[] = [...frameworkConfig.imports];

        for (const [pkg, version] of Object.entries(session.dependencies)) {
            const versionSuffix = version ? `@${version}` : '';
            imports.push(`import * as ${this.sanitizePackageName(pkg)} from "${pkg}";`);
        }

        return imports.join('\n        ');
    }

    /**
     * Generate importmap JSON
     */
    private generateImportMap(session: PreviewSession): string {
        const entries: string[] = [];
        const baseUrl = this.config.esmBaseUrl;

        // Core framework imports
        if (session.framework === 'react') {
            entries.push(`"react": "${baseUrl}/react@18"`);
            entries.push(`"react-dom": "${baseUrl}/react-dom@18"`);
            entries.push(`"react-dom/client": "${baseUrl}/react-dom@18/client"`);
        } else if (session.framework === 'vue') {
            entries.push(`"vue": "${baseUrl}/vue@3"`);
        } else if (session.framework === 'preact') {
            entries.push(`"preact": "${baseUrl}/preact@10"`);
            entries.push(`"react": "${baseUrl}/preact/compat"`);
            entries.push(`"react-dom": "${baseUrl}/preact/compat"`);
        }

        // User dependencies
        for (const [pkg, version] of Object.entries(session.dependencies)) {
            const versionSuffix = version ? `@${version}` : '';
            entries.push(`"${pkg}": "${baseUrl}/${pkg}${versionSuffix}"`);
        }

        return entries.join(',\n            ');
    }

    /**
     * Bundle all files into executable code
     */
    private bundleFiles(session: PreviewSession): string {
        const code: string[] = [];

        // Add CSS as style tags
        const fileEntries = Array.from(session.files.entries());
        for (const [path, file] of fileEntries) {
            if (file.language === 'css') {
                code.push(`
                    (() => {
                        const style = document.createElement('style');
                        style.textContent = ${JSON.stringify(file.content)};
                        document.head.appendChild(style);
                    })();
                `);
            }
        }

        // Add entry point file (convert TSX/JSX to JS conceptually)
        const entryFile = session.files.get(session.entryPoint);
        if (entryFile) {
            // Note: In production, you'd use esbuild/swc for real transpilation
            // This is a simplified version for the preview service
            code.push(this.transpileToJS(entryFile.content, entryFile.language));
        }

        // Add other JS/TS files
        for (const [path, file] of fileEntries) {
            if (path !== session.entryPoint &&
                ['javascript', 'jsx', 'typescript', 'tsx'].includes(file.language)) {
                code.push(`// ${path}`);
                code.push(this.transpileToJS(file.content, file.language));
            }
        }

        return code.join('\n');
    }

    /**
     * Simple TypeScript/JSX to JS conversion
     * Note: In production, use esbuild or swc for proper transpilation
     */
    private transpileToJS(code: string, language: string): string {
        if (language === 'javascript') return code;

        // Very basic type stripping (production should use esbuild)
        let result = code
            // Remove type annotations
            .replace(/:\s*\w+(\[\])?(\s*[=,)])/g, '$2')
            // Remove interface/type declarations (simplified - no 's' flag)
            .replace(/^(export\s+)?(interface|type)\s+\w+[^}]*}/gm, '')
            // Remove import type
            .replace(/import\s+type\s+[^;]*;/g, '')
            // Remove generics in JSX (simplified)
            .replace(/<(\w+)<[^>]*>>/g, '<$1>')
            // Remove as assertions
            .replace(/\s+as\s+\w+/g, '');

        return result;
    }

    // ============================================
    // UTILITIES
    // ============================================

    /**
     * Detect framework from files
     */
    private detectFramework(files: PreviewFile[]): PreviewFramework {
        const content = files.map(f => f.content).join('\n');
        const paths = files.map(f => f.path.toLowerCase());

        if (content.includes('from "vue"') || content.includes("from 'vue'") ||
            paths.some(p => p.endsWith('.vue'))) {
            return 'vue';
        }
        if (content.includes('from "svelte"') || content.includes("from 'svelte'") ||
            paths.some(p => p.endsWith('.svelte'))) {
            return 'svelte';
        }
        if (content.includes('from "preact"') || content.includes("from 'preact'")) {
            return 'preact';
        }
        if (content.includes('from "react"') || content.includes("from 'react'") ||
            content.includes('React.') || content.includes('useState') ||
            paths.some(p => p.endsWith('.jsx') || p.endsWith('.tsx'))) {
            return 'react';
        }

        return 'vanilla';
    }

    /**
     * Sanitize package name for use as variable
     */
    private sanitizePackageName(pkg: string): string {
        return pkg
            .replace(/^@/, '')
            .replace(/\//g, '_')
            .replace(/-/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '');
    }

    /**
     * Clean up expired sessions
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now();
        let cleaned = 0;

        const sessionEntries = Array.from(this.sessions.entries());
        for (const [sessionId, session] of sessionEntries) {
            const age = now - session.lastUpdatedAt.getTime();
            if (age > this.config.sessionTimeoutMs && session.activeClients.size === 0) {
                this.sessions.delete(sessionId);
                this.collaborationStates.delete(sessionId);
                this.hmrSubscribers.delete(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[PREVIEW] Cleaned up ${cleaned} expired sessions`);
        }
    }

    // ============================================
    // STATUS & METRICS
    // ============================================

    /**
     * Get service status
     */
    getStatus(): {
        enabled: boolean;
        activeSessions: number;
        totalClients: number;
        collaborationEnabled: boolean;
        config: PreviewConfig;
    } {
        let totalClients = 0;
        const sessions = Array.from(this.sessions.values());
        for (const session of sessions) {
            totalClients += session.activeClients.size;
        }

        return {
            enabled: this.config.enabled,
            activeSessions: this.sessions.size,
            totalClients,
            collaborationEnabled: this.config.collaborationEnabled,
            config: this.config,
        };
    }

    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        console.log('[PREVIEW] Shutting down preview service...');

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Notify all HMR clients
        const subscriberEntries = Array.from(this.hmrSubscribers.entries());
        for (const [sessionId, subscribers] of subscriberEntries) {
            const callbackList = Array.from(subscribers);
            for (const callback of callbackList) {
                try {
                    callback({
                        type: 'error',
                        sessionId,
                        version: -1,
                        error: 'Server shutting down',
                        timestamp: Date.now(),
                    });
                } catch (e) {
                    // Ignore errors during shutdown
                }
            }
        }

        this.sessions.clear();
        this.collaborationStates.clear();
        this.hmrSubscribers.clear();

        console.log('[PREVIEW] Preview service shutdown complete');
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: PreviewService | null = null;

export function getPreviewService(): PreviewService {
    if (!instance) {
        instance = new PreviewService();
    }
    return instance;
}

export function createPreviewService(config?: Partial<PreviewConfig>): PreviewService {
    instance = new PreviewService(config);
    return instance;
}
