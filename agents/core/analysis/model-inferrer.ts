/**
 * Data Model Inferrer
 * 
 * Infers data models from frontend code by analyzing:
 * - TypeScript interfaces and types
 * - Zod/Yup validation schemas
 * - Form state and handlers
 * - API response types
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InferredModel, InferredField, InferredFieldType } from './types.js';

// Patterns for extracting TypeScript interfaces
const INTERFACE_PATTERNS = {
    // interface User { ... }
    interface: /interface\s+(\w+)\s*(?:extends\s+[\w,\s]+)?\s*\{([^}]+)\}/g,
    // type User = { ... }
    typeAlias: /type\s+(\w+)\s*=\s*\{([^}]+)\}/g,
};

// Patterns for field type inference
const FIELD_TYPE_PATTERNS: [RegExp, InferredFieldType][] = [
    [/^string$/, 'string'],
    [/^number$/, 'number'],
    [/^boolean$/, 'boolean'],
    [/^Date$/, 'date'],
    [/^\w+\[\]$/, 'array'],
    [/^Array</, 'array'],
    [/uuid|id$/i, 'uuid'],
    [/email/i, 'email'],
    [/url|link|href/i, 'url'],
];

// Common model name patterns (to filter noise)
const COMMON_MODEL_NAMES = new Set([
    'User', 'Account', 'Profile',
    'Product', 'Item', 'Order', 'Cart', 'CartItem',
    'Post', 'Comment', 'Article', 'Blog',
    'Message', 'Notification', 'Email',
    'Task', 'Project', 'Workspace',
    'Invoice', 'Payment', 'Subscription',
    'Category', 'Tag', 'Label',
    'File', 'Image', 'Document', 'Attachment',
    'Settings', 'Preferences', 'Config',
]);

// Props/State patterns to detect from common suffixes/patterns
const MODEL_INDICATOR_PATTERNS = [
    /Data$/,
    /Props$/,
    /State$/,
    /Item$/,
    /Entity$/,
    /Model$/,
    /Dto$/,
    /Response$/,
    /Request$/,
    /Input$/,
    /Form$/,
];

export class DataModelInferrer {
    private rootPath: string;
    private models: Map<string, InferredModel> = new Map();

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    /**
     * Parse a TypeScript type string to determine field type
     */
    private parseFieldType(typeStr: string): { type: InferredFieldType; arrayType?: InferredFieldType } {
        const trimmed = typeStr.trim();

        // Check for array type
        if (trimmed.endsWith('[]')) {
            const elementType = trimmed.slice(0, -2);
            return {
                type: 'array',
                arrayType: this.parseFieldType(elementType).type
            };
        }

        if (trimmed.startsWith('Array<') && trimmed.endsWith('>')) {
            const elementType = trimmed.slice(6, -1);
            return {
                type: 'array',
                arrayType: this.parseFieldType(elementType).type
            };
        }

        // Check known patterns
        for (const [pattern, fieldType] of FIELD_TYPE_PATTERNS) {
            if (pattern.test(trimmed)) {
                return { type: fieldType };
            }
        }

        // Default to object if complex, string otherwise
        if (trimmed.includes('{') || trimmed.includes('|') || /^[A-Z]/.test(trimmed)) {
            return { type: 'object' };
        }

        return { type: 'string' };
    }

    /**
     * Parse fields from interface/type body
     */
    private parseFields(body: string): InferredField[] {
        const fields: InferredField[] = [];

        // Split by semicolons or newlines
        const lines = body.split(/[;\n]/).filter(l => l.trim());

        for (const line of lines) {
            // Match field patterns: name?: type or name: type
            const match = line.match(/^\s*(\w+)\s*(\?)?:\s*(.+?)\s*$/);
            if (match) {
                const [, name, optional, typeStr] = match;
                const { type, arrayType } = this.parseFieldType(typeStr);

                fields.push({
                    name,
                    type,
                    optional: !!optional,
                    arrayType,
                });
            }
        }

        return fields;
    }

    /**
     * Check if a name looks like a data model
     */
    private isLikelyModel(name: string): boolean {
        // Check common names
        if (COMMON_MODEL_NAMES.has(name)) return true;

        // Check common patterns
        if (MODEL_INDICATOR_PATTERNS.some(p => p.test(name))) return true;

        // Skip internal/utility types
        if (name.startsWith('_')) return false;
        if (['Props', 'State', 'Context', 'Ref'].includes(name)) return false;

        // PascalCase with more than 3 chars is likely a model
        return /^[A-Z][a-z]+([A-Z][a-z]+)*$/.test(name) && name.length > 3;
    }

    /**
     * Extract interfaces and types from a file
     */
    private async extractFromFile(filePath: string): Promise<void> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const relativePath = path.relative(this.rootPath, filePath);

            // Extract interfaces
            let match;
            INTERFACE_PATTERNS.interface.lastIndex = 0;
            while ((match = INTERFACE_PATTERNS.interface.exec(content)) !== null) {
                const [, name, body] = match;
                if (this.isLikelyModel(name)) {
                    this.addOrMergeModel(name, body, relativePath, 'interface');
                }
            }

            // Extract type aliases
            INTERFACE_PATTERNS.typeAlias.lastIndex = 0;
            while ((match = INTERFACE_PATTERNS.typeAlias.exec(content)) !== null) {
                const [, name, body] = match;
                if (this.isLikelyModel(name)) {
                    this.addOrMergeModel(name, body, relativePath, 'type');
                }
            }

            // Extract from Zod schemas
            await this.extractZodSchemas(content, relativePath);

            // Extract from form state patterns
            await this.extractFormState(content, relativePath);

        } catch {
            // Skip unreadable files
        }
    }

    /**
     * Extract models from Zod schemas
     */
    private async extractZodSchemas(content: string, relativePath: string): Promise<void> {
        // Match: const userSchema = z.object({ ... })
        const zodPattern = /const\s+(\w+(?:Schema)?)\s*=\s*z\.object\s*\(\s*\{([^}]+)\}\s*\)/g;

        let match;
        while ((match = zodPattern.exec(content)) !== null) {
            const [, schemaName, body] = match;

            // Convert schema name to model name (remove Schema suffix)
            const modelName = schemaName.replace(/Schema$/, '');
            const capitalizedName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

            if (this.isLikelyModel(capitalizedName)) {
                const fields = this.parseZodFields(body);
                this.addModelFromZod(capitalizedName, fields, relativePath);
            }
        }
    }

    /**
     * Parse Zod field definitions
     */
    private parseZodFields(body: string): InferredField[] {
        const fields: InferredField[] = [];

        // Match patterns like: email: z.string().email()
        const fieldPattern = /(\w+)\s*:\s*z\.(\w+)\(\)/g;

        let match;
        while ((match = fieldPattern.exec(body)) !== null) {
            const [, name, zodType] = match;

            let type: InferredFieldType = 'string';
            switch (zodType) {
                case 'string': type = 'string'; break;
                case 'number': type = 'number'; break;
                case 'boolean': type = 'boolean'; break;
                case 'date': type = 'date'; break;
                case 'array': type = 'array'; break;
                case 'object': type = 'object'; break;
                case 'enum': type = 'enum'; break;
            }

            // Check for optional
            const isOptional = body.includes(`${name}:`) && body.includes('.optional()');

            fields.push({
                name,
                type,
                optional: isOptional,
            });
        }

        return fields;
    }

    /**
     * Extract models from React form state/useState patterns
     */
    private async extractFormState(content: string, relativePath: string): Promise<void> {
        // Match: const [user, setUser] = useState<User>({ ... })
        const useStatePattern = /useState<(\w+)>\s*\(/g;

        let match;
        while ((match = useStatePattern.exec(content)) !== null) {
            const [, typeName] = match;
            if (this.isLikelyModel(typeName) && !this.models.has(typeName)) {
                // Add placeholder - will be merged if interface found
                this.models.set(typeName, {
                    name: typeName,
                    fields: [],
                    sources: [{ file: relativePath, type: 'state' }],
                    relationships: [],
                    confidence: 0.3,
                });
            }
        }
    }

    /**
     * Add or merge a model
     */
    private addOrMergeModel(
        name: string,
        body: string,
        file: string,
        sourceType: 'interface' | 'type'
    ): void {
        const fields = this.parseFields(body);

        if (this.models.has(name)) {
            const existing = this.models.get(name)!;
            // Merge fields
            for (const field of fields) {
                if (!existing.fields.some(f => f.name === field.name)) {
                    existing.fields.push(field);
                }
            }
            // Add source
            existing.sources.push({ file, type: sourceType });
            // Increase confidence
            existing.confidence = Math.min(existing.confidence + 0.2, 1);
        } else {
            this.models.set(name, {
                name,
                fields,
                sources: [{ file, type: sourceType }],
                relationships: [],
                confidence: 0.6,
            });
        }
    }

    /**
     * Add model from Zod schema
     */
    private addModelFromZod(name: string, fields: InferredField[], file: string): void {
        if (this.models.has(name)) {
            const existing = this.models.get(name)!;
            for (const field of fields) {
                if (!existing.fields.some(f => f.name === field.name)) {
                    existing.fields.push(field);
                }
            }
            existing.confidence = Math.min(existing.confidence + 0.3, 1);
        } else {
            this.models.set(name, {
                name,
                fields,
                sources: [{ file, type: 'form' }],
                relationships: [],
                confidence: 0.7,
            });
        }
    }

    /**
     * Infer relationships between models
     */
    private inferRelationships(): void {
        const modelNames = new Set(this.models.keys());

        for (const [name, model] of this.models) {
            for (const field of model.fields) {
                // Check if field type references another model
                const typeName = field.arrayType || (field.type === 'object' ? field.name : null);

                if (typeName && typeof typeName === 'string') {
                    // Try to match model name from field name (e.g., userId -> User)
                    const potentialModel = typeName.replace(/Id$/, '').replace(/^./, c => c.toUpperCase());

                    if (modelNames.has(potentialModel) && potentialModel !== name) {
                        model.relationships.push({
                            targetModel: potentialModel,
                            type: field.type === 'array' ? 'one-to-many' : 'one-to-one',
                            fieldName: field.name,
                        });
                    }
                }

                // Check for *Id fields
                if (field.name.endsWith('Id') || field.name.endsWith('ID')) {
                    const potentialModel = field.name.slice(0, -2).replace(/^./, c => c.toUpperCase());
                    if (modelNames.has(potentialModel) && potentialModel !== name) {
                        if (!model.relationships.some(r => r.targetModel === potentialModel)) {
                            model.relationships.push({
                                targetModel: potentialModel,
                                type: 'one-to-one',
                                fieldName: field.name,
                            });
                        }
                    }
                }
            }

            // Infer primary key
            const idField = model.fields.find(f =>
                f.name === 'id' || f.name === '_id' || f.name === `${name.toLowerCase()}Id`
            );
            if (idField) {
                model.primaryKey = idField.name;
            }
        }
    }

    /**
     * Find all source files
     */
    private async findSourceFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const extensions = ['.ts', '.tsx'];
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
     * Run the complete model inference
     */
    async infer(): Promise<InferredModel[]> {
        const files = await this.findSourceFiles(this.rootPath);

        for (const file of files) {
            await this.extractFromFile(file);
        }

        // Infer relationships after all models are collected
        this.inferRelationships();

        // Filter out low-confidence models with no fields
        const results = Array.from(this.models.values())
            .filter(m => m.fields.length > 0 || m.confidence > 0.5);

        return results;
    }
}

export default DataModelInferrer;
