/**
 * ============================================
 * INFRASTRUCTURE AGENT - CORE IMPLEMENTATION
 * ============================================
 * 
 * The Infrastructure Agent is responsible for generating
 * Infrastructure as Code (IaC) configurations.
 * 
 * Capabilities:
 * - Terraform configuration generation
 * - AWS/GCP/Azure resource provisioning
 * - Pulumi configurations
 * - Helm charts
 * - Environment configuration
 * 
 * @author Person 3 (API Specialist)
 */

// ============================================
// TYPES
// ============================================

export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'digitalocean';
export type IaCTool = 'terraform' | 'pulumi' | 'cloudformation' | 'bicep';
export type ResourceType = 'compute' | 'database' | 'storage' | 'networking' | 'container' | 'serverless';

export interface InfraAgentConfig {
    provider: CloudProvider;
    iacTool: IaCTool;
    region: string;
    environment: string;
    stateBackend: 'local' | 's3' | 'gcs' | 'azurerm';
}

export interface ResourceDefinition {
    type: ResourceType;
    name: string;
    config: Record<string, unknown>;
    dependencies?: string[];
    tags?: Record<string, string>;
}

export interface InfraGeneratedFile {
    path: string;
    content: string;
    type: 'terraform' | 'variables' | 'outputs' | 'helm' | 'config';
}

export interface InfraGenerationResult {
    success: boolean;
    files: InfraGeneratedFile[];
    resources: string[];
    provider: CloudProvider;
    iacTool: IaCTool;
}

// ============================================
// TEMPLATES
// ============================================

const TERRAFORM_MAIN_AWS = `# Terraform Configuration for AWS
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "{{stateBucket}}"
    key            = "{{stateKey}}"
    region         = "{{region}}"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  }
}
`;

const TERRAFORM_VPC = `# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "\${var.project_name}-vpc"
  }
}

resource "aws_subnet" "public" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = var.availability_zones[count.index]
  
  map_public_ip_on_launch = true
  
  tags = {
    Name = "\${var.project_name}-public-\${count.index + 1}"
    Type = "public"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "\${var.project_name}-private-\${count.index + 1}"
    Type = "private"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "\${var.project_name}-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "\${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
`;

const TERRAFORM_ECS = `# ECS Cluster Configuration
resource "aws_ecs_cluster" "main" {
  name = "\${var.project_name}-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name
  
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  
  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "\${var.project_name}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  
  container_definitions = jsonencode([
    {
      name  = "app"
      image = "\${var.ecr_repository_url}:\${var.image_tag}"
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        }
      ]
      
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_ssm_parameter.database_url.arn
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = "\${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }
  
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}
`;

const TERRAFORM_RDS = `# RDS PostgreSQL Configuration
resource "aws_db_subnet_group" "main" {
  name       = "\${var.project_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  
  tags = {
    Name = "\${var.project_name}-db-subnet"
  }
}

resource "aws_db_instance" "main" {
  identifier = "\${var.project_name}-db"
  
  engine         = "postgres"
  engine_version = "15"
  instance_class = var.db_instance_class
  
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  multi_az               = var.environment == "production"
  publicly_accessible    = false
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"
  
  performance_insights_enabled = true
  
  tags = {
    Name = "\${var.project_name}-db"
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.project_name}/${var.environment}/database_url"
type = "SecureString"
value = "postgresql://\${var.db_username}:\${random_password.db_password.result}@\${aws_db_instance.main.endpoint}/\${var.db_name}"
}
`;

const TERRAFORM_VARIABLES = `# Variables Configuration
variable "aws_region" {
    description = "AWS region"
    type = string
  default     = "us-east-1"
}

variable "environment" {
    description = "Environment name"
    type = string
  default     = "development"
}

variable "project_name" {
    description = "Project name"
    type = string
}

variable "vpc_cidr" {
    description = "VPC CIDR block"
    type = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
    description = "Availability zones"
    type = list(string)
  default     =["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "container_cpu" {
    description = "Container CPU units"
    type = number
  default     = 256
}

variable "container_memory" {
    description = "Container memory in MB"
    type = number
  default     = 512
}

variable "desired_count" {
    description = "Desired number of ECS tasks"
    type = number
  default     = 2
}

variable "db_instance_class" {
    description = "RDS instance class"
    type = string
  default     = "db.t3.small"
}

variable "db_allocated_storage" {
    description = "RDS allocated storage in GB"
    type = number
  default     = 20
}

variable "db_max_storage" {
    description = "RDS max storage in GB"
    type = number
  default     = 100
}

variable "db_name" {
    description = "Database name"
    type = string
  default     = "app"
}

variable "db_username" {
    description = "Database username"
    type = string
  default     = "postgres"
}

variable "ecr_repository_url" {
    description = "ECR repository URL"
    type = string
}

variable "image_tag" {
    description = "Docker image tag"
    type = string
  default     = "latest"
}
`;

const TERRAFORM_OUTPUTS = `# Outputs
output "vpc_id" {
    description = "VPC ID"
    value = aws_vpc.main.id
}

output "ecs_cluster_name" {
    description = "ECS cluster name"
    value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
    description = "ECS service name"
    value = aws_ecs_service.app.name
}

output "rds_endpoint" {
    description = "RDS endpoint"
    value = aws_db_instance.main.endpoint
    sensitive = true
}

output "alb_dns_name" {
    description = "ALB DNS name"
    value = aws_lb.main.dns_name
}
`;

// ============================================
// INFRA AGENT CLASS
// ============================================

export class InfraAgent {
    private config: InfraAgentConfig;

    constructor(config?: Partial<InfraAgentConfig>) {
        this.config = {
            provider: config?.provider || 'aws',
            iacTool: config?.iacTool || 'terraform',
            region: config?.region || 'us-east-1',
            environment: config?.environment || 'development',
            stateBackend: config?.stateBackend || 's3',
        };
    }

    /**
     * Analyze requirements and determine infrastructure needed
     */
    async analyzeRequirements(userRequest: string): Promise<ResourceDefinition[]> {
        const resources: ResourceDefinition[] = [];
        const request = userRequest.toLowerCase();

        // Networking
        if (request.includes('vpc') || request.includes('network') || request.includes('infrastructure')) {
            resources.push({ type: 'networking', name: 'vpc', config: {} });
        }

        // Compute
        if (request.includes('ecs') || request.includes('container') || request.includes('fargate')) {
            resources.push({ type: 'container', name: 'ecs', config: {} });
        }

        if (request.includes('ec2') || request.includes('server') || request.includes('instance')) {
            resources.push({ type: 'compute', name: 'ec2', config: {} });
        }

        if (request.includes('lambda') || request.includes('serverless') || request.includes('function')) {
            resources.push({ type: 'serverless', name: 'lambda', config: {} });
        }

        // Database
        if (request.includes('rds') || request.includes('database') || request.includes('postgres')) {
            resources.push({ type: 'database', name: 'rds', config: {} });
        }

        if (request.includes('redis') || request.includes('cache') || request.includes('elasticache')) {
            resources.push({ type: 'database', name: 'elasticache', config: {} });
        }

        // Storage
        if (request.includes('s3') || request.includes('storage') || request.includes('bucket')) {
            resources.push({ type: 'storage', name: 's3', config: {} });
        }

        // Default: VPC + ECS + RDS
        if (resources.length === 0) {
            resources.push({ type: 'networking', name: 'vpc', config: {} });
            resources.push({ type: 'container', name: 'ecs', config: {} });
            resources.push({ type: 'database', name: 'rds', config: {} });
        }

        return resources;
    }

    /**
     * Generate Terraform configuration
     */
    generateTerraformMain(): string {
        return TERRAFORM_MAIN_AWS
            .replace(/\{\{stateBucket\}\}/g, `${ this.config.environment } -terraform - state`)
            .replace(/\{\{stateKey\}\}/g, 'terraform.tfstate')
            .replace(/\{\{region\}\}/g, this.config.region);
    }

    generateTerraformVPC(): string {
        return TERRAFORM_VPC;
    }

    generateTerraformECS(): string {
        return TERRAFORM_ECS;
    }

    generateTerraformRDS(): string {
        return TERRAFORM_RDS;
    }

    generateTerraformVariables(): string {
        return TERRAFORM_VARIABLES;
    }

    generateTerraformOutputs(): string {
        return TERRAFORM_OUTPUTS;
    }

    /**
     * Generate all infrastructure files
     */
    async generate(userRequest: string): Promise<InfraGenerationResult> {
        const resources = await this.analyzeRequirements(userRequest);
        const files: InfraGeneratedFile[] = [];

        // Main Terraform config
        files.push({
            path: 'terraform/main.tf',
            content: this.generateTerraformMain(),
            type: 'terraform',
        });

        // Variables
        files.push({
            path: 'terraform/variables.tf',
            content: this.generateTerraformVariables(),
            type: 'variables',
        });

        // Outputs
        files.push({
            path: 'terraform/outputs.tf',
            content: this.generateTerraformOutputs(),
            type: 'outputs',
        });

        // Resource-specific files
        for (const resource of resources) {
            switch (resource.name) {
                case 'vpc':
                    files.push({
                        path: 'terraform/vpc.tf',
                        content: this.generateTerraformVPC(),
                        type: 'terraform',
                    });
                    break;
                case 'ecs':
                    files.push({
                        path: 'terraform/ecs.tf',
                        content: this.generateTerraformECS(),
                        type: 'terraform',
                    });
                    break;
                case 'rds':
                    files.push({
                        path: 'terraform/rds.tf',
                        content: this.generateTerraformRDS(),
                        type: 'terraform',
                    });
                    break;
            }
        }

        // Environment-specific tfvars
        files.push({
            path: `terraform / environments / ${ this.config.environment }.tfvars`,
            content: `# ${ this.config.environment } environment variables\naws_region = "${this.config.region}"\nenvironment = "${this.config.environment}"\nproject_name = "myapp"\n`,
            type: 'config',
        });

        return {
            success: true,
            files,
            resources: resources.map(r => r.name),
            provider: this.config.provider,
            iacTool: this.config.iacTool,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let infraAgent: InfraAgent | null = null;

export function getInfraAgent(): InfraAgent {
    if (!infraAgent) {
        infraAgent = new InfraAgent();
    }
    return infraAgent;
}

export const infraAgentInstance = getInfraAgent();
export default infraAgentInstance;
