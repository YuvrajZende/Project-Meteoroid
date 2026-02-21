package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Event types from backend
const (
	EventConnected     = "connected"
	EventTaskUpdate    = "taskUpdate"
	EventAgentProgress = "agentProgress"
	EventFileWritten   = "fileWritten"
	EventPipelineStep  = "pipelineStep"
	EventOrchestrator  = "orchestrator"
	EventError         = "error"
	EventComplete      = "complete"
)

// TaskUpdateEvent represents a task status update
type TaskUpdateEvent struct {
	TaskID    string                 `json:"taskId"`
	Status    string                 `json:"status"`
	Progress  int                    `json:"progress"`
	Message   string                 `json:"message"`
	Phase     string                 `json:"phase"`
	StepNum   int                    `json:"stepNumber"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp string                 `json:"timestamp"`
}

// FileWrittenEvent represents a file being written
type FileWrittenEvent struct {
	ProjectID string `json:"projectId"`
	FilePath  string `json:"filePath"`
	Size      int    `json:"size"`
	Timestamp string `json:"timestamp"`
}

// AgentProgressEvent represents agent execution progress
type AgentProgressEvent struct {
	AgentID   string `json:"agentId"`
	Progress  int    `json:"progress"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

// PipelineStepEvent represents a pipeline step completion
type PipelineStepEvent struct {
	StepNumber int    `json:"stepNumber"`
	Phase      string `json:"phase"`
	Message    string `json:"message"`
	Timestamp  string `json:"timestamp"`
}

// SSEEvent represents a server-sent event (generic)
type SSEEvent struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// SSEClient handles Server-Sent Events connections with auto-reconnect
type SSEClient struct {
	baseURL      string
	httpClient   *http.Client
	mu           sync.RWMutex
	connected    bool
	stopChan     chan struct{}
	reconnecting bool
	endpoint     string

	// Event channels for BubbleTea integration
	PipelineStepChan  chan PipelineStepEvent
	TaskUpdateChan    chan TaskUpdateEvent
	FileWrittenChan   chan FileWrittenEvent
	AgentProgressChan chan AgentProgressEvent
	ConnectedChan     chan bool
}

// NewSSEClient creates a new SSE client with event channels
func NewSSEClient(baseURL string) *SSEClient {
	return &SSEClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 0,
		},
		stopChan:          make(chan struct{}),
		PipelineStepChan:  make(chan PipelineStepEvent, 100),
		TaskUpdateChan:    make(chan TaskUpdateEvent, 100),
		FileWrittenChan:   make(chan FileWrittenEvent, 100),
		AgentProgressChan: make(chan AgentProgressEvent, 100),
		ConnectedChan:     make(chan bool, 10),
	}
}

// Connect establishes SSE connection
func (c *SSEClient) Connect(endpoint string) error {
	url := c.baseURL + endpoint
	c.endpoint = endpoint

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Connection", "keep-alive")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}

	if resp.StatusCode != 200 {
		resp.Body.Close()
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	c.mu.Lock()
	c.connected = true
	c.reconnecting = false
	c.mu.Unlock()

	// Signal connection
	select {
	case c.ConnectedChan <- true:
	default:
	}

	go c.readStream(resp.Body)

	return nil
}

// ConnectWithReconnect connects with auto-reconnect
func (c *SSEClient) ConnectWithReconnect(endpoint string) error {
	c.endpoint = endpoint

	if err := c.Connect(endpoint); err != nil {
		return err
	}

	// Start reconnection goroutine
	go func() {
		for {
			select {
			case <-c.stopChan:
				return
			default:
			}

			time.Sleep(1 * time.Second)

			c.mu.RLock()
			connected := c.connected
			reconnecting := c.reconnecting
			c.mu.RUnlock()

			if !connected && !reconnecting {
				c.mu.Lock()
				c.reconnecting = true
				c.mu.Unlock()

				time.Sleep(2 * time.Second)
				c.Connect(c.endpoint)
			}
		}
	}()

	return nil
}

// ConnectToAll connects to global events with auto-reconnect
func (c *SSEClient) ConnectToAll() error {
	return c.ConnectWithReconnect("/api/v1/events")
}

// readStream reads SSE events and dispatches to channels
func (c *SSEClient) readStream(body io.ReadCloser) {
	defer body.Close()

	scanner := bufio.NewScanner(body)
	var eventType string
	var eventData strings.Builder

	for scanner.Scan() {
		select {
		case <-c.stopChan:
			return
		default:
		}

		line := scanner.Text()

		if len(line) == 0 {
			if eventType != "" && eventData.Len() > 0 {
				c.dispatchEvent(eventType, eventData.String())
			}
			eventType = ""
			eventData.Reset()
			continue
		}

		if strings.HasPrefix(line, "event:") {
			eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "data:") {
			data := strings.TrimPrefix(line, "data:")
			if eventData.Len() > 0 {
				eventData.WriteString("\n")
			}
			eventData.WriteString(data)
		}
	}

	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()

	// Signal disconnection
	select {
	case c.ConnectedChan <- false:
	default:
	}
}

// dispatchEvent parses and sends events to appropriate channels
func (c *SSEClient) dispatchEvent(eventType, data string) {
	switch eventType {
	case EventPipelineStep:
		var evt PipelineStepEvent
		if err := json.Unmarshal([]byte(data), &evt); err == nil {
			select {
			case c.PipelineStepChan <- evt:
			default:
			}
		}
	case EventTaskUpdate:
		var evt TaskUpdateEvent
		if err := json.Unmarshal([]byte(data), &evt); err == nil {
			select {
			case c.TaskUpdateChan <- evt:
			default:
			}
		}
	case EventFileWritten:
		var evt FileWrittenEvent
		if err := json.Unmarshal([]byte(data), &evt); err == nil {
			select {
			case c.FileWrittenChan <- evt:
			default:
			}
		}
	case EventAgentProgress:
		var evt AgentProgressEvent
		if err := json.Unmarshal([]byte(data), &evt); err == nil {
			select {
			case c.AgentProgressChan <- evt:
			default:
			}
		}
	}
}

// IsConnected returns connection status
func (c *SSEClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// Close stops the SSE client
func (c *SSEClient) Close() {
	close(c.stopChan)
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
}
