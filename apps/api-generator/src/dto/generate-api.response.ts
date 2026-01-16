import { ApiProperty } from '@nestjs/swagger';

export class GenerateApiResponse {
  @ApiProperty({ description: 'Whether the generation was successful', example: true })
  success: boolean;

  @ApiProperty({ description: 'Response message', example: 'API generation initiated successfully' })
  message: string;

  @ApiProperty({ description: 'Job ID for tracking progress', example: 'job_1704067200000' })
  jobId: string;

  @ApiProperty({ description: 'Estimated completion time', example: '30 seconds' })
  estimatedTime: string;

  @ApiProperty({
    description: 'Generated files (if available)',
    required: false,
    example: ['user.controller.ts', 'user.service.ts', 'user.module.ts'],
  })
  files?: string[];
}
