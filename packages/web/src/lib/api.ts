import type {
  AgentsResponse,
  Capabilities,
  CustomAgent,
  CustomAgentInput,
  PluginContextResponse,
  AuthTokens,
  ChatResponse,
  DeepHealth,
  DeploymentStatus,
  ExecuteRequest,
  ExecuteResponse,
  LearningStats,
  OutputDetail,
  OutputsResponse,
  PluginCatalogResponse,
  PluginConfigItem,
  PluginTestResponse,
  PluginValidateResponse,
  StatusResponse,
  User,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

const TOKEN_KEY = "meteoroid.auth";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function readTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: AuthTokens | null) {
  try {
    if (tokens) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); session lasts for this tab only.
  }
  window.dispatchEvent(new Event("meteoroid:auth"));
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const current = readTokens();
  if (!current?.refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        writeTokens(null);
        return false;
      }
      const data = (await res.json()) as AuthTokens;
      writeTokens({ ...current, ...data, expiresAt: Date.now() + data.expiresIn * 1000 });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

let csrf: { token: string; expiresAt: number } | null = null;

/**
 * Anonymous mutating requests to CSRF-protected routes need a token; Bearer requests skip CSRF server-side.
 */
async function csrfToken(): Promise<string | null> {
  if (csrf && csrf.expiresAt > Date.now()) return csrf.token;
  try {
    const res = await fetch(`${API_URL}/api/v1/csrf-token`);
    if (!res.ok) return null;
    const data = (await res.json()) as { csrfToken: string; expiresIn: number };
    csrf = { token: data.csrfToken, expiresAt: Date.now() + (data.expiresIn - 60) * 1000 };
    return csrf.token;
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const err = b.error;
    if (typeof b.message === "string" && b.message) return b.message;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
  }
  if (status === 0) return "Can’t reach the API. Check that the server is running.";
  return `Request failed with status ${status}`;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
}

export async function request<T>(path: string, { body, auth = true, headers, ...init }: RequestOptions = {}): Promise<T> {
  const mutating = !!init.method && init.method !== "GET";
  const send = async () => {
    const tokens = auth ? readTokens() : null;
    const csrfHeader = mutating && !tokens?.accessToken ? await csrfToken() : null;
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        ...(csrfHeader ? { "X-CSRF-Token": csrfHeader } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && auth && readTokens() && (await refreshTokens())) {
      res = await send();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(errorMessage(null, 0), 0);
  }

  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data);
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthTokens & { user: User }>("/api/v1/auth/login", { method: "POST", body: { email, password }, auth: false }),
  signup: (email: string, password: string, name?: string) =>
    request<{ success: boolean; message: string }>("/api/v1/auth/signup", {
      method: "POST",
      body: { email, password, name },
      auth: false,
    }),
  logout: () => request<{ success: boolean }>("/api/v1/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/v1/auth/me"),

  execute: (body: ExecuteRequest, signal?: AbortSignal) =>
    request<ExecuteResponse>("/api/v1/orchestrator/execute", { method: "POST", body, signal }),
  streamTicket: (projectId: string) =>
    request<{ ticket: string; expiresIn: number }>("/api/v1/events/tickets", { method: "POST", body: { projectId } }),
  capabilities: () => request<Capabilities>("/api/v1/orchestrator/capabilities", { auth: false }),
  chat: (message: string, options: { signal?: AbortSignal; systemPrompt?: string } = {}) =>
    request<ChatResponse>("/api/v1/orchestrator/chat", {
      method: "POST",
      body: { message, systemPrompt: options.systemPrompt },
      signal: options.signal,
    }),

  outputs: () => request<OutputsResponse>("/api/v1/outputs"),
  output: (projectId: string) => request<OutputDetail>(`/api/v1/outputs/${encodeURIComponent(projectId)}`),
  deleteOutput: (projectId: string) =>
    request<{ success: boolean }>(`/api/v1/outputs/${encodeURIComponent(projectId)}`, { method: "DELETE" }),
  downloadUrl: (projectId: string) => `${API_URL}/api/v1/outputs/${encodeURIComponent(projectId)}/download`,

  agents: () => request<AgentsResponse>("/api/v1/agents", { auth: false }),
  pluginCatalog: () => request<PluginCatalogResponse>("/api/v1/plugins/catalog", { auth: false }),
  validatePlugins: (plugins: PluginConfigItem[]) =>
    request<PluginValidateResponse>("/api/v1/plugins/validate", { method: "POST", body: { plugins } }),
  pluginContext: (plugins: PluginConfigItem[]) =>
    request<PluginContextResponse>("/api/v1/plugins/context", { method: "POST", body: { plugins } }),
  customAgents: () => request<{ agents: CustomAgent[] }>("/api/v1/custom-agents"),
  createCustomAgent: (agent: CustomAgentInput) =>
    request<{ agent: CustomAgent }>("/api/v1/custom-agents", { method: "POST", body: agent }),
  updateCustomAgent: (id: string, agent: CustomAgentInput) =>
    request<{ agent: CustomAgent }>(`/api/v1/custom-agents/${encodeURIComponent(id)}`, { method: "PUT", body: agent }),
  deleteCustomAgent: (id: string) =>
    request<{ success: boolean }>(`/api/v1/custom-agents/${encodeURIComponent(id)}`, { method: "DELETE" }),
  testPlugins: (plugins: PluginConfigItem[]) =>
    request<PluginTestResponse>("/api/v1/plugins/test", { method: "POST", body: { plugins } }),

  health: () => request<{ status: string; uptime: number; version: string }>("/health", { auth: false }),
  deepHealth: () => request<DeepHealth>("/health/deep", { auth: false }),
  status: () => request<StatusResponse>("/status", { auth: false }),
  learningStats: () => request<LearningStats>("/api/v1/orchestrator/learning/stats", { auth: false }),
  deploymentStatus: () => request<DeploymentStatus>("/api/v1/deployments/status", { auth: false }),
};

/**
 * Fetch a binary download with the auth header and hand it to the browser.
 */
export async function downloadFile(url: string, filename: string) {
  const tokens = readTokens();
  const res = await fetch(url, {
    headers: tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(`Download failed with status ${res.status}`, res.status);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
