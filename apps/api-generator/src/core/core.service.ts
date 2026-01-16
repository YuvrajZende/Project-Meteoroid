import { Injectable, Logger } from '@nestjs/common';
import { GenerateApiRequest } from '../dto/generate-api.request';
import { GenerateApiResponse } from '../dto/generate-api.response';

@Injectable()
export class CoreService {
  private readonly logger = new Logger(CoreService.name);

  constructor() {}

  getHealth(): { status: string; timestamp: string; uptime: number } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async generateApi(request: GenerateApiRequest): Promise<GenerateApiResponse> {
    this.logger.log(
      `Generating ${request.type.toUpperCase()} API: ${request.name}`,
    );
    this.logger.debug(`Entities: ${request.entities.join(', ')}`);
    this.logger.debug(`Features: ${request.features?.join(', ') || 'none'}`);

    const jobId = `job_${Date.now()}`;
    const estimatedTime = this.estimateTime(request);

    this.logger.log(`Created job ${jobId}, estimated time: ${estimatedTime}`);

    return {
      success: true,
      message: 'API generation initiated successfully',
      jobId,
      estimatedTime,
    };
  }

  getAvailableTemplates(): { templates: string[] } {
    return {
      templates: [
        'rest-crud',
        'graphql-api',
        'trpc-endpoints',
        'microservice',
        'serverless',
        'auth-module',
        'database-module',
      ],
    };
  }

  private estimateTime(request: GenerateApiRequest): string {
    const baseTime = 15;
    const entityMultiplier = 5;
    const featureMultiplier = 3;

    const estimatedSeconds =
      baseTime +
      request.entities.length * entityMultiplier +
      (request.features?.length || 0) * featureMultiplier;

    return `${estimatedSeconds} seconds`;
  }
}
