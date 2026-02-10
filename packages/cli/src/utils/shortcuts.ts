/**
 * Meteoroid CLI - Shortcut System
 * Context-aware shortcuts for files, sections, errors, and agent workspaces
 */

import { resolve, basename, dirname } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// SHORTCUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ShortcutType = 'file' | 'section' | 'error' | 'agent' | 'result' | 'bookmark';

export interface FileShortcut {
    key: string;
    path: string;
    description: string;
    category: string;
    lastAccessed?: Date;
    accessCount: number;
}

export interface SectionRef {
    key: string;           // e.g., "Aa:jwt"
    fileKey: string;       // e.g., "Aa"
    sectionName: string;   // e.g., "jwt"
    startLine?: number;
    endLine?: number;
    description: string;
}

export interface ErrorRef {
    key: string;           // e.g., "E1"
    fileKey: string;       // e.g., "Aa"
    line: number;
    message: string;
    type: 'type' | 'validation' | 'security' | 'dependency' | 'runtime';
    timestamp: Date;
}

export interface AgentWorkspace {
    key: string;           // e.g., "@auth"
    name: string;
    basePath: string;
    relatedShortcuts: string[];
}

export interface AnalysisResult {
    key: string;           // e.g., "Rf"
    type: 'frontend' | 'dependency' | 'api' | 'model' | 'test';
    path: string;
    description: string;
    timestamp: Date;
}

export interface Bookmark {
    key: string;
    target: string;        // shortcut it points to
    name: string;
    createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHORTCUT REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export interface ShortcutRegistry {
    files: Map<string, FileShortcut>;
    sections: Map<string, SectionRef>;
    errors: Map<string, ErrorRef>;
    agents: Map<string, AgentWorkspace>;
    results: Map<string, AnalysisResult>;
    bookmarks: Map<string, Bookmark>;
}

class ShortcutManager {
    private registry: ShortcutRegistry = {
        files: new Map(),
        sections: new Map(),
        errors: new Map(),
        agents: new Map(),
        results: new Map(),
        bookmarks: new Map(),
    };

    private projectRoot: string = process.cwd();
    private errorCounter: number = 0;

    /**
     * Find the project root by looking for agents/ folder or root package.json
     */
    private findProjectRoot(): string {
        let current = process.cwd();

        // Walk up the directory tree looking for project markers
        for (let i = 0; i < 5; i++) {  // Max 5 levels up
            // Check for agents folder (monorepo root marker)
            const agentsDir = resolve(current, 'agents');
            if (existsSync(agentsDir)) {
                return current;
            }

            // Check for root package.json with workspaces (monorepo marker)
            const pkgPath = resolve(current, 'package.json');
            if (existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'));
                    if (pkg.workspaces) {
                        return current;
                    }
                } catch {
                    // Ignore parse errors
                }
            }

            // Move up one directory
            const parent = dirname(current);
            if (parent === current) break; // Reached filesystem root
            current = parent;
        }

        return process.cwd(); // Fallback to cwd
    }

    /**
     * Initialize the shortcut system with project root
     * Always uses findProjectRoot() to ensure we find the actual monorepo root
     */
    initialize(_projectRoot?: string): void {
        // Always use findProjectRoot to find the real monorepo root
        // (ignore passed param since it might be packages/cli instead of project root)
        this.projectRoot = this.findProjectRoot();
        this.registerDefaultShortcuts();
    }

    /**
     * Register default shortcuts based on project structure
     */
    private registerDefaultShortcuts(): void {
        // Configuration files (always exist)
        this.registerFileIfExists('Ce', '.env', 'Environment Config', 'Configuration');
        this.registerFileIfExists('Ct', 'tsconfig.json', 'TypeScript Config', 'Configuration');
        this.registerFileIfExists('Cp', 'package.json', 'Package Config', 'Configuration');
        this.registerFileIfExists('Cr', 'README.md', 'Project README', 'Configuration');

        // Agent workspaces - check if agents folder exists at project root
        this.registerAgentIfExists('@auth', 'Auth Agent', 'agents/core/auth');
        this.registerAgentIfExists('@db', 'Database Agent', 'agents/core/database');
        this.registerAgentIfExists('@api', 'API Agent', 'agents/core/api');
        this.registerAgentIfExists('@security', 'Security Agent', 'agents/core/security');
        this.registerAgentIfExists('@monitor', 'Monitoring Agent', 'agents/core/monitoring');
        this.registerAgentIfExists('@analysis', 'Analysis Agent', 'agents/core/analysis');

        // API package files
        this.registerFileIfExists('Ai', 'packages/api/src/index.ts', 'API Entry Point', 'API');
        this.registerFileIfExists('Aa', 'packages/api/src/app.ts', 'API App', 'API');
        this.registerFileIfExists('Ar', 'packages/api/src/routes', 'API Routes', 'API');
        this.registerFileIfExists('As', 'packages/api/src/services', 'API Services', 'API');

        // CLI package files
        this.registerFileIfExists('Ci', 'packages/cli/src/index.ts', 'CLI Entry Point', 'CLI');
        this.registerFileIfExists('Cm', 'packages/cli/src/modes/chat-mode.ts', 'Chat Mode', 'CLI');
        this.registerFileIfExists('Cu', 'packages/cli/src/utils', 'CLI Utils', 'CLI');

        // Shared package files
        this.registerFileIfExists('Si', 'packages/shared/src/index.ts', 'Shared Entry', 'Shared');

        // Output/Analysis Results
        this.registerResultIfExists('Rf', 'frontend', 'output/analysis/details.md', 'Frontend Analysis');
        this.registerResultIfExists('Rj', 'api', 'output/analysis/analysis-report.json', 'JSON Analysis Report');

        // Analysis Agent Files (explicit shortcuts)
        this.registerFileIfExists('Fa', 'agents/core/analysis/frontend-analyzer.ts', 'Frontend Analyzer', 'Analysis Agents');
        this.registerFileIfExists('Fe', 'agents/core/analysis/api-extractor.ts', 'API Extractor', 'Analysis Agents');
        this.registerFileIfExists('Fr', 'agents/core/analysis/route-analyzer.ts', 'Route Analyzer', 'Analysis Agents');
        this.registerFileIfExists('Fm', 'agents/core/analysis/model-inferrer.ts', 'Model Inferrer', 'Analysis Agents');
        this.registerFileIfExists('Ff', 'agents/core/analysis/framework-detector.ts', 'Framework Detector', 'Analysis Agents');
        this.registerFileIfExists('Fp', 'agents/core/analysis/analysis-pipeline.ts', 'Analysis Pipeline', 'Analysis Agents');
        this.registerFileIfExists('Ft', 'agents/core/analysis/types.ts', 'Analysis Types', 'Analysis Agents');

        // Auth Agent Files
        this.registerFileIfExists('Ha', 'agents/core/auth/index.ts', 'Auth Agent Index', 'Auth Agents');

        // Database Agent Files
        this.registerFileIfExists('Da', 'agents/core/database/index.ts', 'Database Agent Index', 'Database Agents');

        // Security Agent Files
        this.registerFileIfExists('Sa', 'agents/core/security/index.ts', 'Security Agent Index', 'Security Agents');

        // Dynamically discover agents
        this.discoverAgentFiles();
    }

    /**
     * Register file only if it exists
     */
    private registerFileIfExists(key: string, relativePath: string, description: string, category: string): void {
        const fullPath = resolve(this.projectRoot, relativePath);
        if (existsSync(fullPath)) {
            this.registry.files.set(key, {
                key,
                path: fullPath,
                description,
                category,
                accessCount: 0,
            });
        }
    }

    /**
     * Register agent workspace only if it exists
     */
    private registerAgentIfExists(key: string, name: string, relativePath: string): void {
        const fullPath = resolve(this.projectRoot, relativePath);
        if (existsSync(fullPath)) {
            this.registry.agents.set(key, {
                key,
                name,
                basePath: fullPath,
                relatedShortcuts: [],
            });
        }
    }

    /**
     * Register result only if it exists
     */
    private registerResultIfExists(key: string, type: AnalysisResult['type'], relativePath: string, description: string): void {
        const fullPath = resolve(this.projectRoot, relativePath);
        if (existsSync(fullPath)) {
            this.registry.results.set(key, {
                key,
                type,
                path: fullPath,
                description,
                timestamp: new Date(),
            });
        }
    }

    /**
     * Dynamically discover agent files from agents/ directory
     */
    private discoverAgentFiles(): void {
        const agentsDir = resolve(this.projectRoot, 'agents');
        if (!existsSync(agentsDir)) return;

        try {
            // Check agents/index.ts
            const indexPath = resolve(agentsDir, 'index.ts');
            if (existsSync(indexPath)) {
                this.registerFileIfExists('Ax', 'agents/index.ts', 'Agents Index', 'Agents');
            }

            // Check core agents
            const coreDir = resolve(agentsDir, 'core');
            if (existsSync(coreDir)) {
                const dirs = readdirSync(coreDir);
                for (const dir of dirs.slice(0, 10)) { // Limit to first 10
                    const dirPath = resolve(coreDir, dir);
                    if (statSync(dirPath).isDirectory()) {
                        // Find main index.ts or agent.ts file
                        const indexFile = resolve(dirPath, 'index.ts');
                        const agentFile = resolve(dirPath, `${dir}-agent.ts`);
                        const targetFile = existsSync(indexFile) ? indexFile : (existsSync(agentFile) ? agentFile : null);

                        if (targetFile) {
                            const key = dir.charAt(0).toUpperCase() + dir.charAt(1).toLowerCase();
                            this.registerFileIfExists(key, targetFile.replace(this.projectRoot + '\\', '').replace(this.projectRoot + '/', ''),
                                `${dir} Agent`, 'Agents');
                        }
                    }
                }
            }
        } catch (err) {
            // Silently handle errors during discovery
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REGISTRATION METHODS
    // ═══════════════════════════════════════════════════════════════════════

    registerFile(key: string, relativePath: string, description: string, category: string): void {
        const fullPath = resolve(this.projectRoot, relativePath);
        this.registry.files.set(key, {
            key,
            path: fullPath,
            description,
            category,
            accessCount: 0,
        });
    }

    registerSection(fileKey: string, sectionName: string, description: string, startLine?: number, endLine?: number): void {
        const key = `${fileKey}:${sectionName}`;
        this.registry.sections.set(key, {
            key,
            fileKey,
            sectionName,
            description,
            startLine,
            endLine,
        });
    }

    registerError(fileKey: string, line: number, message: string, type: ErrorRef['type'] = 'runtime'): string {
        this.errorCounter++;
        const key = `E${this.errorCounter}`;
        this.registry.errors.set(key, {
            key,
            fileKey,
            line,
            message,
            type,
            timestamp: new Date(),
        });
        return key;
    }

    registerAgentWorkspace(key: string, name: string, relativePath: string): void {
        const fullPath = resolve(this.projectRoot, relativePath);
        this.registry.agents.set(key, {
            key,
            name,
            basePath: fullPath,
            relatedShortcuts: [],
        });
    }

    registerResult(key: string, type: AnalysisResult['type'], relativePath: string, description: string): void {
        const fullPath = resolve(this.projectRoot, relativePath);
        this.registry.results.set(key, {
            key,
            type,
            path: fullPath,
            description,
            timestamp: new Date(),
        });
    }

    registerBookmark(name: string, targetShortcut: string): void {
        this.registry.bookmarks.set(name, {
            key: name,
            target: targetShortcut,
            name,
            createdAt: new Date(),
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESOLUTION METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Resolve a shortcut to its full path and optional line range
     */
    resolve(shortcut: string): { path: string; line?: number; endLine?: number } | null {
        // Handle section shortcuts (Aa:jwt)
        if (shortcut.includes(':')) {
            const section = this.registry.sections.get(shortcut);
            if (section) {
                const file = this.registry.files.get(section.fileKey);
                if (file) {
                    return { path: file.path, line: section.startLine, endLine: section.endLine };
                }
            }
            // Try as file:line format (Aa:45)
            const [fileKey, lineStr] = shortcut.split(':');
            const line = parseInt(lineStr, 10);
            if (!isNaN(line)) {
                const file = this.registry.files.get(fileKey);
                if (file) {
                    return { path: file.path, line };
                }
            }
        }

        // Handle error shortcuts (E1)
        if (shortcut.startsWith('E') && /^E\d+$/.test(shortcut)) {
            const error = this.registry.errors.get(shortcut);
            if (error) {
                const file = this.registry.files.get(error.fileKey);
                if (file) {
                    return { path: file.path, line: error.line };
                }
            }
        }

        // Handle agent workspace shortcuts (@auth)
        if (shortcut.startsWith('@')) {
            const agent = this.registry.agents.get(shortcut);
            if (agent) {
                return { path: agent.basePath };
            }
        }

        // Handle result shortcuts (Rf)
        if (shortcut.startsWith('R')) {
            const result = this.registry.results.get(shortcut);
            if (result) {
                return { path: result.path };
            }
        }

        // Handle file shortcuts (Fa, Da, Aa)
        const file = this.registry.files.get(shortcut);
        if (file) {
            file.accessCount++;
            file.lastAccessed = new Date();
            return { path: file.path };
        }

        // Handle bookmarks
        const bookmark = this.registry.bookmarks.get(shortcut);
        if (bookmark) {
            return this.resolve(bookmark.target);
        }

        return null;
    }

    /**
     * Get related shortcuts for a given shortcut
     */
    getRelated(shortcut: string): string[] {
        const related: string[] = [];

        // Get file info
        const file = this.registry.files.get(shortcut);
        if (file) {
            // Find sections belonging to this file
            for (const [key, section] of this.registry.sections) {
                if (section.fileKey === shortcut) {
                    related.push(key);
                }
            }
            // Find errors in this file
            for (const [key, error] of this.registry.errors) {
                if (error.fileKey === shortcut) {
                    related.push(key);
                }
            }
            // Find files in same category
            for (const [key, otherFile] of this.registry.files) {
                if (key !== shortcut && otherFile.category === file.category) {
                    related.push(key);
                }
            }
        }

        return related;
    }

    /**
     * Fuzzy search for shortcuts
     */
    search(query: string): Array<{ key: string; description: string; type: ShortcutType }> {
        const results: Array<{ key: string; description: string; type: ShortcutType; score: number }> = [];
        const lowerQuery = query.toLowerCase();

        // Search files
        for (const [key, file] of this.registry.files) {
            const score = this.fuzzyScore(lowerQuery, key.toLowerCase(), file.description.toLowerCase());
            if (score > 0) {
                results.push({ key, description: file.description, type: 'file', score });
            }
        }

        // Search agents
        for (const [key, agent] of this.registry.agents) {
            const score = this.fuzzyScore(lowerQuery, key.toLowerCase(), agent.name.toLowerCase());
            if (score > 0) {
                results.push({ key, description: agent.name, type: 'agent', score });
            }
        }

        // Search errors
        for (const [key, error] of this.registry.errors) {
            const score = this.fuzzyScore(lowerQuery, key.toLowerCase(), error.message.toLowerCase());
            if (score > 0) {
                results.push({ key, description: error.message, type: 'error', score });
            }
        }

        // Sort by score and return top results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(({ key, description, type }) => ({ key, description, type }));
    }

    private fuzzyScore(query: string, key: string, description: string): number {
        let score = 0;
        if (key.startsWith(query)) score += 100;
        else if (key.includes(query)) score += 50;
        if (description.includes(query)) score += 25;
        // Word match in description
        const words = query.split(/\s+/);
        for (const word of words) {
            if (description.includes(word)) score += 10;
        }
        return score;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════════════

    getFiles(): Map<string, FileShortcut> {
        return this.registry.files;
    }

    getErrors(): Map<string, ErrorRef> {
        return this.registry.errors;
    }

    getAgents(): Map<string, AgentWorkspace> {
        return this.registry.agents;
    }

    getResults(): Map<string, AnalysisResult> {
        return this.registry.results;
    }

    getBookmarks(): Map<string, Bookmark> {
        return this.registry.bookmarks;
    }

    /**
     * Get shortcuts organized by category for display
     */
    getByCategory(): Record<string, Array<{ key: string; description: string }>> {
        const categories: Record<string, Array<{ key: string; description: string }>> = {};

        for (const [key, file] of this.registry.files) {
            if (!categories[file.category]) {
                categories[file.category] = [];
            }
            categories[file.category].push({ key, description: file.description });
        }

        // Add agents
        const agentEntries = Array.from(this.registry.agents.values()).map(a => ({
            key: a.key,
            description: a.name,
        }));
        if (agentEntries.length > 0) {
            categories['Agent Workspaces'] = agentEntries;
        }

        // Add results
        const resultEntries = Array.from(this.registry.results.values()).map(r => ({
            key: r.key,
            description: r.description,
        }));
        if (resultEntries.length > 0) {
            categories['Analysis Results'] = resultEntries;
        }

        return categories;
    }

    /**
     * Clear all error shortcuts
     */
    clearErrors(): void {
        this.registry.errors.clear();
        this.errorCounter = 0;
    }

    /**
     * Get recently accessed shortcuts
     */
    getRecent(limit: number = 10): FileShortcut[] {
        return Array.from(this.registry.files.values())
            .filter(f => f.lastAccessed)
            .sort((a, b) => (b.lastAccessed?.getTime() || 0) - (a.lastAccessed?.getTime() || 0))
            .slice(0, limit);
    }

    /**
     * Get most frequently used shortcuts
     */
    getFrequent(limit: number = 10): FileShortcut[] {
        return Array.from(this.registry.files.values())
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);
    }
}

// Export singleton instance
export const shortcuts = new ShortcutManager();

export default shortcuts;
