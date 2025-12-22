/**
 * Dependency Registry Service (Phase 26.1)
 * 
 * CRITICAL FIX: Addresses 100% project failure rate due to missing dependencies
 * 
 * This service tracks all imports across generated files and ensures package.json
 * contains all required dependencies with correct versions.
 */

// ============================================
// TYPES
// ============================================

export interface DependencyMapping {
    packageName: string;
    version: string;
    isDev: boolean;
    importPatterns: string[];
}

export interface PackageJson {
    name: string;
    version: string;
    type?: string;
    main?: string;
    scripts?: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
}

export interface DependencyAnalysis {
    detected: string[];
    missing: string[];
    unused: string[];
    recommendations: DependencyRecommendation[];
}

export interface DependencyRecommendation {
    packageName: string;
    reason: string;
    priority: 'required' | 'recommended' | 'optional';
}

export interface DependencyRegistryConfig {
    enableAutoFix: boolean;
    enableVersionPinning: boolean;
    defaultNodeVersion: string;
}

// ============================================
// DEPENDENCY MAPPINGS DATABASE
// ============================================

const DEPENDENCY_MAPPINGS: DependencyMapping[] = [
    // Core Framework
    { packageName: 'fastify', version: '^5.1.0', isDev: false, importPatterns: ['fastify', 'FastifyInstance'] },
    { packageName: 'express', version: '^4.18.2', isDev: false, importPatterns: ['express'] },

    // Fastify Plugins
    { packageName: '@fastify/cors', version: '^10.0.1', isDev: false, importPatterns: ['@fastify/cors'] },
    { packageName: '@fastify/jwt', version: '^9.0.1', isDev: false, importPatterns: ['@fastify/jwt'] },
    { packageName: '@fastify/helmet', version: '^12.0.1', isDev: false, importPatterns: ['@fastify/helmet'] },
    { packageName: '@fastify/rate-limit', version: '^10.0.1', isDev: false, importPatterns: ['@fastify/rate-limit'] },
    { packageName: '@fastify/websocket', version: '^11.0.1', isDev: false, importPatterns: ['@fastify/websocket'] },
    { packageName: '@fastify/multipart', version: '^9.0.1', isDev: false, importPatterns: ['@fastify/multipart'] },

    // Database
    { packageName: '@prisma/client', version: '^5.22.0', isDev: false, importPatterns: ['@prisma/client', 'PrismaClient'] },
    { packageName: 'prisma', version: '^5.22.0', isDev: true, importPatterns: [] },
    { packageName: '@supabase/supabase-js', version: '^2.47.10', isDev: false, importPatterns: ['@supabase/supabase-js'] },

    // Authentication
    { packageName: 'bcrypt', version: '^5.1.1', isDev: false, importPatterns: ['bcrypt'] },
    { packageName: '@types/bcrypt', version: '^5.0.2', isDev: true, importPatterns: [] },
    { packageName: 'jsonwebtoken', version: '^9.0.2', isDev: false, importPatterns: ['jsonwebtoken'] },

    // Validation
    { packageName: 'zod', version: '^3.23.8', isDev: false, importPatterns: ['zod'] },

    // Utilities
    { packageName: 'uuid', version: '^10.0.0', isDev: false, importPatterns: ['uuid'] },
    { packageName: '@types/uuid', version: '^10.0.0', isDev: true, importPatterns: [] },
    { packageName: 'dotenv', version: '^16.4.5', isDev: false, importPatterns: ['dotenv'] },
    { packageName: 'axios', version: '^1.7.9', isDev: false, importPatterns: ['axios'] },

    // TypeScript
    { packageName: 'typescript', version: '^5.7.2', isDev: true, importPatterns: [] },
    { packageName: '@types/node', version: '^22.10.2', isDev: true, importPatterns: [] },
    { packageName: 'tsx', version: '^4.19.2', isDev: true, importPatterns: [] },

    // Testing
    { packageName: 'jest', version: '^29.7.0', isDev: true, importPatterns: ['jest', 'describe', 'expect'] },
    { packageName: '@types/jest', version: '^29.5.14', isDev: true, importPatterns: [] },
];

// ============================================
// DEPENDENCY REGISTRY CLASS
// ============================================

export class DependencyRegistry {
    private detectedDependencies = new Map<string, { version: string; isDev: boolean; source: string }>();
    private isInitialized = false;
    private _config: DependencyRegistryConfig;

    constructor(config?: Partial<DependencyRegistryConfig>) {
        this._config = {
            enableAutoFix: config?.enableAutoFix ?? true,
            enableVersionPinning: config?.enableVersionPinning ?? false,
            defaultNodeVersion: config?.defaultNodeVersion ?? '18',
        };
    }

    get config(): DependencyRegistryConfig {
        return this._config;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;
        console.log('[DEPENDENCY-REGISTRY] Initialized');
    }

    /**
     * Analyze code content and detect required dependencies
     */
    analyzeCode(code: string, filePath: string): string[] {
        const detected: string[] = [];

        for (const mapping of DEPENDENCY_MAPPINGS) {
            for (const pattern of mapping.importPatterns) {
                if (code.includes(pattern)) {
                    detected.push(mapping.packageName);
                    this.registerDependency(mapping.packageName, mapping.version, mapping.isDev, filePath);
                    break;
                }
            }
        }

        return [...new Set(detected)];
    }

    /**
     * Analyze multiple files and aggregate dependencies
     */
    analyzeProject(files: Map<string, string>): DependencyAnalysis {
        const allDetected = new Set<string>();

        for (const [path, content] of files.entries()) {
            const detected = this.analyzeCode(content, path);
            detected.forEach(d => allDetected.add(d));
        }

        // Always include base dependencies for TypeScript
        const baseDeps = ['typescript', '@types/node', 'tsx', 'dotenv'];
        baseDeps.forEach(d => {
            const mapping = DEPENDENCY_MAPPINGS.find(m => m.packageName === d);
            if (mapping) {
                this.registerDependency(mapping.packageName, mapping.version, mapping.isDev, 'base');
            }
        });

        return {
            detected: Array.from(allDetected),
            missing: [],
            unused: [],
            recommendations: this.getRecommendations(),
        };
    }

    /**
     * Register a dependency
     */
    registerDependency(packageName: string, version: string, isDev: boolean, source: string): void {
        if (!this.detectedDependencies.has(packageName)) {
            this.detectedDependencies.set(packageName, { version, isDev, source });
        }
    }

    /**
     * Get recommendations based on detected dependencies
     */
    private getRecommendations(): DependencyRecommendation[] {
        const recommendations: DependencyRecommendation[] = [];
        const detected = Array.from(this.detectedDependencies.keys());

        if (detected.includes('fastify') && !detected.includes('@fastify/helmet')) {
            recommendations.push({
                packageName: '@fastify/helmet',
                reason: 'Security headers for production',
                priority: 'required',
            });
        }

        if (detected.includes('fastify') && !detected.includes('@fastify/cors')) {
            recommendations.push({
                packageName: '@fastify/cors',
                reason: 'CORS support for APIs',
                priority: 'required',
            });
        }

        return recommendations;
    }

    /**
     * Generate a complete package.json
     */
    generatePackageJson(projectName: string, existingPackageJson?: Partial<PackageJson>): PackageJson {
        const dependencies: Record<string, string> = {};
        const devDependencies: Record<string, string> = {};

        for (const [name, info] of this.detectedDependencies.entries()) {
            if (info.isDev) {
                devDependencies[name] = info.version;
            } else {
                dependencies[name] = info.version;
            }
        }

        // Merge with existing
        if (existingPackageJson?.dependencies) {
            Object.assign(dependencies, existingPackageJson.dependencies);
        }
        if (existingPackageJson?.devDependencies) {
            Object.assign(devDependencies, existingPackageJson.devDependencies);
        }

        return {
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            type: 'module',
            main: 'dist/index.js',
            scripts: {
                'dev': 'tsx watch src/index.ts',
                'build': 'tsc',
                'start': 'node dist/index.js',
                'test': 'jest',
                'lint': 'eslint src --ext .ts',
                'type-check': 'tsc --noEmit',
                ...(existingPackageJson?.scripts || {}),
            },
            dependencies: this.sortObject(dependencies),
            devDependencies: this.sortObject(devDependencies),
        };
    }

    /**
     * Clear the registry
     */
    clear(): void {
        this.detectedDependencies.clear();
    }

    /**
     * Get all detected dependencies
     */
    getDependencies(): Map<string, { version: string; isDev: boolean; source: string }> {
        return new Map(this.detectedDependencies);
    }

    /**
     * Get status
     */
    getStatus(): { initialized: boolean; dependencyCount: number } {
        return {
            initialized: this.isInitialized,
            dependencyCount: this.detectedDependencies.size,
        };
    }

    private sortObject(obj: Record<string, string>): Record<string, string> {
        return Object.keys(obj)
            .sort()
            .reduce((sorted, key) => {
                sorted[key] = obj[key];
                return sorted;
            }, {} as Record<string, string>);
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let dependencyRegistryInstance: DependencyRegistry | null = null;

export function getDependencyRegistry(): DependencyRegistry {
    if (!dependencyRegistryInstance) {
        dependencyRegistryInstance = new DependencyRegistry();
    }
    return dependencyRegistryInstance;
}

export function createDependencyRegistry(config?: Partial<DependencyRegistryConfig>): DependencyRegistry {
    dependencyRegistryInstance = new DependencyRegistry(config);
    return dependencyRegistryInstance;
}
