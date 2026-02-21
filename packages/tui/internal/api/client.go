package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client handles all HTTP communication with the Meteoroid backend
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new API client with extended timeout for long generations
func NewClient(baseURL string, port string) *Client {
	return &Client{
		baseURL: fmt.Sprintf("%s:%s", baseURL, port),
		httpClient: &http.Client{
			Timeout: 600 * time.Second, // 10 minutes for long AI generations
		},
	}
}

// ---- Request / Response Types ------------------------------------------------

// ExecuteRequest is sent to POST /api/v1/orchestrator/execute
type ExecuteRequest struct {
	Prompt       string             `json:"prompt"`
	ProjectID    string             `json:"projectId,omitempty"`
	UserID       string             `json:"userId,omitempty"`
	Config       *ExecuteConfig     `json:"config,omitempty"`
	Context      *ExecuteContext    `json:"context,omitempty"`
	PluginConfig []PluginConfigItem `json:"pluginConfig,omitempty"`
}

type ExecuteConfig struct {
	UseAIThinking     bool `json:"useAIThinking"`
	UseContextManager bool `json:"useContextManager"`
	UseAgentMonitor   bool `json:"useAgentMonitor"`
	UseMCPHub         bool `json:"useMCPHub"`
	MaxSubtasks       int  `json:"maxSubtasks"`
}

type ExecuteContext struct {
	Language  string   `json:"language,omitempty"`
	Framework string   `json:"framework,omitempty"`
	TechStack []string `json:"techStack,omitempty"`
}

// PluginConfigItem represents a single plugin's configuration sent to the backend
type PluginConfigItem struct {
	PluginID string            `json:"pluginId,omitempty"`
	Name     string            `json:"name"`
	Category string            `json:"category"`
	Config   map[string]string `json:"config"`
}

// ExecuteResponse is the orchestrator response
type ExecuteResponse struct {
	Success        bool            `json:"success"`
	TaskID         string          `json:"taskId"`
	ProjectID      string          `json:"projectId"`
	TotalDuration  float64         `json:"totalDuration"`
	Steps          int             `json:"steps"`
	AgentsExecuted []string        `json:"agentsExecuted"`
	GeneratedCode  []GeneratedCode `json:"generatedCode"`
	IntentAnalysis *IntentAnalysis `json:"intentAnalysis,omitempty"`
	VectorUsed     bool            `json:"vectorLearningUsed"`
	IsQuestion     bool            `json:"isQuestion"`
	Answer         string          `json:"answer,omitempty"`
	Errors         []string        `json:"errors"`
	// Phase 28: Plugin awareness
	PluginsUsed []string          `json:"pluginsUsed,omitempty"`
	PluginCount int               `json:"pluginCount"`
	ContextTree []ContextTreeNode `json:"contextTree,omitempty"`
}

type GeneratedCode struct {
	Subtask     string `json:"subtask"`
	Code        string `json:"code"`
	Explanation string `json:"explanation"`
	Agent       string `json:"agent"`
}

type IntentAnalysis struct {
	Intent     string  `json:"intent"`
	Confidence float64 `json:"confidence"`
	Language   string  `json:"language"`
	Framework  string  `json:"framework"`
	Reasoning  string  `json:"reasoning"`
}

// ContextTreeNode represents a node in the context visualization tree
type ContextTreeNode struct {
	Label    string            `json:"label"`
	Tag      string            `json:"tag"`
	Size     string            `json:"size"`
	Summary  string            `json:"summary"`
	Children []ContextTreeNode `json:"children,omitempty"`
}

// ---- Plugin API Types -------------------------------------------------------

// PluginCatalogResponse from GET /api/v1/plugins/catalog
type PluginCatalogResponse struct {
	Success      bool                          `json:"success"`
	Catalog      map[string][]PluginDefinition `json:"catalog"`
	TotalPlugins int                           `json:"totalPlugins"`
}

type PluginDefinition struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	Category       string        `json:"category"`
	Description    string        `json:"description"`
	Fields         []PluginField `json:"fields"`
	Tags           []string      `json:"tags"`
	ConnectionTest string        `json:"connectionTest"`
}

type PluginField struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Type        string `json:"type"`
	Required    bool   `json:"required"`
	Placeholder string `json:"placeholder,omitempty"`
}

// PluginValidateResponse from POST /api/v1/plugins/validate
type PluginValidateResponse struct {
	Success bool                     `json:"success"`
	Valid   bool                     `json:"valid"`
	Results []PluginValidationResult `json:"results"`
}

type PluginValidationResult struct {
	PluginID string   `json:"pluginId"`
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// PluginTestResponse from POST /api/v1/plugins/test
type PluginTestResponse struct {
	Success bool                     `json:"success"`
	Results []PluginConnectionResult `json:"results"`
}

type PluginConnectionResult struct {
	PluginID  string `json:"pluginId"`
	Reachable bool   `json:"reachable"`
	LatencyMs int    `json:"latencyMs"`
	Error     string `json:"error,omitempty"`
	Details   string `json:"details,omitempty"`
}

// ChatRequest is sent to POST /api/v1/orchestrator/chat
type ChatRequest struct {
	Message      string  `json:"message"`
	SystemPrompt string  `json:"systemPrompt,omitempty"`
	Temperature  float64 `json:"temperature,omitempty"`
	MaxTokens    int     `json:"maxTokens,omitempty"`
}

// ChatResponse is the direct chat response
type ChatResponse struct {
	Success  bool   `json:"success"`
	Response string `json:"response"`
	Model    string `json:"model"`
	Tokens   int    `json:"tokens"`
	Duration int    `json:"duration"`
}

// HealthResponse for GET /api/v1/health
type HealthResponse struct {
	Status    string  `json:"status"`
	Timestamp string  `json:"timestamp"`
	Uptime    float64 `json:"uptime"`
	Version   string  `json:"version"`
}

// ---- API Methods ------------------------------------------------------------

// CheckHealth pings the backend health endpoint
func (c *Client) CheckHealth() (*HealthResponse, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/api/v1/health")
	if err != nil {
		return nil, fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()

	var h HealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&h); err != nil {
		return nil, fmt.Errorf("invalid response: %w", err)
	}
	return &h, nil
}

// Execute sends a prompt to the orchestrator for full AI code generation
func (c *Client) Execute(req *ExecuteRequest) (*ExecuteResponse, error) {
	body, _ := json.Marshal(req)

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/orchestrator/execute",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	var result ExecuteResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w (body: %s)", err, string(raw[:min(len(raw), 200)]))
	}
	return &result, nil
}

// Chat sends a direct message to the AI (no orchestration)
func (c *Client) Chat(req *ChatRequest) (*ChatResponse, error) {
	body, _ := json.Marshal(req)

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/orchestrator/chat",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	var result ChatResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}
	return &result, nil
}

// ---- Plugin API Methods -----------------------------------------------------

// GetPluginCatalog fetches the full plugin catalog from the backend
func (c *Client) GetPluginCatalog() (*PluginCatalogResponse, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/api/v1/plugins/catalog")
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	var result PluginCatalogResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}
	return &result, nil
}

// ValidatePlugins validates plugin configurations with the backend
func (c *Client) ValidatePlugins(plugins []PluginConfigItem) (*PluginValidateResponse, error) {
	payload := map[string]interface{}{"plugins": plugins}
	body, _ := json.Marshal(payload)

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/plugins/validate",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result PluginValidateResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}
	return &result, nil
}

// TestPluginConnections tests connectivity to plugin services
func (c *Client) TestPluginConnections(plugins []PluginConfigItem) (*PluginTestResponse, error) {
	payload := map[string]interface{}{"plugins": plugins}
	body, _ := json.Marshal(payload)

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/plugins/test",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var result PluginTestResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}
	return &result, nil
}
