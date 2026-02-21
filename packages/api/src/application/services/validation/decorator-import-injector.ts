/**
 * Decorator Import Injector
 * 
 * CG-009 FIX: Automatically injects missing imports for decorator usage.
 * 
 * Problem: AI-generated code uses decorators like @Schema, @Prop, @Module
 * without importing them, causing runtime errors.
 * 
 * Solution: Detect decorator usage and inject the appropriate imports.
 */

import type { GeneratedFile } from './file-deduplicator.js';

export interface DecoratorPattern {
    patterns: RegExp[];
    imports: string[];
    framework: 'nestjs' | 'class-validator' | 'typegoose' | 'typeorm' | 'general';
}

export interface InjectionResult {
    content: string;
    importsAdded: string[];
    wasModified: boolean;
}

export class DecoratorImportInjector {
    private readonly DECORATOR_PATTERNS: DecoratorPattern[] = [
        {
            framework: 'nestjs',
            patterns: [
                /\@Module\s*\(/,
                /\@Controller\s*\(/,
                /\@Injectable\s*\(/,
                /\@Inject\s*\(/,
                /\@Optional\s*\(/,
            ],
            imports: [
                "import { Module, Controller, Injectable, Inject, Optional } from '@nestjs/common';",
            ],
        },
        {
            framework: 'nestjs',
            patterns: [
                /\@Get\s*\(/,
                /\@Post\s*\(/,
                /\@Put\s*\(/,
                /\@Delete\s*\(/,
                /\@Patch\s*\(/,
                /\@Body\s*\(/,
                /\@Param\s*\(/,
                /\@Query\s*\(/,
                /\@Headers\s*\(/,
            ],
            imports: [
                "import { Get, Post, Put, Delete, Patch, Body, Param, Query, Headers } from '@nestjs/common';",
            ],
        },
        {
            framework: 'nestjs',
            patterns: [
                /\@Schema\s*\(/,
                /\@Prop\s*\(/,
                /SchemaFactory\.createForClass/,
            ],
            imports: [
                "import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';",
                "import { Document, Types } from 'mongoose';",
            ],
        },
        {
            framework: 'nestjs',
            patterns: [
                /ConfigModule/,
                /ConfigService/,
            ],
            imports: [
                "import { ConfigModule, ConfigService } from '@nestjs/config';",
            ],
        },
        {
            framework: 'nestjs',
            patterns: [
                /MongooseModule\.forRoot/,
                /MongooseModule\.forRootAsync/,
                /MongooseModule\.forFeature/,
            ],
            imports: [
                "import { MongooseModule } from '@nestjs/mongoose';",
            ],
        },
        {
            framework: 'class-validator',
            patterns: [
                /\@IsString\s*\(/,
                /\@IsNumber\s*\(/,
                /\@IsBoolean\s*\(/,
                /\@IsEmail\s*\(/,
                /\@IsOptional\s*\(/,
                /\@IsNotEmpty\s*\(/,
                /\@Min\s*\(/,
                /\@Max\s*\(/,
                /\@MinLength\s*\(/,
                /\@MaxLength\s*\(/,
                /\@IsArray\s*\(/,
                /\@IsDate\s*\(/,
                /\@IsEnum\s*\(/,
            ],
            imports: [
                "import { IsString, IsNumber, IsBoolean, IsEmail, IsOptional, IsNotEmpty, Min, Max, MinLength, MaxLength, IsArray, IsDate, IsEnum } from 'class-validator';",
            ],
        },
        {
            framework: 'class-validator',
            patterns: [
                /\@Type\s*\(/,
            ],
            imports: [
                "import { Type } from 'class-transformer';",
            ],
        },
        {
            framework: 'typeorm',
            patterns: [
                /\@Entity\s*\(/,
                /\@Column\s*\(/,
                /\@PrimaryGeneratedColumn\s*\(/,
                /\@PrimaryColumn\s*\(/,
                /\@OneToMany\s*\(/,
                /\@ManyToOne\s*\(/,
                /\@ManyToMany\s*\(/,
                /\@OneToOne\s*\(/,
                /\@JoinColumn\s*\(/,
                /\@JoinTable\s*\(/,
            ],
            imports: [
                "import { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn, OneToMany, ManyToOne, ManyToMany, OneToOne, JoinColumn, JoinTable } from 'typeorm';",
            ],
        },
        {
            framework: 'typegoose',
            patterns: [
                /\@prop\s*\(/,
                /\@modelOption\s*\(/,
                /\@index\s*\(/,
            ],
            imports: [
                "import { prop, modelOption, index } from '@typegoose/typegoose';",
            ],
        },
    ];

    /**
     * Inject missing imports into a single file's content
     */
    inject(content: string, _filePath: string): InjectionResult {
        if (!content || content.trim().length === 0) {
            return { content, importsAdded: [], wasModified: false };
        }

        const importsToAdd: string[] = [];
        const existingImports = this.extractExistingImports(content);

        for (const pattern of this.DECORATOR_PATTERNS) {
            const hasPattern = pattern.patterns.some(regex => regex.test(content));
            
            if (hasPattern) {
                for (const imp of pattern.imports) {
                    const importPath = this.extractImportPath(imp);
                    if (!existingImports.has(importPath)) {
                        importsToAdd.push(imp);
                    }
                }
            }
        }

        if (importsToAdd.length === 0) {
            return { content, importsAdded: [], wasModified: false };
        }

        const uniqueImports = [...new Set(importsToAdd)];
        const newContent = this.insertImports(content, uniqueImports);

        return {
            content: newContent,
            importsAdded: uniqueImports,
            wasModified: true,
        };
    }

    /**
     * Process multiple files and inject imports
     */
    processFiles(files: GeneratedFile[]): GeneratedFile[] {
        return files.map(file => {
            const language = file.language || this.detectLanguage(file.path);
            
            if (language !== 'typescript' && language !== 'javascript') {
                return file;
            }

            const result = this.inject(file.content, file.path);
            
            if (result.wasModified) {
                console.log(`[DECORATOR-INJECTOR] Added ${result.importsAdded.length} imports to ${file.path}`);
            }

            return {
                ...file,
                content: result.content,
            };
        });
    }

    /**
     * Extract existing import paths from content
     */
    private extractExistingImports(content: string): Set<string> {
        const imports = new Set<string>();
        const importRegex = /import\s+[^;]+\s+from\s+['"]([^'"]+)['"]/g;
        
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.add(match[1]);
        }

        return imports;
    }

    /**
     * Extract the import path from an import statement
     */
    private extractImportPath(importStatement: string): string {
        const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
        return match ? match[1] : '';
    }

    /**
     * Insert imports at the appropriate location
     */
    private insertImports(content: string, imports: string[]): string {
        const lines = content.split('\n');
        let insertIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('import ') || line.startsWith('import{')) {
                insertIndex = i + 1;
            } else if (line === '' && insertIndex > 0) {
                insertIndex = i + 1;
            } else if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
                if (insertIndex === 0) {
                    insertIndex = i + 1;
                }
            } else if (!line.startsWith('import') && insertIndex > 0) {
                break;
            }
        }

        if (insertIndex === 0) {
            const firstNonComment = lines.findIndex(line => {
                const trimmed = line.trim();
                return trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
            });
            insertIndex = Math.max(0, firstNonComment);
        }

        const newImports = imports.join('\n');
        
        if (insertIndex >= lines.length) {
            return content + '\n' + newImports + '\n';
        }

        lines.splice(insertIndex, 0, newImports);
        return lines.join('\n');
    }

    /**
     * Detect language from file extension
     */
    private detectLanguage(path: string): string {
        const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
        const langMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
        };
        return langMap[ext] || 'typescript';
    }

    /**
     * Generate a NestJS app.module.ts content
     */
    generateNestJSAppModule(imports: string[], modules: string[]): string {
        const importStatements = imports.map(imp => `import { ${imp} } from './${imp.toLowerCase()}/${imp}.module';`).join('\n');
        const moduleList = modules.join(',\n        ');

        return `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';

${importStatements}

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/supermarket'),
        ${moduleList}
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
`;
    }

    /**
     * Generate a NestJS main.ts content
     */
    generateNestJSMain(appName: string): string {
        return `import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    
    // Enable validation globally
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    
    // Enable CORS
    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
    });
    
    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    console.log(\`🚀 ${appName} is running on: http://localhost:\${port}\`);
}

bootstrap();
`;
    }

    /**
     * Generate a complete NestJS schema file
     */
    generateNestJSSchema(name: string, fields: Array<{ name: string; type: string; required?: boolean; unique?: boolean }>): string {
        const className = this.toPascalCase(name);
        const props = fields.map(f => {
            const options = [];
            if (f.required) options.push('required: true');
            if (f.unique) options.push('unique: true');
            const optionsStr = options.length > 0 ? `{ ${options.join(', ')} }` : '';
            return `  @Prop(${optionsStr})\n  ${f.name}: ${f.type};`;
        }).join('\n\n');

        return `import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ${className}Document = ${className} & Document;

@Schema({ timestamps: true, collection: '${name.toLowerCase()}s' })
export class ${className} {
${props}
}

export const ${className}Schema = SchemaFactory.createForClass(${className});

// Indexes
${className}Schema.index({ name: 1 });
`;
    }

    /**
     * Generate a NestJS service file
     */
    generateNestJSService(name: string): string {
        const className = this.toPascalCase(name);
        
        return `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ${className}, ${className}Document } from './schemas/${name.toLowerCase()}.schema';

@Injectable()
export class ${className}Service {
    constructor(
        @InjectModel(${className}.name) private ${name.toLowerCase()}Model: Model<${className}Document>,
    ) {}

    async create(create${className}Dto: Partial<${className}>): Promise<${className}Document> {
        const created = new this.${name.toLowerCase()}Model(create${className}Dto);
        return created.save();
    }

    async findAll(): Promise<${className}Document[]> {
        return this.${name.toLowerCase()}Model.find().exec();
    }

    async findById(id: string): Promise<${className}Document | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }
        return this.${name.toLowerCase()}Model.findById(id).exec();
    }

    async update(id: string, update${className}Dto: Partial<${className}>): Promise<${className}Document | null> {
        if (!Types.ObjectId.isValid(id)) {
            return null;
        }
        return this.${name.toLowerCase()}Model
            .findByIdAndUpdate(id, update${className}Dto, { new: true })
            .exec();
    }

    async delete(id: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(id)) {
            return false;
        }
        const result = await this.${name.toLowerCase()}Model.findByIdAndDelete(id).exec();
        return !!result;
    }
}
`;
    }

    /**
     * Generate a NestJS controller file
     */
    generateNestJSController(name: string): string {
        const className = this.toPascalCase(name);
        
        return `import { Controller, Get, Post, Put, Delete, Body, Param, ParseObjectIdPipe } from '@nestjs/common';
import { ${className}Service } from './${name.toLowerCase()}.service';
import { ${className} } from './schemas/${name.toLowerCase()}.schema';

@Controller('${name.toLowerCase()}s')
export class ${className}Controller {
    constructor(private readonly ${name.toLowerCase()}Service: ${className}Service) {}

    @Post()
    async create(@Body() create${className}Dto: Partial<${className}>): Promise<${className}> {
        return this.${name.toLowerCase()}Service.create(create${className}Dto);
    }

    @Get()
    async findAll(): Promise<${className}[]> {
        return this.${name.toLowerCase()}Service.findAll();
    }

    @Get(':id')
    async findById(@Param('id', ParseObjectIdPipe) id: string): Promise<${className} | null> {
        return this.${name.toLowerCase()}Service.findById(id);
    }

    @Put(':id')
    async update(
        @Param('id', ParseObjectIdPipe) id: string,
        @Body() update${className}Dto: Partial<${className}>,
    ): Promise<${className} | null> {
        return this.${name.toLowerCase()}Service.update(id, update${className}Dto);
    }

    @Delete(':id')
    async delete(@Param('id', ParseObjectIdPipe) id: string): Promise<{ success: boolean }> {
        const success = await this.${name.toLowerCase()}Service.delete(id);
        return { success };
    }
}
`;
    }

    /**
     * Generate a NestJS module file
     */
    generateNestJSModule(name: string): string {
        const className = this.toPascalCase(name);
        
        return `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${className}Controller } from './${name.toLowerCase()}.controller';
import { ${className}Service } from './${name.toLowerCase()}.service';
import { ${className}, ${className}Schema } from './schemas/${name.toLowerCase()}.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ${className}.name, schema: ${className}Schema },
        ]),
    ],
    controllers: [${className}Controller],
    providers: [${className}Service],
    exports: [${className}Service],
})
export class ${className}Module {}
`;
    }

    /**
     * Generate NestJS configuration file
     */
    generateNestJSConfig(): string {
        return `import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/supermarket',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));
`;
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

let instance: DecoratorImportInjector | null = null;

export function getDecoratorImportInjector(): DecoratorImportInjector {
    if (!instance) {
        instance = new DecoratorImportInjector();
    }
    return instance;
}

export function createDecoratorImportInjector(): DecoratorImportInjector {
    instance = new DecoratorImportInjector();
    return instance;
}
