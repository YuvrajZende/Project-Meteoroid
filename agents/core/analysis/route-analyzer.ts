/**
 * Route Analyzer
 * 
 * Analyzes frontend routing structure by detecting:
 * - Next.js pages/app directory routing
 * - React Router routes
 * - Vue Router configuration
 * - Protected/authenticated routes
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RouteInfo, FrameworkType } from './types.js';

// Route file patterns for different frameworks
const ROUTE_DIRECTORIES: Record<string, { pages: string[]; app: string[] }> = {
    next: { pages: ['pages', 'src/pages'], app: ['app', 'src/app'] },
    nuxt: { pages: ['pages'], app: [] },
    sveltekit: { pages: [], app: ['src/routes'] },
    astro: { pages: ['src/pages'], app: [] },
    remix: { pages: [], app: ['app/routes'] },
};

// Protected route indicators
const PROTECTED_PATTERNS = [
    /auth/i,
    /protected/i,
    /private/i,
    /dashboard/i,
    /admin/i,
    /settings/i,
    /profile/i,
    /account/i,
];

// Layout file patterns
const LAYOUT_PATTERNS = [
    /^layout\.(jsx?|tsx?)$/,
    /^_layout\.(jsx?|tsx?)$/,
    /^\+layout\.(svelte|js|ts)$/,
];

export class RouteAnalyzer {
    private rootPath: string;
    private frameworkType: FrameworkType;
    private routes: RouteInfo[] = [];

    constructor(rootPath: string, frameworkType: FrameworkType) {
        this.rootPath = rootPath;
        this.frameworkType = frameworkType;
    }

    /**
     * Check if a directory exists
     */
    private async directoryExists(dir: string): Promise<boolean> {
        try {
            const stat = await fs.promises.stat(dir);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Find the routing directory
     */
    private async findRoutingDirectory(): Promise<{ path: string; type: 'pages' | 'app' } | null> {
        // Get framework-specific directories
        const dirs = ROUTE_DIRECTORIES[this.frameworkType] || ROUTE_DIRECTORIES.next;

        // Check app directory first (newer pattern)
        for (const appDir of dirs.app) {
            const fullPath = path.join(this.rootPath, appDir);
            if (await this.directoryExists(fullPath)) {
                return { path: fullPath, type: 'app' };
            }
        }

        // Check pages directory
        for (const pagesDir of dirs.pages) {
            const fullPath = path.join(this.rootPath, pagesDir);
            if (await this.directoryExists(fullPath)) {
                return { path: fullPath, type: 'pages' };
            }
        }

        return null;
    }

    /**
     * Convert file path to route path
     */
    private fileToRoute(filePath: string, baseDir: string): string {
        let route = path.relative(baseDir, filePath);

        // Remove file extension
        route = route.replace(/\.(jsx?|tsx?|svelte|vue|astro)$/, '');

        // Handle index files
        route = route.replace(/\/index$/, '');
        route = route.replace(/^index$/, '');

        // Handle page files (Next.js app router)
        route = route.replace(/\/page$/, '');
        route = route.replace(/^page$/, '');

        // Handle route files (SvelteKit)
        route = route.replace(/\/\+page$/, '');
        route = route.replace(/^\+page$/, '');

        // Convert dynamic segments
        // [id] -> :id
        route = route.replace(/\[([^\]]+)\]/g, ':$1');
        // [...slug] -> *slug
        route = route.replace(/\[\.\.\.([^\]]+)\]/g, '*$1');
        // [[...slug]] -> *slug?
        route = route.replace(/\[\[\.\.\.([^\]]+)\]\]/g, '*$1?');

        // Ensure starts with /
        if (!route.startsWith('/')) {
            route = '/' + route;
        }

        // Handle root
        if (route === '/') return '/';

        // Remove trailing slash
        return route.replace(/\/$/, '');
    }

    /**
     * Check if a route is likely protected
     */
    private isProtectedRoute(routePath: string, fileContent?: string): boolean {
        // Check path patterns
        if (PROTECTED_PATTERNS.some(p => p.test(routePath))) {
            return true;
        }

        // Check file content for protection indicators
        if (fileContent) {
            const protectionIndicators = [
                /useAuth/,
                /useSession/,
                /requireAuth/,
                /withAuth/,
                /PrivateRoute/,
                /isAuthenticated/,
                /redirect.*login/i,
                /getServerSession/,
                /auth\(\)/,
            ];
            return protectionIndicators.some(p => p.test(fileContent));
        }

        return false;
    }

    /**
     * Extract path parameters from route
     */
    private extractParams(route: string): string[] {
        const params: string[] = [];

        // Match :param patterns
        const matches = route.matchAll(/:(\w+)/g);
        for (const match of matches) {
            params.push(match[1]);
        }

        return params;
    }

    /**
     * Find layout file in directory
     */
    private async findLayout(dir: string): Promise<string | undefined> {
        try {
            const entries = await fs.promises.readdir(dir);
            for (const entry of entries) {
                if (LAYOUT_PATTERNS.some(p => p.test(entry))) {
                    return path.relative(this.rootPath, path.join(dir, entry));
                }
            }
        } catch {
            // No layout found
        }
        return undefined;
    }

    /**
     * Recursively analyze routes from file system
     */
    private async analyzeDirectory(
        dir: string,
        baseDir: string,
        parentLayout?: string
    ): Promise<RouteInfo[]> {
        const routes: RouteInfo[] = [];
        const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.svelte', '.vue', '.astro'];
        const routeFilePatterns = [
            /^page\.(jsx?|tsx?)$/,          // Next.js app router
            /^\+page\.(svelte|js|ts)$/,      // SvelteKit
            /^index\.(jsx?|tsx?|vue)$/,      // Generic
            /^[^_+][^/]*\.(jsx?|tsx?)$/,     // Regular route files
        ];
        const excludeFiles = ['_app', '_document', '_error', 'layout', '+layout', '+error', '+server'];

        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            // Find layout for this directory
            const layoutFile = await this.findLayout(dir) || parentLayout;

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const basename = entry.name.replace(/\.(jsx?|tsx?|svelte|vue|astro)$/, '');

                if (entry.isDirectory()) {
                    // Skip special directories
                    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
                    if (['api', 'components', 'lib', 'utils', 'hooks'].includes(entry.name)) continue;

                    // Recurse into subdirectory
                    const childRoutes = await this.analyzeDirectory(fullPath, baseDir, layoutFile);
                    routes.push(...childRoutes);

                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (!validExtensions.includes(ext)) continue;
                    if (excludeFiles.includes(basename)) continue;

                    // Check if this is a route file
                    const isRouteFile = routeFilePatterns.some(p => p.test(entry.name));
                    if (!isRouteFile && !entry.name.match(/^[^_+][^/]*\.(jsx?|tsx?)$/)) continue;

                    // Read file content for protection detection
                    let content = '';
                    try {
                        content = await fs.promises.readFile(fullPath, 'utf-8');
                    } catch {
                        // Can't read file
                    }

                    const routePath = this.fileToRoute(fullPath, baseDir);
                    const params = this.extractParams(routePath);

                    routes.push({
                        path: routePath,
                        isDynamic: params.length > 0,
                        params,
                        componentFile: path.relative(this.rootPath, fullPath),
                        isProtected: this.isProtectedRoute(routePath, content),
                        layoutFile,
                    });
                }
            }
        } catch {
            // Skip unreadable directories
        }

        return routes;
    }

    /**
     * Analyze React Router configuration
     */
    private async analyzeReactRouter(): Promise<RouteInfo[]> {
        const routes: RouteInfo[] = [];

        // Find files that might contain route definitions
        const routerFiles = await this.findFilesWithPattern(
            this.rootPath,
            [/Routes/, /createBrowserRouter/, /createRoutesFromElements/]
        );

        for (const file of routerFiles) {
            try {
                const content = await fs.promises.readFile(file, 'utf-8');

                // Extract route patterns from JSX
                // <Route path="/users" element={<Users />} />
                const routePattern = /<Route[^>]*path=["']([^"']+)["'][^>]*>/g;
                let match;

                while ((match = routePattern.exec(content)) !== null) {
                    const routePath = match[1];
                    const params = this.extractParams(routePath);

                    routes.push({
                        path: routePath,
                        isDynamic: params.length > 0,
                        params,
                        componentFile: path.relative(this.rootPath, file),
                        isProtected: this.isProtectedRoute(routePath),
                    });
                }

                // Extract from createBrowserRouter array
                // { path: '/users', element: <Users /> }
                const objectPattern = /path:\s*["']([^"']+)["']/g;
                while ((match = objectPattern.exec(content)) !== null) {
                    const routePath = match[1];
                    if (!routes.some(r => r.path === routePath)) {
                        const params = this.extractParams(routePath);
                        routes.push({
                            path: routePath,
                            isDynamic: params.length > 0,
                            params,
                            componentFile: path.relative(this.rootPath, file),
                            isProtected: this.isProtectedRoute(routePath),
                        });
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }

        return routes;
    }

    /**
     * Find files containing specific patterns
     */
    private async findFilesWithPattern(dir: string, patterns: RegExp[]): Promise<string[]> {
        const files: string[] = [];
        const extensions = ['.js', '.jsx', '.ts', '.tsx'];
        const excludeDirs = ['node_modules', '.git', 'dist', 'build'];

        const search = async (searchDir: string) => {
            try {
                const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(searchDir, entry.name);

                    if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
                        await search(fullPath);
                    } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
                        try {
                            const content = await fs.promises.readFile(fullPath, 'utf-8');
                            if (patterns.some(p => p.test(content))) {
                                files.push(fullPath);
                            }
                        } catch {
                            // Skip
                        }
                    }
                }
            } catch {
                // Skip
            }
        };

        await search(dir);
        return files;
    }

    /**
     * Run the complete route analysis
     */
    async analyze(): Promise<RouteInfo[]> {
        // Try file-system based routing first
        const routingDir = await this.findRoutingDirectory();

        if (routingDir) {
            this.routes = await this.analyzeDirectory(routingDir.path, routingDir.path);
        }

        // If no routes found, try React Router patterns
        if (this.routes.length === 0) {
            this.routes = await this.analyzeReactRouter();
        }

        // Deduplicate and sort
        const uniqueRoutes = new Map<string, RouteInfo>();
        for (const route of this.routes) {
            const key = route.path;
            if (!uniqueRoutes.has(key) || route.isProtected) {
                uniqueRoutes.set(key, route);
            }
        }

        this.routes = Array.from(uniqueRoutes.values())
            .sort((a, b) => a.path.localeCompare(b.path));

        return this.routes;
    }
}

export default RouteAnalyzer;
