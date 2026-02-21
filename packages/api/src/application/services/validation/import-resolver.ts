/**
 * Import Resolver
 * 
 * Resolves broken imports by:
 * 1. Generating missing files from templates (if it's a known pattern)
 * 2. Removing invalid imports (if file not needed)
 * 
 * Problem: Generated code references non-existent modules
 * Solution: Either generate the missing file or remove the import
 */

export interface GeneratedFile {
    path: string;
    content: string;
    language?: string;
    type?: 'code' | 'config' | 'schema' | 'migration' | 'doc';
}

export interface ImportInfo {
    moduleName: string;
    modulePath: string;
    imports: string[];
    sourceFile: string;
    line: number;
    language: 'typescript' | 'python' | 'go' | 'rust' | 'java';
}

export interface ResolutionResult {
    files: GeneratedFile[];
    newFiles: GeneratedFile[];
    removedImports: Array<{ file: string; import: string }>;
    warnings: string[];
}

export class ImportResolver {
    private readonly KNOWN_NPM_PACKAGES = new Set([
        'fastify', 'express', 'mongoose', 'zod', 'axios', 'dotenv',
        'jsonwebtoken', 'bcrypt', 'uuid', 'cors', 'helmet',
        'prisma', '@prisma/client', 'supertest', 'jest',
        'reflect-metadata', 'rxjs', 'class-validator', 'class-transformer',
        'nestjs', '@nestjs/core', '@nestjs/common', '@nestjs/platform-express',
        '@nestjs/config', '@nestjs/mongoose', '@nestjs/jwt', '@nestjs/passport',
        '@nestjs/throttler', '@nestjs/swagger', 'passport', 'passport-jwt',
        'passport-local', '@fastify/cors', '@fastify/jwt', '@fastify/helmet',
        '@fastify/rate-limit', '@fastify/websocket', '@fastify/multipart',
        '@supabase/supabase-js', 'ioredis', 'redis', 'bull', 'amqplib',
        'nodemailer', 'handlebars', 'ejs', 'pug', 'multer', 'sharp',
        'lodash', 'moment', 'date-fns', 'dayjs', 'decimal.js',
        'winston', 'pino', 'bunyan', 'morgan', 'compression',
        'cookie-parser', 'express-session', 'connect-redis',
        'graphql', 'apollo-server-express', '@apollo/server',
        'type-graphql', 'typegoose', '@typegoose/typegoose',
        'sequelize', 'mysql2', 'pg', 'sqlite3', 'better-sqlite3',
        'mongodb', 'node-fetch', 'got', 'undici',
    ]);

    /**
     * Check if a module is an npm package (not a local file)
     */
    isNpmPackage(moduleName: string): boolean {
        if (moduleName.startsWith('@')) {
            return true;
        }
        if (this.KNOWN_NPM_PACKAGES.has(moduleName)) {
            return true;
        }
        if (moduleName.startsWith('.')) {
            return false;
        }
        if (moduleName.startsWith('/')) {
            return false;
        }
        const hasFileExtension = /\.(ts|js|tsx|jsx|py|go|rs|java|json|yaml|yml|md)$/i.test(moduleName);
        return !hasFileExtension;
    }

    /**
     * Resolve all imports across files
     */
    resolve(
        files: GeneratedFile[],
        language: string
    ): ResolutionResult {
        const newFiles: GeneratedFile[] = [];
        const removedImports: Array<{ file: string; import: string }> = [];
        const warnings: string[] = [];
        const skippedNpmPackages: string[] = [];

        const allImports = this.extractAllImports(files, language);

        const existingFiles = new Set(
            files.map(f => this.normalizePath(f.path))
        );

        for (const imp of allImports) {
            if (this.isNpmPackage(imp.moduleName)) {
                skippedNpmPackages.push(imp.moduleName);
                continue;
            }

            const moduleFilePath = this.resolveModuleToFilePath(imp, language);

            if (!this.fileExists(moduleFilePath, existingFiles, language)) {
                if (this.isValidFilePath(moduleFilePath)) {
                    const template = this.getTemplateForImport(imp, language);

                    if (template) {
                        newFiles.push(template);
                        console.log(`[IMPORT-RESOLVER] Generated missing file: ${template.path}`);
                    } else {
                        const removed = this.removeImport(files, imp, language);
                        if (removed) {
                            removedImports.push({
                                file: imp.sourceFile,
                                import: imp.moduleName,
                            });
                            warnings.push(`Removed invalid import from ${imp.sourceFile}: ${imp.moduleName}`);
                        }
                    }
                } else {
                    warnings.push(`Skipped invalid path from ${imp.sourceFile}: ${imp.moduleName}`);
                }
            }
        }

        if (skippedNpmPackages.length > 0) {
            console.log(`[IMPORT-RESOLVER] Skipped ${skippedNpmPackages.length} npm package imports (not creating files for them)`);
        }

        console.log(`[IMPORT-RESOLVER] New files: ${newFiles.length}, Removed imports: ${removedImports.length}`);

        return {
            files: [...files, ...newFiles],
            newFiles,
            removedImports,
            warnings,
        };
    }

    /**
     * Check if a file path is valid (not corrupted or malformed)
     */
    private isValidFilePath(path: string): boolean {
        if (!path || path.trim() === '') {
            return false;
        }
        if (path.includes('@') && !path.startsWith('@')) {
            return false;
        }
        if (path.match(/[^\x00-\x7F]/)) {
            return false;
        }
        if (path.includes('/./') || path.includes('\\.\\')) {
            const normalized = path.replace(/\/\.\//g, '/').replace(/\\\.\\/g, '\\');
            if (normalized !== path) {
                return true;
            }
        }
        if (path.startsWith('./') || path.startsWith('.\\')) {
            return true;
        }
        return true;
    }

    /**
     * Extract all imports from files
     */
    private extractAllImports(files: GeneratedFile[], language: string): ImportInfo[] {
        const imports: ImportInfo[] = [];
        const seen = new Set<string>();

        for (const file of files) {
            const fileImports = this.extractImportsFromFile(file, language);

            for (const imp of fileImports) {
                const key = `${file.path}:${imp.moduleName}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    imports.push(imp);
                }
            }
        }

        return imports;
    }

    /**
     * Extract imports from a single file
     */
    private extractImportsFromFile(file: GeneratedFile, language: string): ImportInfo[] {
        const imports: ImportInfo[] = [];
        const lines = file.content.split('\n');

        if (language === 'python') {
            // Python: from x import y OR import x
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const fromMatch = line.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
                const importMatch = line.match(/^import\s+([\w.]+)/);

                if (fromMatch) {
                    imports.push({
                        moduleName: fromMatch[1],
                        modulePath: fromMatch[1].replace(/\./g, '/'),
                        imports: fromMatch[2].split(',').map(s => s.trim()),
                        sourceFile: file.path,
                        line: i + 1,
                        language: 'python',
                    });
                } else if (importMatch) {
                    imports.push({
                        moduleName: importMatch[1],
                        modulePath: importMatch[1].replace(/\./g, '/'),
                        imports: [],
                        sourceFile: file.path,
                        line: i + 1,
                        language: 'python',
                    });
                }
            }
        } else {
            // TypeScript/JavaScript: import { x } from 'y' OR import x from 'y'
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const importMatch = line.match(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/);

                if (importMatch) {
                    const namedImports = importMatch[1] ? importMatch[1].split(',').map(s => s.trim()) : [];
                    const defaultImport = importMatch[2] || '';

                    imports.push({
                        moduleName: importMatch[3],
                        modulePath: importMatch[3],
                        imports: defaultImport ? [defaultImport, ...namedImports] : namedImports,
                        sourceFile: file.path,
                        line: i + 1,
                        language: 'typescript',
                    });
                }
            }
        }

        return imports;
    }

    /**
     * Resolve module name to file path
     */
    private resolveModuleToFilePath(imp: ImportInfo, language: string): string {
        if (language === 'python') {
            // Python module resolution
            if (imp.moduleName.startsWith('.')) {
                // Relative import
                const sourceDir = imp.sourceFile.substring(0, imp.sourceFile.lastIndexOf('/'));
                const resolved = this.normalizePath(`${sourceDir}/${imp.moduleName.substring(1).replace(/\./g, '/')}.py`);
                return resolved;
            }
            return `${imp.moduleName.replace(/\./g, '/')}.py`;
        }

        // TypeScript/JavaScript resolution
        if (imp.modulePath.startsWith('.')) {
            // Relative import
            const sourceDir = imp.sourceFile.substring(0, imp.sourceFile.lastIndexOf('/'));
            let resolved = this.normalizePath(`${sourceDir}/${imp.modulePath}`);

            // Add extension if missing
            if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
                resolved += '.ts';
            }

            return this.normalizePath(resolved);
        }

        return this.normalizePath(imp.modulePath);
    }

    /**
     * Check if file exists
     */
    private fileExists(
        moduleFilePath: string,
        existingFiles: Set<string>,
        language: string
    ): boolean {
        const normalized = this.normalizePath(moduleFilePath);

        // Direct match
        if (existingFiles.has(normalized)) return true;

        // Try with src/ prefix
        if (existingFiles.has(`src/${normalized}`)) return true;

        // Try with index file
        if (language === 'typescript') {
            if (existingFiles.has(`${normalized}/index.ts`)) return true;
            if (existingFiles.has(`${normalized}.ts`)) return true;
        }
        if (language === 'python') {
            if (existingFiles.has(`${normalized}/__init__.py`)) return true;
        }

        return false;
    }

    /**
     * Normalize path for comparison and output
     */
    private normalizePath(path: string): string {
        let normalized = path
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/\/\.\//g, '/')
            .replace(/^\.\//, '');
        
        while (normalized.includes('/../')) {
            normalized = normalized.replace(/[^/]+\/\.\.\//, '');
        }
        
        return normalized.toLowerCase().trim();
    }

    /**
     * Clean up a path for output (remove invalid segments)
     */
    sanitizePath(path: string): string {
        let sanitized = path
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/\/\.\//g, '/')
            .replace(/^\.\//, '')
            .replace(/\/\.$/, '');
        
        while (sanitized.includes('/../')) {
            sanitized = sanitized.replace(/[^/]+\/\.\.\//, '');
        }
        
        if (sanitized.startsWith('@') && !sanitized.match(/^@[\w-]+\//)) {
            return '';
        }
        
        return sanitized;
    }

    /**
     * Get template for a missing import
     */
    private getTemplateForImport(imp: ImportInfo, language: string): GeneratedFile | null {
        const moduleName = imp.moduleName.toLowerCase();
        const filePath = this.resolveModuleToFilePath(imp, language);

        // Check for known middleware patterns
        if (moduleName.includes('middleware')) {
            return this.getMiddlewareTemplate(filePath, language, imp.imports);
        }

        // Check for known service patterns
        if (moduleName.includes('service')) {
            return this.getServiceTemplate(filePath, language, imp.imports);
        }

        // Check for known route patterns
        if (moduleName.includes('route') || moduleName.includes('router')) {
            return this.getRouteTemplate(filePath, language, imp.imports);
        }

        // Check for auth patterns
        if (moduleName.includes('auth')) {
            return this.getAuthTemplate(filePath, language, imp.imports);
        }

        // Check for utils/helpers patterns
        if (moduleName.includes('util') || moduleName.includes('helper')) {
            return this.getUtilsTemplate(filePath, language, imp.imports);
        }

        // Check for config patterns
        if (moduleName.includes('config') || moduleName.includes('setting')) {
            return this.getConfigTemplate(filePath, language);
        }

        // No template available - will be removed
        return null;
    }

    /**
     * Remove an import from a file
     */
    private removeImport(
        files: GeneratedFile[],
        imp: ImportInfo,
        language: string
    ): boolean {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.path === imp.sourceFile) {
                const lines = file.content.split('\n');
                const newLines: string[] = [];
                let removed = false;

                for (const line of lines) {
                    if (language === 'python') {
                        // Remove Python import
                        if (line.includes(`from ${imp.moduleName} import`) || line.includes(`import ${imp.moduleName}`)) {
                            removed = true;
                            continue;
                        }
                    } else {
                        // Remove TypeScript import
                        if (line.includes(`from '${imp.modulePath}'`) || line.includes(`from "${imp.modulePath}"`)) {
                            removed = true;
                            continue;
                        }
                    }
                    newLines.push(line);
                }

                if (removed) {
                    files[i] = { ...file, content: newLines.join('\n') };
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get middleware template
     */
    private getMiddlewareTemplate(
        filePath: string,
        language: string,
        _exports: string[]
    ): GeneratedFile {
        const name = filePath.split('/').pop()?.replace(/\.(ts|py)$/, '') || 'middleware';
        const className = this.toPascalCase(name);

        if (language === 'python') {
            return {
                path: filePath,
                content: `"""
${className} Middleware
"""

from typing import Callable, Any
from fastapi import Request, Response
import logging

logger = logging.getLogger(__name__)


class ${className}:
    """${className} middleware for request processing"""
    
    def __init__(self, app: Any):
        self.app = app
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        logger.debug(f"${className}: Processing {request.url.path}")
        response = await call_next(request)
        return response


def get_${name.replace(/-/g, '_')}():
    """Get middleware instance"""
    return ${className}
`,
                language: 'python',
                type: 'code',
            };
        }

        return {
            path: filePath,
            content: `/**
 * ${className} Middleware
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export async function ${className}(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> {
  console.log(\`[${className}] Processing: \${request.url}\`);
  done();
}

export default ${className};
`,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Get service template
     */
    private getServiceTemplate(
        filePath: string,
        language: string,
        _exports: string[]
    ): GeneratedFile {
        const name = filePath.split('/').pop()?.replace(/\.(ts|py)$/, '').replace(/_service$/, '') || 'service';
        const className = this.toPascalCase(name) + 'Service';

        if (language === 'python') {
            return {
                path: filePath,
                content: `"""
${className}
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ${className}:
    """${className} - Business logic layer"""
    
    def __init__(self):
        self._initialized = True
        logger.info(f"${className} initialized")
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return {"id": "generated-id", **data}
    
    async def get_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        return None
    
    async def get_all(self) -> List[Dict[str, Any]]:
        return []


_instance: Optional[${className}] = None

def get_${name}_service() -> ${className}:
    global _instance
    if _instance is None:
        _instance = ${className}()
    return _instance
`,
                language: 'python',
                type: 'code',
            };
        }

        return {
            path: filePath,
            content: `/**
 * ${className}
 */

export interface ${this.toPascalCase(name)}Data {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export class ${className} {
  async create(data: Partial<${this.toPascalCase(name)}Data>): Promise<${this.toPascalCase(name)}Data> {
    return { id: 'generated-id', createdAt: new Date(), updatedAt: new Date(), ...data } as ${this.toPascalCase(name)}Data;
  }

  async findById(id: string): Promise<${this.toPascalCase(name)}Data | null> {
    return null;
  }

  async findAll(): Promise<${this.toPascalCase(name)}Data[]> {
    return [];
  }
}

let instance: ${className} | null = null;

export function get${className}(): ${className} {
  if (!instance) instance = new ${className}();
  return instance;
}
`,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Get route template
     */
    private getRouteTemplate(
        filePath: string,
        language: string,
        _exports: string[]
    ): GeneratedFile {
        const name = filePath.split('/').pop()?.replace(/\.(ts|py)$/, '') || 'routes';

        if (language === 'python') {
            return {
                path: filePath,
                content: `"""
${this.toPascalCase(name)} Routes
"""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/")
async def get_${name}():
    """Get ${name}"""
    return {"success": True, "data": []}


@router.get("/{id}")
async def get_${name}_by_id(id: str):
    """Get ${name} by ID"""
    return {"success": True, "data": {"id": id}}


__all__ = ["router"]
`,
                language: 'python',
                type: 'code',
            };
        }

        return {
            path: filePath,
            content: `/**
 * ${this.toPascalCase(name)} Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function ${name}Routes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return { success: true, data: [] };
  });

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return { success: true, data: { id } };
  });
}

export default ${name}Routes;
`,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Get auth template
     */
    private getAuthTemplate(
        filePath: string,
        language: string,
        _exports: string[]
    ): GeneratedFile {
        if (language === 'python') {
            return {
                path: filePath,
                content: `"""
Authentication Module
"""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import jwt
import bcrypt
import logging

logger = logging.getLogger(__name__)

SECRET_KEY = "change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def hash_password(password: str) -> str:
    """Hash password"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password"""
    return bcrypt.checkpw(password.encode(), hashed.encode())


__all__ = ["create_access_token", "verify_token", "hash_password", "verify_password"]
`,
                language: 'python',
                type: 'code',
            };
        }

        return {
            path: filePath,
            content: `/**
 * Authentication Utilities
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const SECRET_KEY = process.env.JWT_SECRET || 'change-this-in-production';

export function createAccessToken(data: object, expiresIn = '30m'): string {
  return jwt.sign(data, SECRET_KEY, { expiresIn });
}

export function verifyToken(token: string): object | null {
  try {
    return jwt.verify(token, SECRET_KEY) as object;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
`,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Get utils template
     */
    private getUtilsTemplate(
        filePath: string,
        language: string,
        _exports: string[]
    ): GeneratedFile {
        if (language === 'python') {
            return {
                path: filePath,
                content: `"""
Utility Functions
"""

from typing import Any, Dict, List
from datetime import datetime
import uuid


def generate_id() -> str:
    """Generate unique ID"""
    return str(uuid.uuid4())


def get_timestamp() -> str:
    """Get current timestamp"""
    return datetime.utcnow().isoformat()


def safe_get(data: Dict[str, Any], key: str, default: Any = None) -> Any:
    """Safely get value from dict"""
    return data.get(key, default)


__all__ = ["generate_id", "get_timestamp", "safe_get"]
`,
                language: 'python',
                type: 'code',
            };
        }

        return {
            path: filePath,
            content: `/**
 * Utility Functions
 */

import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function getTimestamp(): string {
  return new Date().toISOString();
}

export function safeGet<T>(obj: Record<string, unknown>, key: string, defaultValue: T): T {
  return obj[key] as T ?? defaultValue;
}
`,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Get config template
     */
    private getConfigTemplate(filePath: string, language: string): GeneratedFile {
        if (language === 'python') {
            return {
                path: filePath,
                content: `"""
Configuration
"""

import os
from typing import List


class Config:
    """Application configuration"""
    
    APP_NAME: str = os.getenv("APP_NAME", "Generated API")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-this-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")


config = Config()
`,
                language: 'python',
                type: 'code',
            };
        }

        return {
            path: filePath,
            content: `/**
 * Configuration
 */

export const config = {
  appName: process.env.APP_NAME || 'Generated API',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
};

export default config;
`,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Convert string to PascalCase
     */
    private toPascalCase(str: string): string {
        return str
            .split(/[-_\s]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }
}

// Singleton
let instance: ImportResolver | null = null;

export function getImportResolver(): ImportResolver {
    if (!instance) {
        instance = new ImportResolver();
    }
    return instance;
}

export function createImportResolver(): ImportResolver {
    instance = new ImportResolver();
    return instance;
}