/**
 * ============================================
 * LANGUAGE CONFIGURATIONS
 * ============================================
 * 
 * Configurations for multi-language code generation:
 * - TypeScript (npm)
 * - Python (pip/poetry)
 * - Go (go mod)
 * - Rust (cargo)
 * - Java (maven/gradle)
 */

// ============================================
// TYPES
// ============================================

export type SupportedLanguage = 'typescript' | 'python' | 'go' | 'rust' | 'java';

export type SupportedFramework =
    // TypeScript
    | 'express' | 'fastify' | 'nestjs' | 'nextjs'
    // Python
    | 'fastapi' | 'django' | 'flask'
    // Go
    | 'gin' | 'echo' | 'fiber'
    // Rust
    | 'actix' | 'rocket' | 'axum'
    // Java
    | 'spring' | 'quarkus' | 'micronaut';

export interface LanguageConfig {
    name: string;
    extensions: string[];
    packageManager: string;
    installCommand: string;
    devCommand: string;
    buildCommand: string;
    testCommand: string;
    configFiles: string[];
    frameworks: FrameworkConfig[];
}

export interface FrameworkConfig {
    name: string;
    id: SupportedFramework;
    directories: string[];
    entryPoint: string;
    dependencies: string[];
    devDependencies?: string[];
}

// ============================================
// LANGUAGE CONFIGURATIONS
// ============================================

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
    typescript: {
        name: 'TypeScript',
        extensions: ['.ts', '.tsx'],
        packageManager: 'npm',
        installCommand: 'npm install',
        devCommand: 'npm run dev',
        buildCommand: 'npm run build',
        testCommand: 'npm test',
        configFiles: ['package.json', 'tsconfig.json'],
        frameworks: [
            {
                name: 'Express',
                id: 'express',
                directories: ['src', 'src/routes', 'src/controllers', 'src/services', 'src/middleware'],
                entryPoint: 'src/index.ts',
                dependencies: ['express', 'cors', 'helmet', 'dotenv'],
                devDependencies: ['typescript', '@types/node', '@types/express', 'ts-node', 'nodemon'],
            },
            {
                name: 'Fastify',
                id: 'fastify',
                directories: ['src', 'src/routes', 'src/plugins'],
                entryPoint: 'src/index.ts',
                dependencies: ['fastify', '@fastify/cors', 'dotenv'],
                devDependencies: ['typescript', '@types/node', 'ts-node'],
            },
            {
                name: 'NestJS',
                id: 'nestjs',
                directories: ['src', 'src/modules', 'src/common'],
                entryPoint: 'src/main.ts',
                dependencies: ['@nestjs/core', '@nestjs/common', '@nestjs/platform-express', 'reflect-metadata'],
                devDependencies: ['typescript', '@types/node', '@nestjs/cli'],
            },
        ],
    },
    python: {
        name: 'Python',
        extensions: ['.py'],
        packageManager: 'pip',
        installCommand: 'pip install -r requirements.txt',
        devCommand: 'python -m uvicorn main:app --reload',
        buildCommand: 'python -m build',
        testCommand: 'pytest',
        configFiles: ['requirements.txt', 'pyproject.toml'],
        frameworks: [
            {
                name: 'FastAPI',
                id: 'fastapi',
                directories: ['app', 'app/routers', 'app/models', 'app/schemas', 'tests'],
                entryPoint: 'app/main.py',
                dependencies: ['fastapi', 'uvicorn[standard]', 'pydantic', 'python-dotenv'],
            },
            {
                name: 'Django',
                id: 'django',
                directories: ['project', 'project/apps', 'templates', 'static'],
                entryPoint: 'manage.py',
                dependencies: ['django', 'djangorestframework', 'python-dotenv'],
            },
            {
                name: 'Flask',
                id: 'flask',
                directories: ['app', 'app/routes', 'app/models', 'templates'],
                entryPoint: 'app/__init__.py',
                dependencies: ['flask', 'flask-cors', 'python-dotenv'],
            },
        ],
    },
    go: {
        name: 'Go',
        extensions: ['.go'],
        packageManager: 'go',
        installCommand: 'go mod download',
        devCommand: 'go run .',
        buildCommand: 'go build -o bin/app',
        testCommand: 'go test ./...',
        configFiles: ['go.mod', 'go.sum'],
        frameworks: [
            {
                name: 'Gin',
                id: 'gin',
                directories: ['cmd', 'internal', 'internal/handlers', 'internal/models', 'pkg'],
                entryPoint: 'cmd/main.go',
                dependencies: ['github.com/gin-gonic/gin', 'github.com/joho/godotenv'],
            },
            {
                name: 'Echo',
                id: 'echo',
                directories: ['cmd', 'internal', 'internal/handlers', 'internal/models'],
                entryPoint: 'cmd/main.go',
                dependencies: ['github.com/labstack/echo/v4', 'github.com/joho/godotenv'],
            },
            {
                name: 'Fiber',
                id: 'fiber',
                directories: ['cmd', 'internal', 'internal/handlers'],
                entryPoint: 'cmd/main.go',
                dependencies: ['github.com/gofiber/fiber/v2'],
            },
        ],
    },
    rust: {
        name: 'Rust',
        extensions: ['.rs'],
        packageManager: 'cargo',
        installCommand: 'cargo build',
        devCommand: 'cargo run',
        buildCommand: 'cargo build --release',
        testCommand: 'cargo test',
        configFiles: ['Cargo.toml'],
        frameworks: [
            {
                name: 'Actix',
                id: 'actix',
                directories: ['src', 'src/handlers', 'src/models'],
                entryPoint: 'src/main.rs',
                dependencies: ['actix-web', 'actix-rt', 'serde', 'serde_json', 'dotenv'],
            },
            {
                name: 'Rocket',
                id: 'rocket',
                directories: ['src', 'src/routes', 'src/models'],
                entryPoint: 'src/main.rs',
                dependencies: ['rocket', 'serde', 'serde_json'],
            },
            {
                name: 'Axum',
                id: 'axum',
                directories: ['src', 'src/handlers', 'src/models'],
                entryPoint: 'src/main.rs',
                dependencies: ['axum', 'tokio', 'serde', 'serde_json'],
            },
        ],
    },
    java: {
        name: 'Java',
        extensions: ['.java'],
        packageManager: 'maven',
        installCommand: 'mvn install',
        devCommand: 'mvn spring-boot:run',
        buildCommand: 'mvn package',
        testCommand: 'mvn test',
        configFiles: ['pom.xml'],
        frameworks: [
            {
                name: 'Spring Boot',
                id: 'spring',
                directories: ['src/main/java', 'src/main/resources', 'src/test/java'],
                entryPoint: 'src/main/java/Application.java',
                dependencies: ['spring-boot-starter-web', 'spring-boot-starter-data-jpa'],
            },
            {
                name: 'Quarkus',
                id: 'quarkus',
                directories: ['src/main/java', 'src/main/resources', 'src/test/java'],
                entryPoint: 'src/main/java/Application.java',
                dependencies: ['quarkus-resteasy', 'quarkus-arc'],
            },
        ],
    },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getLanguageConfig(language: SupportedLanguage): LanguageConfig {
    return LANGUAGE_CONFIGS[language];
}

export function getFrameworkConfig(language: SupportedLanguage, framework: SupportedFramework): FrameworkConfig | undefined {
    const langConfig = LANGUAGE_CONFIGS[language];
    return langConfig.frameworks.find(f => f.id === framework);
}

export function getSupportedLanguages(): SupportedLanguage[] {
    return Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[];
}

export function getSupportedFrameworks(language: SupportedLanguage): SupportedFramework[] {
    return LANGUAGE_CONFIGS[language].frameworks.map(f => f.id);
}

export function getDefaultFramework(language: SupportedLanguage): SupportedFramework {
    return LANGUAGE_CONFIGS[language].frameworks[0].id;
}

export function detectLanguageFromFile(filename: string): SupportedLanguage | null {
    const ext = filename.substring(filename.lastIndexOf('.'));

    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
        if (config.extensions.includes(ext)) {
            return lang as SupportedLanguage;
        }
    }
    return null;
}
