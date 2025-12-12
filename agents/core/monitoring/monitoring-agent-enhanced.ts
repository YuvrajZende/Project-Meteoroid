/**
 * ============================================
 * MONITORING AGENT ENHANCED
 * ============================================
 * 
 * Enhanced Monitoring Agent with:
 * - Brain integration for intelligent monitoring
 * - Self-correction capabilities
 * - Automatic observability recommendations
 * - Context-aware logging generation
 * - Integration with Health Monitor
 * 
 * @author LOVEABLE Backend Orchestrator
 * @version 1.0.0
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
    MonitoringAgent,
    MonitoringConfig,
    MonitoringGenerationResult,
    MonitoringScanResult,
    MonitoringIssue,
    GeneratedMonitoringFile,
} from "./monitoring-agent.js";

// ============================================
// TYPES & INTERFACES
// ============================================

/**
 * Analysis result for existing monitoring setup
 */
export interface MonitoringAnalysisResult {
    existing: {
        hasAPM: boolean;
        apmProvider?: string;
        hasErrorTracking: boolean;
        errorProvider?: string;
        hasMetrics: boolean;
        metricsProvider?: string;
        hasHealthChecks: boolean;
        hasLogging: boolean;
        loggingProvider?: string;
        hasTracing: boolean;
        hasAlerting: boolean;
        hasAuditLogging: boolean;
    };
    gaps: string[];
    recommendations: MonitoringRecommendation[];
    score: number;
}

export interface MonitoringRecommendation {
    area: string;
    priority: "high" | "medium" | "low";
    description: string;
    implementation: string;
    dependencies?: string[];
}

/**
 * Self-correction record
 */
export interface CorrectionRecord {
    timestamp: Date;
    issue: string;
    correction: string;
    applied: boolean;
}

/**
 * Tool call interface for brain integration
 */
export interface MonitoringToolCall {
    tool: "analyzeProject" | "generateConfig" | "validateSetup" | "recommendImprovements";
    args: Record<string, unknown>;
    result?: unknown;
}

// ============================================
// ENHANCED MONITORING AGENT CLASS
// ============================================

export class MonitoringAgentEnhanced extends MonitoringAgent {
    private llm: ChatOpenAI;
    private corrections: CorrectionRecord[] = [];
    private toolCalls: MonitoringToolCall[] = [];

    constructor() {
        super();
        this.llm = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
            temperature: 0.3,
        });
    }

    // ============================================
    // BRAIN INTEGRATION METHODS
    // ============================================

    /**
     * Analyze requirements using LLM for intelligent recommendations
     */
    async analyzeRequirements(projectDescription: string): Promise<{
        config: MonitoringConfig;
        reasoning: string;
        confidence: number;
    }> {
        console.log("🧠 MonitoringAgentEnhanced: Analyzing requirements...");

        const systemPrompt = `You are an expert in observability and monitoring systems.
Analyze the project requirements and recommend the optimal monitoring configuration.

Consider:
1. Project scale (small/medium/large)
2. Deployment environment (development/staging/production)
3. Team expertise level
4. Budget constraints
5. Compliance requirements

Return a JSON object with:
- apmProvider: "datadog" | "newrelic" | "elastic" | "none"
- errorTracking: "sentry" | "rollbar" | "datadog" | "none"
- logging: "winston" | "pino" | "bunyan"
- metricsProvider: "prometheus" | "datadog" | "statsd"
- healthChecksEnabled: boolean
- tracingEnabled: boolean
- alertingEnabled: boolean
- auditLoggingEnabled: boolean
- reasoning: string explaining your choices
- confidence: number 0-1`;

        const response = await this.llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(`Project requirements: ${projectDescription}`),
        ]);

        try {
            const content = response.content as string;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

            return {
                config: {
                    apmProvider: result?.apmProvider || "datadog",
                    errorTracking: result?.errorTracking || "sentry",
                    logging: result?.logging || "winston",
                    metrics: result?.metricsProvider ? {
                        enabled: true,
                        provider: result.metricsProvider,
                    } : { enabled: true, provider: "prometheus" },
                    healthChecks: {
                        enabled: result?.healthChecksEnabled ?? true,
                    },
                    tracing: result?.tracingEnabled ?? true,
                    alerting: result?.alertingEnabled ? {
                        enabled: true,
                        channels: [],
                        thresholds: [],
                    } : undefined,
                    auditLogging: result?.auditLoggingEnabled ? {
                        enabled: true,
                        storage: "database",
                        events: ["auth.login", "auth.logout", "data.created", "data.updated", "data.deleted"],
                    } : undefined,
                },
                reasoning: result?.reasoning || "Default monitoring configuration recommended",
                confidence: result?.confidence ?? 0.7,
            };
        } catch {
            return {
                config: {
                    apmProvider: "datadog",
                    errorTracking: "sentry",
                    logging: "winston",
                    metrics: { enabled: true, provider: "prometheus" },
                    healthChecks: { enabled: true },
                    tracing: true,
                },
                reasoning: "Unable to parse LLM response, using defaults",
                confidence: 0.5,
            };
        }
    }

    /**
     * Generate monitoring with self-correction capabilities
     */
    async generateWithCorrection(
        config: MonitoringConfig,
        maxAttempts: number = 3
    ): Promise<MonitoringGenerationResult> {
        let result = await this.generateMonitoringSystem(config);
        let attempt = 1;

        while (attempt < maxAttempts) {
            const issues = await this.validateGeneration(result);

            if (issues.length === 0) {
                console.log(`✅ Generation passed validation on attempt ${attempt}`);
                break;
            }

            console.log(`⚠️ Found ${issues.length} issues, self-correcting (attempt ${attempt + 1})...`);

            // Record correction
            this.corrections.push({
                timestamp: new Date(),
                issue: issues.map(i => i.description).join("; "),
                correction: "Regenerating with fixes",
                applied: true,
            });

            // Attempt correction
            result = await this.correctGeneration(result, issues);
            attempt++;
        }

        return result;
    }

    /**
     * Validate generated monitoring code
     */
    private async validateGeneration(result: MonitoringGenerationResult): Promise<MonitoringIssue[]> {
        const issues: MonitoringIssue[] = [];

        for (const file of result.files) {
            // Check for common issues
            if (!file.content.includes("import")) {
                issues.push({
                    type: "missing",
                    severity: "high",
                    description: `File ${file.path} is missing imports`,
                    file: file.path,
                    recommendation: "Add required imports at the top of the file",
                });
            }

            // Check for error handling
            if (file.content.includes("async") && !file.content.includes("try")) {
                issues.push({
                    type: "misconfigured",
                    severity: "medium",
                    description: `File ${file.path} has async code without try/catch`,
                    file: file.path,
                    recommendation: "Add proper error handling with try/catch blocks",
                });
            }

            // Check for TypeScript types
            if (!file.content.includes(": string") && !file.content.includes(": number") && !file.content.includes("interface")) {
                issues.push({
                    type: "misconfigured",
                    severity: "low",
                    description: `File ${file.path} may be missing TypeScript types`,
                    file: file.path,
                    recommendation: "Add explicit TypeScript type annotations",
                });
            }
        }

        return issues;
    }

    /**
     * Correct generation based on issues
     */
    private async correctGeneration(
        result: MonitoringGenerationResult,
        issues: MonitoringIssue[]
    ): Promise<MonitoringGenerationResult> {
        // Apply corrections to affected files
        const correctedFiles = result.files.map(file => {
            const fileIssues = issues.filter(i => i.file === file.path);

            if (fileIssues.length === 0) {
                return file;
            }

            let content = file.content;

            // Add missing imports if needed
            if (fileIssues.some(i => i.description.includes("missing imports"))) {
                if (!content.startsWith("import")) {
                    content = `// Auto-corrected imports\nimport { Request, Response, NextFunction } from 'express';\n\n${content}`;
                }
            }

            // Add error handling if needed
            if (fileIssues.some(i => i.description.includes("try/catch"))) {
                // This would be more sophisticated in production
                content = content.replace(
                    /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g,
                    (match) => `${match}\n  try {`
                );
            }

            return { ...file, content };
        });

        return { ...result, files: correctedFiles };
    }

    // ============================================
    // TOOL CALLING METHODS
    // ============================================

    /**
     * Tool: Analyze existing project monitoring
     */
    async toolAnalyzeProject(projectPath: string): Promise<MonitoringAnalysisResult> {
        this.toolCalls.push({
            tool: "analyzeProject",
            args: { projectPath },
        });

        const scanResult = await this.analyzeMonitoring(projectPath);

        const analysis: MonitoringAnalysisResult = {
            existing: {
                hasAPM: false,
                hasErrorTracking: scanResult.hasErrorTracking,
                hasMetrics: scanResult.hasMetrics,
                hasHealthChecks: scanResult.hasHealthChecks,
                hasLogging: scanResult.hasLogging,
                hasTracing: scanResult.hasTracing,
                hasAlerting: false,
                hasAuditLogging: false,
            },
            gaps: [],
            recommendations: [],
            score: scanResult.score,
        };

        // Identify gaps
        if (!analysis.existing.hasAPM) {
            analysis.gaps.push("No APM solution detected");
            analysis.recommendations.push({
                area: "APM",
                priority: "high",
                description: "Add Application Performance Monitoring",
                implementation: "Use DATADOG_APM_TEMPLATE or implement New Relic/Elastic APM",
                dependencies: ["dd-trace"],
            });
        }

        if (!analysis.existing.hasErrorTracking) {
            analysis.gaps.push("No error tracking detected");
            analysis.recommendations.push({
                area: "Error Tracking",
                priority: "high",
                description: "Add error tracking for production debugging",
                implementation: "Use SENTRY_INTEGRATION_TEMPLATE",
                dependencies: ["@sentry/node", "@sentry/tracing"],
            });
        }

        if (!analysis.existing.hasHealthChecks) {
            analysis.gaps.push("No health check endpoints detected");
            analysis.recommendations.push({
                area: "Health Checks",
                priority: "high",
                description: "Add Kubernetes-compatible health endpoints",
                implementation: "Use HEALTH_CHECK_TEMPLATE",
                dependencies: [],
            });
        }

        if (!analysis.existing.hasMetrics) {
            analysis.gaps.push("No metrics collection detected");
            analysis.recommendations.push({
                area: "Metrics",
                priority: "medium",
                description: "Add metrics collection for performance insights",
                implementation: "Use METRICS_COLLECTION_TEMPLATE with Prometheus",
                dependencies: ["prom-client"],
            });
        }

        if (!analysis.existing.hasLogging) {
            analysis.gaps.push("No structured logging detected");
            analysis.recommendations.push({
                area: "Logging",
                priority: "medium",
                description: "Add structured JSON logging",
                implementation: "Use STRUCTURED_LOGGING_TEMPLATE with Winston",
                dependencies: ["winston", "winston-daily-rotate-file"],
            });
        }

        if (!analysis.existing.hasTracing) {
            analysis.gaps.push("No distributed tracing detected");
            analysis.recommendations.push({
                area: "Tracing",
                priority: "low",
                description: "Add distributed tracing for microservices debugging",
                implementation: "Use DISTRIBUTED_TRACING_TEMPLATE or OPENTELEMETRY_TEMPLATE",
                dependencies: ["@opentelemetry/api", "@opentelemetry/sdk-node"],
            });
        }

        this.toolCalls[this.toolCalls.length - 1].result = analysis;
        return analysis;
    }

    /**
     * Tool: Generate optimized config based on analysis
     */
    async toolGenerateConfig(analysis: MonitoringAnalysisResult): Promise<MonitoringConfig> {
        this.toolCalls.push({
            tool: "generateConfig",
            args: { analysis },
        });

        const config: MonitoringConfig = {};

        // Based on analysis, create optimal configuration
        for (const rec of analysis.recommendations) {
            switch (rec.area) {
                case "APM":
                    config.apmProvider = "datadog";
                    break;
                case "Error Tracking":
                    config.errorTracking = "sentry";
                    break;
                case "Metrics":
                    config.metrics = { enabled: true, provider: "prometheus" };
                    break;
                case "Health Checks":
                    config.healthChecks = { enabled: true };
                    break;
                case "Logging":
                    config.logging = "winston";
                    break;
                case "Tracing":
                    config.tracing = true;
                    break;
            }
        }

        this.toolCalls[this.toolCalls.length - 1].result = config;
        return config;
    }

    // ============================================
    // REPORTING METHODS
    // ============================================

    /**
     * Generate comprehensive monitoring report
     */
    async generateReport(projectPath: string): Promise<string> {
        const analysis = await this.toolAnalyzeProject(projectPath);

        const report = `
# 📊 Monitoring Analysis Report

## Current Status
- **Overall Score:** ${analysis.score}/100
- **APM:** ${analysis.existing.hasAPM ? "✅" : "❌"}
- **Error Tracking:** ${analysis.existing.hasErrorTracking ? "✅" : "❌"}
- **Metrics:** ${analysis.existing.hasMetrics ? "✅" : "❌"}
- **Health Checks:** ${analysis.existing.hasHealthChecks ? "✅" : "❌"}
- **Logging:** ${analysis.existing.hasLogging ? "✅" : "❌"}
- **Tracing:** ${analysis.existing.hasTracing ? "✅" : "❌"}
- **Alerting:** ${analysis.existing.hasAlerting ? "✅" : "❌"}
- **Audit Logging:** ${analysis.existing.hasAuditLogging ? "✅" : "❌"}

## Gaps Identified
${analysis.gaps.map(g => `- ${g}`).join("\n")}

## Recommendations
${analysis.recommendations.map(r => `
### ${r.area} (Priority: ${r.priority.toUpperCase()})
${r.description}

**Implementation:** ${r.implementation}
${r.dependencies?.length ? `**Dependencies:** ${r.dependencies.join(", ")}` : ""}
`).join("\n")}

---
*Generated by MonitoringAgentEnhanced @ ${new Date().toISOString()}*
`;

        return report;
    }

    /**
     * Get correction history
     */
    getCorrections(): CorrectionRecord[] {
        return [...this.corrections];
    }

    /**
     * Get tool call history
     */
    getToolCalls(): MonitoringToolCall[] {
        return [...this.toolCalls];
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const monitoringAgentEnhanced = new MonitoringAgentEnhanced();
