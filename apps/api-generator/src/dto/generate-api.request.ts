import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum ApiType {
  REST = 'rest',
  GRAPHQL = 'graphql',
  TRPC = 'trpc',
}

export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  MONGODB = 'mongodb',
  MYSQL = 'mysql',
}

export class GenerateApiRequest {
  @ApiProperty({ description: 'Name of the API to generate', example: 'User Management API' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the API', required: false, example: 'API for managing users and authentication' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ApiType, description: 'Type of API to generate', example: ApiType.REST })
  @IsEnum(ApiType)
  type: ApiType;

  @ApiProperty({
    enum: DatabaseType,
    description: 'Database type',
    required: false,
    example: DatabaseType.POSTGRESQL,
  })
  @IsOptional()
  @IsEnum(DatabaseType)
  database?: DatabaseType;

  @ApiProperty({
    description: 'Array of entities/models to generate',
    type: [String],
    example: ['User', 'Post', 'Comment'],
  })
  @IsArray()
  @IsString({ each: true })
  entities: string[];

  @ApiProperty({
    description: 'Authentication methods to include',
    enum: ['jwt', 'oauth', 'basic'],
    isArray: true,
    required: false,
    example: ['jwt', 'oauth'],
  })
  @IsOptional()
  @IsArray()
  authentication?: string[];

  @ApiProperty({
    description: 'Additional features to include',
    enum: ['validation', 'pagination', 'sorting', 'filtering', 'caching'],
    isArray: true,
    required: false,
    example: ['validation', 'pagination'],
  })
  @IsOptional()
  @IsArray()
  features?: string[];
}
