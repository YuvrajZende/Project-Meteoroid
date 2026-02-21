package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"meteoroid/internal/api"
	"meteoroid/internal/config"
	"meteoroid/internal/theme"
)

// --- Messages ---

type healthResultMsg struct {
	healthy bool
	version string
	err     error
}
type executeResultMsg struct {
	resp *api.ExecuteResponse
	err  error
}
type chatResultMsg struct {
	resp *api.ChatResponse
	err  error
}
type bootTickMsg time.Time
type pipelineTickMsg time.Time

// SSE messages for real-time updates
type sseConnectedMsg struct{}
type sseDisconnectedMsg struct{}
type ssePipelineStepMsg struct {
	event api.PipelineStepEvent
}
type sseTaskUpdateMsg struct {
	event api.TaskUpdateEvent
}
type sseFileWrittenMsg struct {
	event api.FileWrittenEvent
}
type sseAgentProgressMsg struct {
	event api.AgentProgressEvent
}

// --- Boot ---

type bootPhase int

const (
	bootLogo bootPhase = iota
	bootSub
	bootS1
	bootS2
	bootS3
	bootS4
	bootS5
	bootReady
	bootDone
)

var bootSteps = []string{
	"Initializing core systems",
	"Loading AI orchestration engine",
	"Connecting vector learning store",
	"Preparing agent registry",
	"Bootstrapping context manager",
}

var pipelinePhases = []string{
	"Analyzing intent", "Building context", "Vector learning search",
	"Injecting context", "Selecting agents", "AI thinking",
	"Generating code", "Parsing & validating", "Assembling output",
}

// --- Context Tree ---

type ContextNode struct {
	Label    string
	Tag      string
	Size     string
	Summary  string
	Children []ContextNode
}

func dummyContextTree() []ContextNode {
	return []ContextNode{
		{Label: "Intent Analysis", Tag: "INTENT", Size: "1.2 KB",
			Summary: "AI classified this as a code generation request.\nLanguage: TypeScript | Framework: Fastify | Confidence: 95%"},
		{Label: "Vector Learning Context", Tag: "VECTOR", Size: "3.8 KB",
			Summary: "5 similar projects matched from knowledge base.\n10 best practices loaded for REST API patterns."},
		{Label: "Active Plugin Context", Tag: "PLUGINS", Size: "0.9 KB",
			Summary: "Injecting connection patterns and auth middleware config.",
			Children: []ContextNode{
				{Label: "Supabase", Tag: "db", Size: "0.5 KB", Summary: "PostgreSQL connection, row-level security, realtime."},
				{Label: "JWT Auth", Tag: "sec", Size: "0.4 KB", Summary: "Token signing, verification, refresh rotation."},
			}},
		{Label: "Agent Selection & Execution", Tag: "AGENTS", Size: "0.4 KB",
			Summary: "Selected: CodeGenerator, FileWriter, TestRunner\n3 agents queued for sequential pipeline execution."},
		{Label: "Generated Output", Tag: "OUTPUT", Size: "12.6 KB",
			Summary: "3 files generated across routes, models, middleware.",
			Children: []ContextNode{
				{Label: "src/routes/users.ts", Tag: "file", Size: "4.2 KB", Summary: "CRUD endpoints with Zod validation and error handling."},
				{Label: "src/models/user.ts", Tag: "file", Size: "2.1 KB", Summary: "Supabase schema with TypeScript interfaces and types."},
				{Label: "src/middleware/auth.ts", Tag: "file", Size: "1.8 KB", Summary: "JWT verification and role-based access control guard."},
				{Label: "tests/users.test.ts", Tag: "file", Size: "3.9 KB", Summary: "Integration tests for all user CRUD operations."},
			}},
	}
}

// --- ChatEntry ---

type ChatEntry struct {
	Role      string            `json:"role"`
	Content   string            `json:"content"`
	Timestamp time.Time         `json:"timestamp"`
	Meta      map[string]string `json:"meta,omitempty"`
}

// --- Model ---

type Model struct {
	cfg    *config.Config
	client *api.Client
	sse    *api.SSEClient
	width  int
	height int
	ready  bool

	input    textinput.Model
	viewport viewport.Model
	spinner  spinner.Model

	booting  bool
	bootStep bootPhase
	bootDots int

	activeView string

	history       []ChatEntry
	loading       bool
	pipelinePhase int
	pipelineMsg   string
	connected     bool
	sseConnected  bool
	serverVersion string
	startTime     time.Time
	inputMode     string

	catalog        []PluginCategory
	pluginCatIdx   int
	pluginItemIdx  int
	enabledPlugins map[string]bool
	pluginConfigs  map[string]map[string]string

	// Config mode: entering credentials for a plugin
	configMode     bool
	configFieldIdx int

	lastResponse *api.ExecuteResponse
	contextTree  []ContextNode

	store      *Store
	sessions   []SavedSession
	historyIdx int

	// Real-time updates from SSE
	filesWritten  []string
	currentTaskID string
	pipelineSteps []string
	agentProgress map[string]int
}

func NewModel(cfg *config.Config) Model {
	ti := textinput.New()
	ti.Placeholder = "Describe what you want to build..."
	ti.CharLimit = 5000
	ti.Width = 80
	ti.PromptStyle = lipgloss.NewStyle().Foreground(theme.Purple).Bold(true)
	ti.Prompt = " > "
	ti.TextStyle = lipgloss.NewStyle().Foreground(theme.White)
	ti.PlaceholderStyle = lipgloss.NewStyle().Foreground(theme.DarkSlate)
	ti.Focus()

	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(theme.Purple)

	st := newStore()
	configs, enabled := st.LoadPluginConfigs()

	// Initialize SSE client
	sseClient := api.NewSSEClient(cfg.SSEBaseURL)

	return Model{
		cfg: cfg, client: api.NewClient(cfg.APIBaseURL, cfg.APIPort),
		sse:   sseClient,
		input: ti, spinner: s, startTime: time.Now(),
		inputMode: "execute", booting: true, bootStep: bootLogo,
		activeView: "chat", catalog: defaultCatalog(),
		enabledPlugins: enabled, pluginConfigs: configs,
		store: st, sessions: st.LoadSessions(),
		contextTree:   dummyContextTree(),
		filesWritten:  []string{},
		pipelineSteps: []string{},
		agentProgress: make(map[string]int),
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		textinput.Blink,
		bootTick(),
		connectSSE(m.sse),
		m.subscribeToSSE(),
	)
}

// subscribeToSSE creates a command that forwards SSE events to BubbleTea
func (m Model) subscribeToSSE() tea.Cmd {
	return func() tea.Msg {
		// Wait for SSE connection
		time.Sleep(100 * time.Millisecond)
		return nil
	}
}

// waitForSSEEvents returns commands that wait for each SSE channel
func (m Model) waitForSSEEvents() []tea.Cmd {
	return []tea.Cmd{
		m.waitForPipelineStep(),
		m.waitForTaskUpdate(),
		m.waitForFileWritten(),
	}
}

func (m Model) waitForPipelineStep() tea.Cmd {
	return func() tea.Msg {
		evt, ok := <-m.sse.PipelineStepChan
		if !ok {
			return nil
		}
		return ssePipelineStepMsg{event: evt}
	}
}

func (m Model) waitForTaskUpdate() tea.Cmd {
	return func() tea.Msg {
		evt, ok := <-m.sse.TaskUpdateChan
		if !ok {
			return nil
		}
		return sseTaskUpdateMsg{event: evt}
	}
}

func (m Model) waitForFileWritten() tea.Cmd {
	return func() tea.Msg {
		evt, ok := <-m.sse.FileWrittenChan
		if !ok {
			return nil
		}
		return sseFileWrittenMsg{event: evt}
	}
}

func connectSSE(sse *api.SSEClient) tea.Cmd {
	return func() tea.Msg {
		if err := sse.ConnectToAll(); err != nil {
			return nil
		}
		return sseConnectedMsg{}
	}
}

func (m *Model) listenForSSEEvents() tea.Cmd {
	return func() tea.Msg {
		return nil
	}
}

func bootTick() tea.Cmd {
	return tea.Tick(280*time.Millisecond, func(t time.Time) tea.Msg { return bootTickMsg(t) })
}
func pipelineTick() tea.Cmd {
	return tea.Tick(700*time.Millisecond, func(t time.Time) tea.Msg { return pipelineTickMsg(t) })
}

// --- Update ---

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		if !m.booting {
			m.setupLayout()
		}

	case tea.KeyMsg:
		if m.booting {
			m.booting = false
			m.bootStep = bootDone
			m.setupLayout()
			return m, checkHealth(m.client)
		}

		key := msg.String()

		// ---- Plugin config mode: input is for credential fields ----
		if m.configMode {
			switch key {
			case "ctrl+c":
				return m, tea.Quit
			case "esc":
				m.exitConfigMode()
				m.refreshContent()
				return m, nil
			case "enter":
				m.saveCurrentField()
				return m, nil
			}
			// Regular chars fall through to textinput below
			break
		}

		// ---- Global keys ----
		switch key {
		case "ctrl+c":
			return m, tea.Quit
		case "tab":
			m.cycleView(1)
			m.refreshContent()
			return m, nil
		case "shift+tab":
			m.cycleView(-1)
			m.refreshContent()
			return m, nil
		}

		// ---- Non-chat views consume all keys ----
		switch m.activeView {
		case "plugins":
			return m.keysPlugins(msg)
		case "context":
			if key == "esc" {
				m.activeView = "chat"
				m.refreshContent()
			}
			return m, nil
		case "history":
			return m.keysHistory(msg)
		}

		// ---- Chat view: specific keys only, rest falls to textinput ----
		switch key {
		case "esc":
			if !m.loading {
				return m, tea.Quit
			}
		case "ctrl+t":
			if m.inputMode == "execute" {
				m.inputMode = "chat"
				m.input.Placeholder = "Ask a question..."
			} else {
				m.inputMode = "execute"
				m.input.Placeholder = "Describe what you want to build..."
			}
			return m, nil
		case "ctrl+s":
			if len(m.history) > 0 {
				m.store.SaveSession(m.history)
				m.sessions = m.store.LoadSessions()
				m.addEntry("system", "Session saved to history", nil)
				m.refreshContent()
			}
			return m, nil
		case "enter":
			if m.loading {
				return m, nil
			}
			text := strings.TrimSpace(m.input.Value())
			if text == "" {
				return m, nil
			}
			m.addEntry("user", text, nil)
			m.input.SetValue("")
			m.loading = true
			m.pipelinePhase = 0
			m.pipelineMsg = pipelinePhases[0]
			m.refreshContent()
			var cmd tea.Cmd
			if m.inputMode == "execute" {
				cmd = executeTask(m.client, text, m.enabledPlugins, m.catalog, m.pluginConfigs)
			} else {
				cmd = chatDirect(m.client, text)
			}
			return m, tea.Batch(cmd, pipelineTick())
		}

	case bootTickMsg:
		if m.booting {
			m.bootDots = (m.bootDots + 1) % 4
			if m.bootStep < bootDone {
				m.bootStep++
				if m.bootStep == bootDone {
					m.booting = false
					m.setupLayout()
					return m, checkHealth(m.client)
				}
				return m, bootTick()
			}
		}

	case pipelineTickMsg:
		if m.loading && m.pipelinePhase < len(pipelinePhases)-1 {
			m.pipelinePhase++
			m.pipelineMsg = pipelinePhases[m.pipelinePhase]
			return m, pipelineTick()
		}

	case healthResultMsg:
		if msg.err != nil {
			m.connected = false
			m.addEntry("system", fmt.Sprintf("Backend unreachable: %v", msg.err), nil)
		} else {
			m.connected = msg.healthy
			m.serverVersion = msg.version
			m.addEntry("system", "Connected to Meteoroid backend v"+msg.version, nil)
		}
		m.refreshContent()

	case executeResultMsg:
		m.loading = false
		if msg.err != nil {
			m.addEntry("error", msg.err.Error(), nil)
		} else {
			m.lastResponse = msg.resp
			m.buildContextTree(msg.resp)
			m.processExecuteResponse(msg.resp)
		}
		m.refreshContent()

	case chatResultMsg:
		m.loading = false
		if msg.err != nil {
			m.addEntry("error", msg.err.Error(), nil)
		} else if msg.resp != nil {
			meta := map[string]string{}
			if msg.resp.Model != "" {
				meta["model"] = msg.resp.Model
			}
			m.addEntry("assistant", msg.resp.Response, meta)
		}
		m.refreshContent()

	// SSE event handlers
	case sseConnectedMsg:
		m.sseConnected = true
		m.addEntry("system", "🔌 SSE connected - real-time updates enabled", nil)
		// Start listening for events after connection
		cmds = append(cmds, m.waitForSSEEvents()...)
		m.refreshContent()

	case sseTaskUpdateMsg:
		m.handleTaskUpdate(msg.event)
		cmds = append(cmds, m.waitForTaskUpdate()) // Continue listening
		m.refreshContent()

	case sseFileWrittenMsg:
		m.filesWritten = append(m.filesWritten, msg.event.FilePath)
		m.pipelineMsg = fmt.Sprintf("📝 %s", msg.event.FilePath)
		cmds = append(cmds, m.waitForFileWritten()) // Continue listening
		m.refreshContent()

	case sseAgentProgressMsg:
		m.agentProgress[msg.event.AgentID] = msg.event.Progress
		m.refreshContent()

	case ssePipelineStepMsg:
		m.pipelineSteps = append(m.pipelineSteps, fmt.Sprintf("[%d] %s: %s", msg.event.StepNumber, msg.event.Phase, msg.event.Message))
		m.pipelineMsg = msg.event.Message
		// Add to history for visibility
		if len(m.pipelineSteps) <= 20 || msg.event.Phase == "finalize" {
			m.addEntry("system", fmt.Sprintf("→ %s", msg.event.Message), nil)
		}
		cmds = append(cmds, m.waitForPipelineStep()) // Continue listening
		m.refreshContent()

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	// Textinput active in: chat view OR plugin config mode
	inputActive := !m.booting && ((m.activeView == "chat" && !m.loading) || m.configMode)
	if inputActive {
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		cmds = append(cmds, cmd)
	}
	if m.ready {
		var cmd tea.Cmd
		m.viewport, cmd = m.viewport.Update(msg)
		cmds = append(cmds, cmd)
	}
	return m, tea.Batch(cmds...)
}

// --- Config mode ---

func (m *Model) enterConfigMode() {
	key := fmt.Sprintf("%d:%d", m.pluginCatIdx, m.pluginItemIdx)
	plugin := m.catalog[m.pluginCatIdx].Plugins[m.pluginItemIdx]

	if len(plugin.Fields) == 0 {
		// No config needed, just toggle
		m.enabledPlugins[key] = !m.enabledPlugins[key]
		m.store.SavePluginConfigs(m.pluginConfigs, m.enabledPlugins)
		m.refreshContent()
		return
	}

	m.configMode = true
	m.configFieldIdx = 0

	// Pre-fill if previously configured
	field := plugin.Fields[0]
	existing := ""
	if cfg, ok := m.pluginConfigs[key]; ok {
		existing = cfg[field.Key]
	}

	m.input.SetValue(existing)
	m.input.Prompt = " CONFIG > "
	m.input.Placeholder = field.Label + "..."
	if field.Secret {
		m.input.EchoMode = textinput.EchoPassword
	} else {
		m.input.EchoMode = textinput.EchoNormal
	}
	m.input.Focus()
	m.refreshContent()
}

func (m *Model) saveCurrentField() {
	key := fmt.Sprintf("%d:%d", m.pluginCatIdx, m.pluginItemIdx)
	plugin := m.catalog[m.pluginCatIdx].Plugins[m.pluginItemIdx]

	if m.pluginConfigs[key] == nil {
		m.pluginConfigs[key] = make(map[string]string)
	}

	field := plugin.Fields[m.configFieldIdx]
	m.pluginConfigs[key][field.Key] = m.input.Value()

	m.configFieldIdx++

	if m.configFieldIdx >= len(plugin.Fields) {
		// All fields done — enable the plugin
		m.enabledPlugins[key] = true
		m.store.SavePluginConfigs(m.pluginConfigs, m.enabledPlugins)
		m.exitConfigMode()
		m.addEntry("system", fmt.Sprintf("Plugin configured: %s", plugin.Name), nil)
		m.refreshContent()
		return
	}

	// Next field
	nextField := plugin.Fields[m.configFieldIdx]
	existing := m.pluginConfigs[key][nextField.Key]
	m.input.SetValue(existing)
	m.input.Placeholder = nextField.Label + "..."
	if nextField.Secret {
		m.input.EchoMode = textinput.EchoPassword
	} else {
		m.input.EchoMode = textinput.EchoNormal
	}
	m.refreshContent()
}

func (m *Model) exitConfigMode() {
	m.configMode = false
	m.configFieldIdx = 0
	m.input.SetValue("")
	m.input.Prompt = " > "
	m.input.Placeholder = "Describe what you want to build..."
	m.input.EchoMode = textinput.EchoNormal
}

// --- View routing ---

func (m *Model) cycleView(dir int) {
	if m.configMode {
		m.exitConfigMode()
	}
	views := []string{"chat", "plugins", "context", "history"}
	for i, v := range views {
		if v == m.activeView {
			m.activeView = views[(i+dir+len(views))%len(views)]
			break
		}
	}
}

func (m Model) keysPlugins(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.activeView = "chat"
		m.refreshContent()
	case "left", "h":
		if m.pluginCatIdx > 0 {
			m.pluginCatIdx--
			m.pluginItemIdx = 0
			m.refreshContent()
		}
	case "right", "l":
		if m.pluginCatIdx < len(m.catalog)-1 {
			m.pluginCatIdx++
			m.pluginItemIdx = 0
			m.refreshContent()
		}
	case "up", "k":
		if m.pluginItemIdx > 0 {
			m.pluginItemIdx--
			m.refreshContent()
		}
	case "down", "j":
		if m.pluginCatIdx < len(m.catalog) {
			cat := m.catalog[m.pluginCatIdx]
			if m.pluginItemIdx < len(cat.Plugins)-1 {
				m.pluginItemIdx++
				m.refreshContent()
			}
		}
	case " ", "enter":
		key := fmt.Sprintf("%d:%d", m.pluginCatIdx, m.pluginItemIdx)
		if m.enabledPlugins[key] {
			// Already enabled — toggle off
			m.enabledPlugins[key] = false
			m.store.SavePluginConfigs(m.pluginConfigs, m.enabledPlugins)
			m.refreshContent()
		} else {
			// Enable — enter config mode if fields exist
			m.enterConfigMode()
		}
	}
	return m, nil
}

func (m Model) keysHistory(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.activeView = "chat"
		m.refreshContent()
	case "up", "k":
		if m.historyIdx > 0 {
			m.historyIdx--
			m.refreshContent()
		}
	case "down", "j":
		if m.historyIdx < len(m.sessions)-1 {
			m.historyIdx++
			m.refreshContent()
		}
	case "enter":
		if len(m.sessions) > 0 && m.historyIdx < len(m.sessions) {
			sess := m.sessions[m.historyIdx]
			m.history = sess.Entries
			m.activeView = "chat"
			m.addEntry("system", fmt.Sprintf("Loaded session from %s", sess.Timestamp.Format("2006-01-02 15:04")), nil)
			m.refreshContent()
		}
	case "d":
		if len(m.sessions) > 0 && m.historyIdx < len(m.sessions) {
			m.store.DeleteSession(m.historyIdx)
			m.sessions = m.store.LoadSessions()
			if m.historyIdx >= len(m.sessions) && m.historyIdx > 0 {
				m.historyIdx--
			}
			m.refreshContent()
		}
	}
	return m, nil
}

// --- Layout ---

func (m *Model) setupLayout() {
	vpH := m.height - 7
	if vpH < 3 {
		vpH = 3
	}
	vpW := m.width - 2
	if vpW < 20 {
		vpW = 20
	}
	if !m.ready {
		m.viewport = viewport.New(vpW, vpH)
		m.ready = true
	} else {
		m.viewport.Width = vpW
		m.viewport.Height = vpH
	}
	m.input.Width = m.width - 12
	m.refreshContent()
}

// --- Context tree builder ---

func (m *Model) buildContextTree(resp *api.ExecuteResponse) {
	if resp == nil {
		return
	}

	// Phase 28: Prefer backend-provided context tree
	if len(resp.ContextTree) > 0 {
		var nodes []ContextNode
		for _, n := range resp.ContextTree {
			nodes = append(nodes, apiNodeToContextNode(n))
		}
		m.contextTree = nodes
		return
	}

	// Fallback: build locally (for older backends)
	var nodes []ContextNode
	if resp.IntentAnalysis != nil {
		ia := resp.IntentAnalysis
		nodes = append(nodes, ContextNode{
			Label: "Intent Analysis", Tag: "INTENT", Size: "~1 KB",
			Summary: fmt.Sprintf("Intent: %s | %s/%s | %.0f%%\n%s",
				ia.Intent, ia.Language, ia.Framework, ia.Confidence*100, ia.Reasoning),
		})
	}
	if resp.VectorUsed {
		nodes = append(nodes, ContextNode{
			Label: "Vector Learning Context", Tag: "VECTOR", Size: "~4 KB",
			Summary: "Vector learning was applied.\nSimilar projects and best practices injected.",
		})
	}
	if resp.PluginCount > 0 {
		nodes = append(nodes, ContextNode{
			Label: "Active Plugin Context", Tag: "PLUGINS",
			Size:    fmt.Sprintf("~%.1f KB", float64(resp.PluginCount)*0.3),
			Summary: fmt.Sprintf("%d plugins: %s", resp.PluginCount, strings.Join(resp.PluginsUsed, ", ")),
		})
	}
	if len(resp.AgentsExecuted) > 0 {
		nodes = append(nodes, ContextNode{
			Label: "Agent Execution", Tag: "AGENTS", Size: "~0.5 KB",
			Summary: fmt.Sprintf("Agents: %s\n%d agents executed.",
				strings.Join(resp.AgentsExecuted, ", "), len(resp.AgentsExecuted)),
		})
	}
	if len(resp.GeneratedCode) > 0 {
		var codeChildren []ContextNode
		totalSize := 0
		for _, c := range resp.GeneratedCode {
			sz := len(c.Code)
			totalSize += sz
			s := c.Explanation
			if len(s) > 80 {
				s = s[:77] + "..."
			}
			codeChildren = append(codeChildren, ContextNode{
				Label: c.Subtask, Tag: "file", Size: fmt.Sprintf("%.1f KB", float64(sz)/1024), Summary: s,
			})
		}
		nodes = append(nodes, ContextNode{
			Label: "Generated Output", Tag: "OUTPUT",
			Size:     fmt.Sprintf("%.1f KB", float64(totalSize)/1024),
			Summary:  fmt.Sprintf("%d files generated.", len(resp.GeneratedCode)),
			Children: codeChildren,
		})
	}
	if len(nodes) > 0 {
		m.contextTree = nodes
	}
}

// apiNodeToContextNode converts a backend ContextTreeNode to a TUI ContextNode
func apiNodeToContextNode(n api.ContextTreeNode) ContextNode {
	node := ContextNode{
		Label:   n.Label,
		Tag:     n.Tag,
		Size:    n.Size,
		Summary: n.Summary,
	}
	for _, child := range n.Children {
		node.Children = append(node.Children, apiNodeToContextNode(child))
	}
	return node
}

// --- Helpers ---

func (m *Model) addEntry(role, content string, meta map[string]string) {
	m.history = append(m.history, ChatEntry{
		Role: role, Content: content, Timestamp: time.Now(), Meta: meta,
	})
}

func (m *Model) processExecuteResponse(resp *api.ExecuteResponse) {
	if resp == nil {
		m.addEntry("error", "Empty response", nil)
		return
	}
	if resp.IsQuestion && resp.Answer != "" {
		meta := map[string]string{}
		if resp.IntentAnalysis != nil {
			meta["intent"] = resp.IntentAnalysis.Intent
		}
		m.addEntry("assistant", resp.Answer, meta)
		return
	}
	var parts []string
	if resp.IntentAnalysis != nil {
		parts = append(parts, fmt.Sprintf("Intent: %s | %s/%s | %.0f%%",
			resp.IntentAnalysis.Intent, resp.IntentAnalysis.Language,
			resp.IntentAnalysis.Framework, resp.IntentAnalysis.Confidence*100))
	}
	parts = append(parts, fmt.Sprintf("Task: %s | Steps: %d | Duration: %.1fs",
		resp.TaskID, resp.Steps, resp.TotalDuration/1000))
	m.addEntry("pipeline", strings.Join(parts, "\n"), nil)
	for _, c := range resp.GeneratedCode {
		meta := map[string]string{}
		if c.Subtask != "" {
			meta["subtask"] = c.Subtask
		}
		if c.Agent != "" {
			meta["agent"] = c.Agent
		}
		content := c.Code
		if c.Explanation != "" {
			content = c.Explanation + "\n\n" + c.Code
		}
		m.addEntry("code", content, meta)
	}
	if len(resp.Errors) > 0 {
		m.addEntry("error", strings.Join(resp.Errors, "; "), nil)
	}
	if resp.Success {
		m.addEntry("system", "Generation completed successfully", nil)
	}
}

// --- Commands ---

func checkHealth(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		h, err := client.CheckHealth()
		if err != nil {
			return healthResultMsg{err: err}
		}
		return healthResultMsg{healthy: h.Status == "healthy", version: h.Version}
	}
}

// executeTask sends structured plugin configs and prompt to the backend
func executeTask(client *api.Client, prompt string, enabled map[string]bool, catalog []PluginCategory, configs map[string]map[string]string) tea.Cmd {
	return func() tea.Msg {
		var stack []string
		var pluginItems []api.PluginConfigItem

		for key := range enabled {
			if !enabled[key] {
				continue
			}
			var ci, pi int
			fmt.Sscanf(key, "%d:%d", &ci, &pi)
			if ci >= len(catalog) || pi >= len(catalog[ci].Plugins) {
				continue
			}
			p := catalog[ci].Plugins[pi]
			catName := catalog[ci].Name
			stack = append(stack, p.Name)

			// Build structured plugin config for backend
			pluginCfg := api.PluginConfigItem{
				Name:     p.Name,
				Category: catName,
				Config:   make(map[string]string),
			}
			if cfg, ok := configs[key]; ok {
				for k, v := range cfg {
					pluginCfg.Config[k] = v
				}
			}
			pluginItems = append(pluginItems, pluginCfg)
		}

		req := &api.ExecuteRequest{
			Prompt: prompt, // Clean prompt — backend handles plugin context injection
			Config: &api.ExecuteConfig{
				UseAIThinking: true, UseContextManager: true,
				UseAgentMonitor: true, UseMCPHub: true, MaxSubtasks: 3,
			},
		}
		if len(stack) > 0 {
			req.Context = &api.ExecuteContext{TechStack: stack}
		}
		if len(pluginItems) > 0 {
			req.PluginConfig = pluginItems
		}
		resp, err := client.Execute(req)
		if err != nil {
			return executeResultMsg{err: err}
		}
		return executeResultMsg{resp: resp}
	}
}

func chatDirect(client *api.Client, message string) tea.Cmd {
	return func() tea.Msg {
		resp, err := client.Chat(&api.ChatRequest{Message: message})
		if err != nil {
			return chatResultMsg{err: err}
		}
		return chatResultMsg{resp: resp}
	}
}

// handleTaskUpdate processes real-time task updates from SSE
func (m *Model) handleTaskUpdate(event api.TaskUpdateEvent) {
	switch event.Status {
	case "running":
		m.currentTaskID = event.TaskID
		if event.Message != "" {
			m.pipelineMsg = event.Message
		}
	case "progress":
		m.pipelinePhase = event.Progress
		if event.Message != "" {
			m.pipelineMsg = event.Message
		}
	case "completed":
		m.loading = false
		m.addEntry("system", fmt.Sprintf("✅ Task completed: %s", event.TaskID), nil)
	case "failed":
		m.loading = false
		m.addEntry("error", fmt.Sprintf("Task failed: %s", event.Message), nil)
	}
}
