import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CoreService } from './core.service';
import { GenerateApiRequest } from '../dto/generate-api.request';
import { GenerateApiResponse } from '../dto/generate-api.response';

@ApiTags('Core API')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1')
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Check if the API service is running and healthy',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00.000Z',
        uptime: 123.456,
      },
    },
  })
  getHealth(): { status: string; timestamp: string; uptime: number } {
    return this.coreService.getHealth();
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate API from specifications',
    description: 'Generate a complete API based on the provided specifications',
  })
  @ApiResponse({
    status: 200,
    description: 'API generated successfully',
    type: GenerateApiResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - validation failed',
    schema: {
      example: {
        success: false,
        statusCode: 400,
        timestamp: '2024-01-01T00:00:00.000Z',
        path: '/api/v1/generate',
        method: 'POST',
        message: 'Validation failed',
        details: {
          name: ['name should not be empty'],
          entities: ['entities must be an array'],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async generateApi(
    @Body() request: GenerateApiRequest,
  ): Promise<GenerateApiResponse> {
    return this.coreService.generateApi(request);
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Get available API templates',
    description: 'Retrieve list of available API generation templates',
  })
  @ApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
    schema: {
      example: {
        templates: [
          'rest-crud',
          'graphql-api',
          'trpc-endpoints',
          'microservice',
          'serverless',
        ],
      },
    },
  })
  getTemplates(): { templates: string[] } {
    return this.coreService.getAvailableTemplates();
  }
}
