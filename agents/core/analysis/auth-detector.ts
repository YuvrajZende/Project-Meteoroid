/**
 * Auth Strategy Detector
 * 
 * Detects the authentication strategy used in a frontend repository by analyzing:
 * - Package dependencies (Clerk, Auth0, Firebase, etc.)
 * - Import statements and hook usage
 * - Protected route patterns
 * - Token storage patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DetectedAuthStrategy, AuthProviderType } from './types.js';

// Auth provider detection patterns
const AUTH_PROVIDER_PATTERNS: Record<AuthProviderType, {
    packages: string[];
    imports: RegExp[];
    hooks: string[];
    files: string[];
}> = {
    'clerk': {
        packages: ['@clerk/nextjs', '@clerk/clerk-react', '@clerk/clerk-js'],
        imports: [/@clerk\//, /ClerkProvider/, /useAuth/, /useUser/, /SignIn/, /SignUp/],
        hooks: ['useAuth', 'useUser', 'useClerk', 'useSession', 'useSignIn', 'useSignUp'],
        files: ['middleware.ts', 'middleware.js'],
    },
    'auth0': {
        packages: ['@auth0/auth0-react', '@auth0/nextjs-auth0', 'auth0-js'],
        imports: [/@auth0\//, /Auth0Provider/, /useAuth0/],
        hooks: ['useAuth0', 'withAuthenticationRequired'],
        files: ['auth0.config.js', 'auth0.config.ts'],
    },
    'firebase': {
        packages: ['firebase', 'firebase-admin', '@firebase/auth'],
        imports: [/firebase\/auth/, /getAuth/, /signInWith/, /onAuthStateChanged/],
        hooks: ['onAuthStateChanged', 'useAuthState'],
        files: ['firebase.config.js', 'firebase.config.ts', 'firebaseConfig.js'],
    },
    'supabase': {
        packages: ['@supabase/supabase-js', '@supabase/auth-helpers-react', '@supabase/auth-helpers-nextjs'],
        imports: [/@supabase\//, /createClient/, /supabase\.auth/],
        hooks: ['useSupabaseClient', 'useSession', 'useUser'],
        files: ['supabase.ts', 'supabase.js', 'supabaseClient.ts'],
    },
    'nextauth': {
        packages: ['next-auth', '@auth/core'],
        imports: [/next-auth/, /NextAuth/, /useSession/, /signIn/, /signOut/],
        hooks: ['useSession', 'getSession', 'getServerSession'],
        files: ['[...nextauth].ts', '[...nextauth].js', 'auth.ts', 'auth.config.ts'],
    },
    'passport': {
        packages: ['passport', 'passport-local', 'passport-jwt'],
        imports: [/passport/],
        hooks: [],
        files: ['passport.config.js', 'passport.config.ts'],
    },
    'custom-jwt': {
        packages: ['jsonwebtoken', 'jose'],
        imports: [/jsonwebtoken/, /jose/, /jwt\.sign/, /jwt\.verify/],
        hooks: [],
        files: [],
    },
    'session-based': {
        packages: ['express-session', 'cookie-session'],
        imports: [/express-session/, /cookie-session/],
        hooks: [],
        files: [],
    },
    'none': {
        packages: [],
        imports: [],
        hooks: [],
        files: [],
    },
    'unknown': {
        packages: [],
        imports: [],
        hooks: [],
        files: [],
    },
};

// Protected route patterns
const PROTECTED_ROUTE_PATTERNS = [
    // Next.js middleware pattern
    /export\s+(?:default\s+)?function\s+middleware/,
    // withAuth patterns
    /withAuth\s*\(/,
    /withAuthenticationRequired/,
    // Route protection in React Router
    /PrivateRoute/,
    /ProtectedRoute/,
    /AuthenticatedRoute/,
    // Redirect patterns
    /!isAuthenticated.*redirect/i,
    /!session.*redirect/i,
    /if\s*\(\s*!user\s*\)/,
];

// Token storage patterns
const TOKEN_STORAGE_PATTERNS = {
    cookie: [
        /document\.cookie/,
        /Cookies\.(get|set)/,
        /js-cookie/,
        /cookie-universal/,
        /nookies/,
    ],
    localStorage: [
        /localStorage\.(get|set)Item/,
        /window\.localStorage/,
    ],
    sessionStorage: [
        /sessionStorage\.(get|set)Item/,
        /window\.sessionStorage/,
    ],
};

export class AuthDetector {
    private rootPath: string;
    private packageJson: Record<string, unknown> | null = null;
    private allDependencies: Record<string, string> = {};

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    /**
     * Load package.json
     */
    private async loadPackageJson(): Promise<void> {
        const packageJsonPath = path.join(this.rootPath, 'package.json');

        try {
            const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
            this.packageJson = JSON.parse(content);
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
     * Check if a package exists
     */
    private hasPackage(packageName: string): boolean {
        return packageName in this.allDependencies;
    }

    /**
     * Get package version
     */
    private getPackageVersion(packageName: string): string | undefined {
        return this.allDependencies[packageName];
    }

    /**
     * Find all source files
     */
    private async findSourceFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const extensions = ['.js', '.jsx', '.ts', '.tsx'];
        const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
                    files.push(...await this.findSourceFiles(fullPath));
                } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
                    files.push(fullPath);
                }
            }
        } catch {
            // Skip unreadable directories
        }

        return files;
    }

    /**
     * Detect auth provider from packages
     */
    private detectProviderFromPackages(): { provider: AuthProviderType; packageName?: string; version?: string } {
        for (const [provider, config] of Object.entries(AUTH_PROVIDER_PATTERNS)) {
            for (const pkg of config.packages) {
                if (this.hasPackage(pkg)) {
                    return {
                        provider: provider as AuthProviderType,
                        packageName: pkg,
                        version: this.getPackageVersion(pkg),
                    };
                }
            }
        }
        return { provider: 'none' };
    }

    /**
     * Detect auth hooks used in codebase
     */
    private async detectAuthHooks(files: string[]): Promise<string[]> {
        const foundHooks: Set<string> = new Set();

        const allHooks = Object.values(AUTH_PROVIDER_PATTERNS)
            .flatMap(p => p.hooks);

        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf-8');
                for (const hook of allHooks) {
                    if (content.includes(hook)) {
                        foundHooks.add(hook);
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }

        return Array.from(foundHooks);
    }

    /**
     * Find auth-related files
     */
    private async findAuthFiles(): Promise<string[]> {
        const authFiles: string[] = [];
        const authPatterns = [
            /auth/i,
            /login/i,
            /signin/i,
            /signup/i,
            /register/i,
            /middleware/i,
        ];

        const files = await this.findSourceFiles(this.rootPath);

        for (const file of files) {
            const basename = path.basename(file);
            if (authPatterns.some(p => p.test(basename))) {
                authFiles.push(path.relative(this.rootPath, file));
            }
        }

        return authFiles;
    }

    /**
     * Detect protected routes
     */
    private async detectProtectedRoutes(files: string[]): Promise<string[]> {
        const protectedRoutes: string[] = [];

        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf-8');

                // Check for protection patterns
                if (PROTECTED_ROUTE_PATTERNS.some(p => p.test(content))) {
                    // Try to extract route path from file location
                    const relativePath = path.relative(this.rootPath, file);

                    // Convert file path to route (Next.js/Nuxt style)
                    if (relativePath.includes('pages/') || relativePath.includes('app/')) {
                        let route = relativePath
                            .replace(/^(pages|app)/, '')
                            .replace(/\.(jsx?|tsx?)$/, '')
                            .replace(/\/index$/, '')
                            .replace(/\[([^\]]+)\]/g, ':$1');

                        if (!route.startsWith('/')) route = '/' + route;
                        protectedRoutes.push(route);
                    } else {
                        protectedRoutes.push(relativePath);
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }

        return [...new Set(protectedRoutes)];
    }

    /**
     * Detect authentication features
     */
    private async detectFeatures(files: string[]): Promise<DetectedAuthStrategy['features']> {
        const features = {
            socialLogin: false,
            emailPassword: false,
            magicLink: false,
            phoneAuth: false,
            mfa: false,
            sso: false,
        };

        const patterns = {
            socialLogin: [/signInWith(Google|GitHub|Facebook|Twitter|Apple)/i, /oauth/i, /social/i],
            emailPassword: [/signInWithEmailAndPassword/i, /email.*password/i, /login.*email/i],
            magicLink: [/magicLink/i, /signInWithEmailLink/i, /passwordless/i],
            phoneAuth: [/phone/i, /sms/i, /signInWithPhoneNumber/i],
            mfa: [/mfa/i, /two-?factor/i, /2fa/i, /totp/i],
            sso: [/sso/i, /saml/i, /enterprise/i],
        };

        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf-8');

                for (const [feature, patternList] of Object.entries(patterns)) {
                    if (patternList.some(p => p.test(content))) {
                        features[feature as keyof typeof features] = true;
                    }
                }
            } catch {
                // Skip
            }
        }

        return features;
    }

    /**
     * Detect token storage method
     */
    private async detectTokenStorage(files: string[]): Promise<DetectedAuthStrategy['tokenStorage']> {
        const scores = {
            cookie: 0,
            localStorage: 0,
            sessionStorage: 0,
        };

        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf-8');

                for (const [storage, patterns] of Object.entries(TOKEN_STORAGE_PATTERNS)) {
                    if (patterns.some(p => typeof p === 'string' ? content.includes(p) : p.test(content))) {
                        scores[storage as keyof typeof scores]++;
                    }
                }
            } catch {
                // Skip
            }
        }

        const maxScore = Math.max(...Object.values(scores));
        if (maxScore === 0) return 'unknown';

        return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] as DetectedAuthStrategy['tokenStorage'] || 'unknown';
    }

    /**
     * Run the complete auth detection
     */
    async detect(): Promise<DetectedAuthStrategy> {
        await this.loadPackageJson();

        const files = await this.findSourceFiles(this.rootPath);
        const { provider, packageName, version } = this.detectProviderFromPackages();

        const [authHooks, authFiles, protectedRoutes, features, tokenStorage] = await Promise.all([
            this.detectAuthHooks(files),
            this.findAuthFiles(),
            this.detectProtectedRoutes(files),
            this.detectFeatures(files),
            this.detectTokenStorage(files),
        ]);

        // Calculate confidence based on signals found
        let confidence = 0;
        if (provider !== 'none' && provider !== 'unknown') confidence += 0.4;
        if (authHooks.length > 0) confidence += 0.2;
        if (authFiles.length > 0) confidence += 0.2;
        if (protectedRoutes.length > 0) confidence += 0.1;
        if (Object.values(features).some(Boolean)) confidence += 0.1;

        return {
            provider,
            packageName,
            version,
            features,
            protectedRoutes,
            authFiles,
            authHooks,
            tokenStorage,
            confidence: Math.min(confidence, 1),
        };
    }
}

export default AuthDetector;
