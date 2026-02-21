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

    // NestJS Framework (CG-007)
    { packageName: '@nestjs/core', version: '^10.3.0', isDev: false, importPatterns: [] },
    { packageName: '@nestjs/common', version: '^10.3.0', isDev: false, importPatterns: ['@Module', '@Controller', '@Injectable', '@Get', '@Post', '@Put', '@Delete', '@Patch', '@Body', '@Param', '@Query'] },
    { packageName: '@nestjs/platform-express', version: '^10.3.0', isDev: false, importPatterns: [] },
    { packageName: '@nestjs/config', version: '^3.1.1', isDev: false, importPatterns: ['ConfigModule', 'ConfigService'] },
    { packageName: '@nestjs/mongoose', version: '^10.0.2', isDev: false, importPatterns: ['@Schema', '@Prop', 'SchemaFactory', 'MongooseModule'] },
    { packageName: '@nestjs/jwt', version: '^10.2.0', isDev: false, importPatterns: ['JwtModule', 'JwtService'] },
    { packageName: '@nestjs/passport', version: '^10.0.3', isDev: false, importPatterns: ['PassportModule'] },
    { packageName: '@nestjs/throttler', version: '^5.1.1', isDev: false, importPatterns: ['ThrottlerModule', '@Throttle'] },
    { packageName: '@nestjs/swagger', version: '^7.2.0', isDev: false, importPatterns: ['@ApiTags', '@ApiOperation', '@ApiResponse', 'DocumentBuilder'] },
    { packageName: 'mongoose', version: '^8.0.0', isDev: false, importPatterns: ['mongoose', 'Schema', 'Types', 'Model', 'Document'] },
    { packageName: 'reflect-metadata', version: '^0.2.0', isDev: false, importPatterns: [] },
    { packageName: 'rxjs', version: '^7.8.0', isDev: false, importPatterns: [] },
    { packageName: 'class-validator', version: '^0.14.0', isDev: false, importPatterns: ['@IsString', '@IsNumber', '@IsBoolean', '@IsEmail', '@IsOptional', '@IsNotEmpty', '@Min', '@Max'] },
    { packageName: 'class-transformer', version: '^0.5.1', isDev: false, importPatterns: ['@Type', '@Exclude', '@Expose', 'plainToClass'] },

    // TypeORM (alternative ORM)
    { packageName: 'typeorm', version: '^0.3.20', isDev: false, importPatterns: ['@Entity', '@Column', '@PrimaryGeneratedColumn', '@OneToMany', '@ManyToOne'] },
    { packageName: '@nestjs/typeorm', version: '^10.0.1', isDev: false, importPatterns: ['TypeOrmModule'] },

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
    { packageName: 'passport', version: '^0.7.0', isDev: false, importPatterns: ['passport'] },
    { packageName: 'passport-jwt', version: '^4.0.1', isDev: false, importPatterns: ['passport-jwt', 'JwtStrategy'] },
    { packageName: 'passport-local', version: '^1.0.0', isDev: false, importPatterns: ['passport-local', 'LocalStrategy'] },

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
    { packageName: '@nestjs/cli', version: '^10.3.0', isDev: true, importPatterns: [] },
    { packageName: '@types/express', version: '^4.17.21', isDev: true, importPatterns: [] },

    // Testing
    { packageName: 'jest', version: '^29.7.0', isDev: true, importPatterns: ['jest', 'describe', 'expect'] },
    { packageName: '@types/jest', version: '^29.5.14', isDev: true, importPatterns: [] },
    { packageName: '@nestjs/testing', version: '^10.3.0', isDev: true, importPatterns: [] },
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

        const framework = this.detectFramework(code);
        if (framework === 'nestjs') {
            const nestjsDeps = [
                '@nestjs/core', '@nestjs/common', '@nestjs/platform-express',
                'reflect-metadata', 'rxjs'
            ];
            for (const dep of nestjsDeps) {
                const mapping = DEPENDENCY_MAPPINGS.find(m => m.packageName === dep);
                if (mapping) {
                    detected.push(dep);
                    this.registerDependency(dep, mapping.version, mapping.isDev, filePath);
                }
            }
            if (code.includes('@Schema') || code.includes('@Prop') || code.includes('SchemaFactory') || code.includes('MongooseModule')) {
                const mongooseDeps = ['@nestjs/mongoose', 'mongoose'];
                for (const dep of mongooseDeps) {
                    const mapping = DEPENDENCY_MAPPINGS.find(m => m.packageName === dep);
                    if (mapping) {
                        detected.push(dep);
                        this.registerDependency(dep, mapping.version, mapping.isDev, filePath);
                    }
                }
            }
            if (code.includes('ConfigModule') || code.includes('ConfigService')) {
                const mapping = DEPENDENCY_MAPPINGS.find(m => m.packageName === '@nestjs/config');
                if (mapping) {
                    detected.push('@nestjs/config');
                    this.registerDependency('@nestjs/config', mapping.version, mapping.isDev, filePath);
                }
            }
            if (code.includes('@IsString') || code.includes('@IsNumber') || code.includes('@IsEmail') || code.includes('@IsOptional')) {
                const validatorDeps = ['class-validator', 'class-transformer'];
                for (const dep of validatorDeps) {
                    const mapping = DEPENDENCY_MAPPINGS.find(m => m.packageName === dep);
                    if (mapping) {
                        detected.push(dep);
                        this.registerDependency(dep, mapping.version, mapping.isDev, filePath);
                    }
                }
            }
        }

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
     * Detect framework from code content (CG-007)
     */
    detectFramework(code: string): 'nestjs' | 'fastify' | 'express' | 'typeorm' | 'unknown' {
        if (code.includes('@Module') || code.includes('@Controller') || code.includes('@Injectable')) {
            return 'nestjs';
        }
        if (code.includes('@Schema') || code.includes('SchemaFactory') || code.includes('MongooseModule')) {
            return 'nestjs';
        }
        if (code.includes('NestFactory') || code.includes('@nestjs/')) {
            return 'nestjs';
        }
        if (code.includes('@Entity') || code.includes('@Column') || code.includes('TypeOrmModule')) {
            return 'typeorm';
        }
        if (code.includes('FastifyInstance') || code.includes("from 'fastify'")) {
            return 'fastify';
        }
        if (code.includes("from 'express'") || code.includes('express.Router') || code.includes('Router()')) {
            return 'express';
        }
        return 'unknown';
    }

    /**
     * Analyze multiple files and aggregate dependencies
     */
    analyzeProject(files: Map<string, string>): DependencyAnalysis {
        const allDetected = new Set<string>();
        let detectedFramework: string = 'unknown';

        for (const [path, content] of files.entries()) {
            const detected = this.analyzeCode(content, path);
            detected.forEach(d => allDetected.add(d));
            
            const framework = this.detectFramework(content);
            if (framework !== 'unknown') {
                detectedFramework = framework;
            }
        }

        if (detectedFramework === 'nestjs') {
            const nestjsBaseDeps = [
                '@nestjs/core', '@nestjs/common', '@nestjs/platform-express',
                '@nestjs/config', 'reflect-metadata', 'rxjs',
                'typescript', '@types/node', '@nestjs/cli'
            ];
            nestjsBaseDeps.forEach(d => {
                const mapping = DEPENDENCY_MAPPINGS.find(m => m.packageName === d);
                if (mapping) {
                    this.registerDependency(mapping.packageName, mapping.version, mapping.isDev, 'nestjs-base');
                }
            });
        } else {
            const baseDeps = ['typescript', '@types/node', 'tsx', 'dotenv'];
            baseDeps.forEach(d => {
                const mapping = DEPENDENCY_MAPPINGS.find(m => m.packageName === d);
                if (mapping) {
                    this.registerDependency(mapping.packageName, mapping.version, mapping.isDev, 'base');
                }
            });
        }

        console.log(`[DEPENDENCY-REGISTRY] Detected framework: ${detectedFramework}`);

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

        if (detected.includes('@nestjs/core') && !detected.includes('@nestjs/config')) {
            recommendations.push({
                packageName: '@nestjs/config',
                reason: 'Configuration management for NestJS',
                priority: 'recommended',
            });
        }

        if (detected.includes('@nestjs/mongoose') && !detected.includes('@nestjs/swagger')) {
            recommendations.push({
                packageName: '@nestjs/swagger',
                reason: 'Auto-generated API documentation',
                priority: 'optional',
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

        // Merge with existing - EXISTING TAKES PRIORITY
        if (existingPackageJson?.dependencies) {
            Object.assign(dependencies, existingPackageJson.dependencies);
        }
        if (existingPackageJson?.devDependencies) {
            Object.assign(devDependencies, existingPackageJson.devDependencies);
        }

        return {
            name: existingPackageJson?.name || projectName.toLowerCase().replace(/\s+/g, '-'),
            version: existingPackageJson?.version || '1.0.0',
            type: existingPackageJson?.type || 'module',
            main: existingPackageJson?.main || 'dist/index.js',
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
     * Merge detected dependencies with an existing package.json string
     * This preserves AI-generated package.json while adding any missing detected deps
     */
    mergeWithExistingPackageJson(existingPackageJsonContent: string, projectName: string): string {
        try {
            const existingPkg = JSON.parse(existingPackageJsonContent) as Partial<PackageJson>;

            // Create new deps maps starting with existing
            const mergedDeps: Record<string, string> = { ...(existingPkg.dependencies || {}) };
            const mergedDevDeps: Record<string, string> = { ...(existingPkg.devDependencies || {}) };

            // Add detected deps that are NOT already in existing (existing takes priority)
            for (const [name, info] of this.detectedDependencies.entries()) {
                if (info.isDev) {
                    if (!mergedDevDeps[name]) {
                        mergedDevDeps[name] = info.version;
                    }
                } else {
                    if (!mergedDeps[name]) {
                        mergedDeps[name] = info.version;
                    }
                }
            }

            // Build merged package.json preserving original structure
            const merged: PackageJson = {
                name: existingPkg.name || projectName.toLowerCase().replace(/\s+/g, '-'),
                version: existingPkg.version || '1.0.0',
                type: existingPkg.type,
                main: existingPkg.main,
                scripts: existingPkg.scripts || {
                    'dev': 'tsx watch src/index.ts',
                    'build': 'tsc',
                    'start': 'node dist/index.js',
                },
                dependencies: this.sortObject(mergedDeps),
                devDependencies: this.sortObject(mergedDevDeps),
            };

            console.log(`[DEPENDENCY-REGISTRY] Merged: ${Object.keys(mergedDeps).length} deps, ${Object.keys(mergedDevDeps).length} devDeps`);
            return JSON.stringify(merged, null, 2);
        } catch (e) {
            console.warn('[DEPENDENCY-REGISTRY] Failed to parse existing package.json, generating new one');
            return JSON.stringify(this.generatePackageJson(projectName), null, 2);
        }
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
