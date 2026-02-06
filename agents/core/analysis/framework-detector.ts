/**
 * Framework Detector
 * 
 * Detects the frontend framework used in a repository by analyzing:
 * - package.json dependencies
 * - Configuration files
 * - File structure patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrameworkInfo, FrameworkType, DependencyInfo } from './types.js';

// Framework detection patterns
const FRAMEWORK_PATTERNS: Record<FrameworkType, {
    packages: string[];
    configFiles: string[];
    markers: string[];
    isMetaFramework: boolean;
}> = {
    'next': {
        packages: ['next'],
        configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
        markers: ['pages/', 'app/', '.next/'],
        isMetaFramework: true,
    },
    'remix': {
        packages: ['@remix-run/react', '@remix-run/node'],
        configFiles: ['remix.config.js', 'remix.config.ts'],
        markers: ['app/routes/', 'app/root.tsx'],
        isMetaFramework: true,
    },
    'nuxt': {
        packages: ['nuxt', 'nuxt3'],
        configFiles: ['nuxt.config.js', 'nuxt.config.ts'],
        markers: ['pages/', '.nuxt/'],
        isMetaFramework: true,
    },
    'sveltekit': {
        packages: ['@sveltejs/kit'],
        configFiles: ['svelte.config.js'],
        markers: ['src/routes/', '.svelte-kit/'],
        isMetaFramework: true,
    },
    'astro': {
        packages: ['astro'],
        configFiles: ['astro.config.mjs', 'astro.config.ts'],
        markers: ['src/pages/', '.astro/'],
        isMetaFramework: true,
    },
    'react-vite': {
        packages: ['react', 'vite', '@vitejs/plugin-react'],
        configFiles: ['vite.config.js', 'vite.config.ts'],
        markers: [],
        isMetaFramework: false,
    },
    'react': {
        packages: ['react', 'react-dom'],
        configFiles: [],
        markers: ['src/App.jsx', 'src/App.tsx'],
        isMetaFramework: false,
    },
    'vue-vite': {
        packages: ['vue', 'vite', '@vitejs/plugin-vue'],
        configFiles: ['vite.config.js', 'vite.config.ts'],
        markers: [],
        isMetaFramework: false,
    },
    'vue': {
        packages: ['vue'],
        configFiles: ['vue.config.js'],
        markers: ['src/App.vue'],
        isMetaFramework: false,
    },
    'svelte': {
        packages: ['svelte'],
        configFiles: [],
        markers: ['src/App.svelte'],
        isMetaFramework: false,
    },
    'angular': {
        packages: ['@angular/core'],
        configFiles: ['angular.json'],
        markers: ['src/app/app.component.ts'],
        isMetaFramework: false,
    },
    'solid': {
        packages: ['solid-js'],
        configFiles: [],
        markers: [],
        isMetaFramework: false,
    },
    'unknown': {
        packages: [],
        configFiles: [],
        markers: [],
        isMetaFramework: false,
    },
};

// UI Library patterns
const UI_LIBRARY_PATTERNS: Record<string, string[]> = {
    'tailwindcss': ['tailwindcss', '@tailwindcss/forms'],
    'material-ui': ['@mui/material', '@material-ui/core'],
    'chakra-ui': ['@chakra-ui/react'],
    'ant-design': ['antd'],
    'shadcn': ['@radix-ui/react-dialog', 'class-variance-authority'],
    'mantine': ['@mantine/core'],
    'bootstrap': ['react-bootstrap', 'bootstrap'],
    'styled-components': ['styled-components'],
    'emotion': ['@emotion/react', '@emotion/styled'],
};

// State management patterns
const STATE_MANAGEMENT_PATTERNS: Record<string, string[]> = {
    'redux': ['redux', '@reduxjs/toolkit', 'react-redux'],
    'zustand': ['zustand'],
    'jotai': ['jotai'],
    'recoil': ['recoil'],
    'mobx': ['mobx', 'mobx-react'],
    'pinia': ['pinia'],
    'vuex': ['vuex'],
    'xstate': ['xstate', '@xstate/react'],
    'valtio': ['valtio'],
};

// Build tool patterns
const BUILD_TOOL_PATTERNS: Record<string, string[]> = {
    'vite': ['vite'],
    'webpack': ['webpack'],
    'esbuild': ['esbuild'],
    'rollup': ['rollup'],
    'parcel': ['parcel'],
    'turbopack': ['turbo'],
};

export class FrameworkDetector {
    private rootPath: string;
    private packageJson: Record<string, unknown> | null = null;
    private allDependencies: Record<string, string> = {};

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    /**
     * Load and parse package.json
     */
    private async loadPackageJson(): Promise<void> {
        const packageJsonPath = path.join(this.rootPath, 'package.json');

        try {
            const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
            this.packageJson = JSON.parse(content);

            // Merge dependencies and devDependencies
            this.allDependencies = {
                ...(this.packageJson?.dependencies as Record<string, string> || {}),
                ...(this.packageJson?.devDependencies as Record<string, string> || {}),
            };
        } catch {
            this.packageJson = null;
            this.allDependencies = {};
        }
    }

    /**
     * Check if a file or directory exists
     */
    private async exists(relativePath: string): Promise<boolean> {
        try {
            await fs.promises.access(path.join(this.rootPath, relativePath));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if a package is in dependencies
     */
    private hasPackage(packageName: string): boolean {
        return packageName in this.allDependencies;
    }

    /**
     * Get package version
     */
    private getPackageVersion(packageName: string): string | null {
        return this.allDependencies[packageName] || null;
    }

    /**
     * Detect the primary framework
     */
    private async detectFramework(): Promise<{ type: FrameworkType; confidence: number; version: string | null }> {
        // Check frameworks in priority order (meta-frameworks first)
        const priorityOrder: FrameworkType[] = [
            'next', 'remix', 'nuxt', 'sveltekit', 'astro',
            'react-vite', 'vue-vite', 'svelte', 'angular', 'solid',
            'react', 'vue',
        ];

        for (const framework of priorityOrder) {
            const pattern = FRAMEWORK_PATTERNS[framework];
            let score = 0;
            let maxScore = 0;

            // Check packages
            for (const pkg of pattern.packages) {
                maxScore += 2;
                if (this.hasPackage(pkg)) {
                    score += 2;
                }
            }

            // Check config files
            for (const configFile of pattern.configFiles) {
                maxScore += 3;
                if (await this.exists(configFile)) {
                    score += 3;
                }
            }

            // Check markers (directories/files)
            for (const marker of pattern.markers) {
                maxScore += 1;
                if (await this.exists(marker)) {
                    score += 1;
                }
            }

            if (maxScore > 0 && score > 0) {
                const confidence = score / maxScore;
                if (confidence >= 0.5) {
                    const mainPackage = pattern.packages[0];
                    return {
                        type: framework,
                        confidence,
                        version: mainPackage ? this.getPackageVersion(mainPackage) : null,
                    };
                }
            }
        }

        return { type: 'unknown', confidence: 0, version: null };
    }

    /**
     * Detect UI library
     */
    private detectUILibrary(): string | null {
        for (const [library, packages] of Object.entries(UI_LIBRARY_PATTERNS)) {
            if (packages.some(pkg => this.hasPackage(pkg))) {
                return library;
            }
        }
        return null;
    }

    /**
     * Detect state management
     */
    private detectStateManagement(): string | null {
        for (const [lib, packages] of Object.entries(STATE_MANAGEMENT_PATTERNS)) {
            if (packages.some(pkg => this.hasPackage(pkg))) {
                return lib;
            }
        }
        return null;
    }

    /**
     * Detect build tool
     */
    private detectBuildTool(): string | null {
        for (const [tool, packages] of Object.entries(BUILD_TOOL_PATTERNS)) {
            if (packages.some(pkg => this.hasPackage(pkg))) {
                return tool;
            }
        }
        return null;
    }

    /**
     * Check if TypeScript is used
     */
    private async detectTypeScript(): Promise<boolean> {
        return this.hasPackage('typescript') || await this.exists('tsconfig.json');
    }

    /**
     * Run the complete framework detection
     */
    async detect(): Promise<FrameworkInfo> {
        await this.loadPackageJson();

        const { type, confidence, version } = await this.detectFramework();
        const pattern = FRAMEWORK_PATTERNS[type];

        return {
            type,
            version,
            isMetaFramework: pattern.isMetaFramework,
            usesTypeScript: await this.detectTypeScript(),
            buildTool: this.detectBuildTool(),
            uiLibrary: this.detectUILibrary(),
            stateManagement: this.detectStateManagement(),
            confidence,
        };
    }

    /**
     * Get all dependencies with categorization
     */
    async getDependencies(): Promise<DependencyInfo[]> {
        await this.loadPackageJson();

        const dependencies: DependencyInfo[] = [];
        const deps = (this.packageJson?.dependencies as Record<string, string>) || {};
        const devDeps = (this.packageJson?.devDependencies as Record<string, string>) || {};

        const categorize = (name: string): DependencyInfo['category'] => {
            // Framework
            if (['react', 'vue', 'svelte', 'angular', 'solid-js', 'next', 'nuxt', 'astro'].some(f => name.includes(f))) {
                return 'framework';
            }
            // Auth
            if (['clerk', 'auth0', 'firebase', 'supabase', 'next-auth', 'passport'].some(a => name.includes(a))) {
                return 'auth';
            }
            // State management
            if (Object.values(STATE_MANAGEMENT_PATTERNS).flat().includes(name)) {
                return 'state-management';
            }
            // UI Library
            if (Object.values(UI_LIBRARY_PATTERNS).flat().includes(name)) {
                return 'ui-library';
            }
            // Data fetching
            if (['axios', 'swr', 'react-query', '@tanstack/react-query', 'trpc', 'apollo', 'urql'].some(d => name.includes(d))) {
                return 'data-fetching';
            }
            // Validation
            if (['zod', 'yup', 'joi', 'valibot', 'superstruct'].includes(name)) {
                return 'validation';
            }
            // Testing
            if (['jest', 'vitest', 'cypress', 'playwright', 'testing-library'].some(t => name.includes(t))) {
                return 'testing';
            }
            // Build tools
            if (Object.values(BUILD_TOOL_PATTERNS).flat().includes(name)) {
                return 'build-tool';
            }
            // Utility
            if (['lodash', 'date-fns', 'moment', 'uuid', 'classnames', 'clsx'].some(u => name.includes(u))) {
                return 'utility';
            }
            return 'other';
        };

        // Process regular dependencies
        for (const [name, version] of Object.entries(deps)) {
            dependencies.push({
                name,
                version,
                isDev: false,
                category: categorize(name),
            });
        }

        // Process dev dependencies
        for (const [name, version] of Object.entries(devDeps)) {
            dependencies.push({
                name,
                version,
                isDev: true,
                category: categorize(name),
            });
        }

        return dependencies;
    }
}

export default FrameworkDetector;
