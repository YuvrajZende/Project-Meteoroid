export interface User {
  id: string;
  email: string;
  name?: string | null;
  tier?: string;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt?: number;
  user?: User;
}

export interface ExecuteRequest {
  prompt: string;
  projectId?: string;
  config?: {
    useAIThinking?: boolean;
    useContextManager?: boolean;
    useAgentMonitor?: boolean;
    useMCPHub?: boolean;
    useWebSearch?: boolean;
    demo?: boolean;
    maxSubtasks?: number;
  };
  context?: {
    language?: string;
    framework?: string;
    techStack?: string[];
  };
  pluginConfig?: PluginConfigItem[];
  /** Custom agent IDs to allocate subtasks to */
  agents?: string[];
}

export interface GeneratedCode {
  subtask: string;
  code: string;
  explanation: string;
  agent: string;
}

export interface IntentAnalysis {
  intent: string;
  confidence: number;
  language: string;
  framework: string;
  reasoning: string;
}

export interface ExecuteResponse {
  success: boolean;
  taskId: string;
  projectId: string;
  totalDuration?: number;
  steps?: number;
  agentsExecuted?: string[];
  generatedCode?: GeneratedCode[];
  intentAnalysis?: IntentAnalysis;
  vectorLearningUsed?: boolean;
  pluginsUsed?: string[];
  filesWritten?: string[];
  isQuestion?: boolean;
  answer?: string;
  suggestion?: string;
  errors?: string[];
}

export interface ChatResponse {
  response: string;
  model: string;
  duration: number;
}

export interface OutputSummary {
  projectId: string;
  prompt: string | null;
  language: string | null;
  framework: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutputsResponse {
  success: boolean;
  projects: OutputSummary[];
  total: number;
}

export interface OutputFile {
  path: string;
  size: number;
  content: string | null;
  truncated: boolean;
}

export interface OutputDetail {
  success: boolean;
  projectId: string;
  meta: Partial<OutputSummary> & { taskId?: string; userId?: string };
  files: OutputFile[];
  totalSize: number;
}

export interface Agent {
  id: string;
  name: string;
  tier: number;
  capabilities: string[];
  description?: string;
  version?: string;
  status?: string;
}

export interface AgentsResponse {
  count: number;
  agents: Agent[];
}

export interface PluginField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: PluginField[];
  tags: string[];
  connectionTest?: string;
}

export interface PluginCatalogResponse {
  success: boolean;
  catalog: Record<string, PluginDefinition[]>;
  totalPlugins: number;
}

export interface PluginConfigItem {
  pluginId?: string;
  name: string;
  category: string;
  config: Record<string, string>;
}

export interface PluginValidateResponse {
  success: boolean;
  valid: boolean;
  results: { pluginId: string; valid: boolean; errors: string[]; warnings: string[] }[];
}

export interface PluginTestResponse {
  success: boolean;
  results: { pluginId: string; reachable: boolean; latencyMs: number; error?: string }[];
}

interface Check {
  status: string;
  latency?: number;
  error?: string;
}

export interface DeepHealth {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    supabase?: Check;
    vectorStore?: Check & { embeddingsCount?: number };
    redis?: Check;
    agents?: { status: string; loaded: number; total: number };
  };
}

export interface StatusResponse {
  name: string;
  version: string;
  environment: string;
  uptime: number;
  memory: { used: number; total: number; percentage: number };
  agents: { loaded: number; capabilities: string[] };
}

export interface LearningStats {
  success: boolean;
  learning?: {
    totalIterations: number;
    successfulIterations: number;
    failedIterations: number;
    patternsLearned: number;
    successRate: number;
  };
}

export interface DeploymentStatus {
  success: boolean;
  data: { configured: boolean; providers: string[]; github: { configured: boolean } };
}

export const AGENT_COLORS = ["ember", "blue", "green", "amber", "violet", "pink", "teal", "gray"] as const;
export type AgentColor = (typeof AGENT_COLORS)[number];

export interface CustomAgentInput {
  name: string;
  role: string;
  instructions: string;
  capabilities: string[];
  useWebSearch: boolean;
  color: AgentColor;
}

export interface CustomAgent extends CustomAgentInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginContextResponse {
  success: boolean;
  context: {
    systemPromptSection: string;
    techStack: string[];
    envVars: Record<string, string>;
    packages: Record<string, string[]>;
  };
}

export interface Capabilities {
  /** Set when every model call goes through one OpenRouter key */
  gateway: "openrouter" | null;
  webSearch: "tavily" | "brave" | null;
  models: Record<"fast" | "power", { id: string; name: string; provider: string; configured: boolean }>;
}

interface ActivityBase {
  projectId?: string;
  taskId?: string;
  timestamp: string;
}

export type ActivityEvent = ActivityBase &
  (
    | { kind: "thinking"; status: "start" | "end"; summary?: string; complexity?: string; durationMs?: number }
    | { kind: "plan"; subtasks: { id: number; title: string; agent: string }[] }
    | {
        kind: "tool";
        id: string;
        tool: "web_search";
        status: "running" | "done" | "error";
        query: string;
        results?: { title: string; url: string }[];
        error?: string;
        durationMs?: number;
      }
    | { kind: "agent"; id: number; agent: string; status: "running" | "done" | "failed"; files?: number; error?: string; durationMs?: number }
  );

export interface PipelineEvent {
  type: "pipelineStep" | "fileWritten";
  projectId?: string;
  taskId?: string;
  stepNumber?: number;
  phase?: string;
  agent?: string;
  message?: string;
  filePath?: string;
  size?: number;
  /** Inline contents for small files, streamed while the run is in flight */
  content?: string;
  timestamp: string;
}
