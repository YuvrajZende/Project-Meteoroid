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

// --- Boot phases ---

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
	width  int
	height int
	ready  bool

	input    textinput.Model
	viewport viewport.Model
	spinner  spinner.Model

	booting  bool
	bootStep bootPhase
	bootDots int

	activeView string // "chat","plugins","context","history"

	history       []ChatEntry
	loading       bool
	pipelinePhase int
	pipelineMsg   string
	connected     bool
	serverVersion string
	startTime     time.Time
	inputMode     string

	catalog        []PluginCategory
	pluginCatIdx   int
	pluginItemIdx  int
	enabledPlugins map[string]bool

	lastResponse *api.ExecuteResponse

	store      *Store
	sessions   []SavedSession
	historyIdx int
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
	return Model{
		cfg: cfg, client: api.NewClient(cfg.APIBaseURL, cfg.APIPort),
		input: ti, spinner: s, startTime: time.Now(),
		inputMode: "execute", booting: true, bootStep: bootLogo,
		activeView: "chat", catalog: defaultCatalog(),
		enabledPlugins: make(map[string]bool),
		store:          st, sessions: st.Load(),
	}
}

// --- Init ---

func (m Model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, textinput.Blink, bootTick())
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
		switch msg.String() {
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
		default:
			return m.handleViewKey(msg)
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

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	if m.activeView == "chat" && !m.booting && !m.loading {
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

// --- View routing ---

func (m *Model) cycleView(dir int) {
	views := []string{"chat", "plugins", "context", "history"}
	for i, v := range views {
		if v == m.activeView {
			m.activeView = views[(i+dir+len(views))%len(views)]
			break
		}
	}
}

func (m Model) handleViewKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch m.activeView {
	case "chat":
		return m.keysChat(msg)
	case "plugins":
		return m.keysPlugins(msg)
	case "context":
		return m.keysContext(msg)
	case "history":
		return m.keysHistory(msg)
	}
	return m, nil
}

// --- Chat keys ---

func (m Model) keysChat(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
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
	case "ctrl+s":
		if len(m.history) > 0 {
			m.store.Save(m.history)
			m.sessions = m.store.Load()
			m.addEntry("system", "Session saved to history", nil)
			m.refreshContent()
		}
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
			cmd = executeTask(m.client, text, m.enabledPlugins, m.catalog)
		} else {
			cmd = chatDirect(m.client, text)
		}
		return m, tea.Batch(cmd, pipelineTick())
	}
	return m, nil
}

// --- Plugin keys ---

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
		m.enabledPlugins[key] = !m.enabledPlugins[key]
		m.refreshContent()
	}
	return m, nil
}

// --- Context keys ---

func (m Model) keysContext(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if msg.String() == "esc" {
		m.activeView = "chat"
		m.refreshContent()
	}
	return m, nil
}

// --- History keys ---

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
		if m.historyIdx < len(m.sessions) {
			sess := m.sessions[m.historyIdx]
			m.history = sess.Entries
			m.activeView = "chat"
			m.addEntry("system", fmt.Sprintf("Loaded session from %s", sess.Timestamp.Format("2006-01-02 15:04")), nil)
			m.refreshContent()
		}
	case "d":
		if m.historyIdx < len(m.sessions) {
			m.store.Delete(m.historyIdx)
			m.sessions = m.store.Load()
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
	if len(resp.AgentsExecuted) > 0 {
		parts = append(parts, "Agents: "+strings.Join(resp.AgentsExecuted, ", "))
	}
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
	} else {
		m.addEntry("error", "Generation failed", nil)
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

func executeTask(client *api.Client, prompt string, enabled map[string]bool, catalog []PluginCategory) tea.Cmd {
	return func() tea.Msg {
		// Build tech stack from enabled plugins
		var stack []string
		for key := range enabled {
			if !enabled[key] {
				continue
			}
			var ci, pi int
			fmt.Sscanf(key, "%d:%d", &ci, &pi)
			if ci < len(catalog) && pi < len(catalog[ci].Plugins) {
				stack = append(stack, catalog[ci].Plugins[pi].Name)
			}
		}
		req := &api.ExecuteRequest{
			Prompt: prompt,
			Config: &api.ExecuteConfig{
				UseAIThinking: true, UseContextManager: true,
				UseAgentMonitor: true, UseMCPHub: true, MaxSubtasks: 3,
			},
		}
		if len(stack) > 0 {
			req.Context = &api.ExecuteContext{TechStack: stack}
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
