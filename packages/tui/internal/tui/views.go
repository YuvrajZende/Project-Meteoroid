package tui

import (
	"fmt"
	"strings"
	"time"

	"meteoroid/internal/theme"

	"github.com/charmbracelet/lipgloss"
)

// --- Main View ---

func (m Model) View() string {
	if m.booting {
		return m.viewBoot()
	}
	if !m.ready {
		return "  Starting Meteoroid..."
	}

	var s strings.Builder
	s.WriteString(m.viewHeader())
	s.WriteString("\n")
	s.WriteString(m.viewTabs())
	s.WriteString("\n")
	s.WriteString(dimLine(m.width))
	s.WriteString("\n ")
	s.WriteString(m.viewport.View())
	s.WriteString("\n")

	if m.activeView == "chat" && m.loading {
		s.WriteString(m.viewPipeline())
	} else {
		s.WriteString(dimLine(m.width))
	}
	s.WriteString("\n")

	// Input row
	if m.activeView == "chat" || m.configMode {
		s.WriteString(m.viewInput())
	} else {
		s.WriteString(m.viewNavHints())
	}
	s.WriteString("\n")
	s.WriteString(m.viewStatus())
	return s.String()
}

// --- Boot ---

func (m Model) viewBoot() string {
	w, h := m.width, m.height
	if w == 0 {
		w = 80
	}
	if h == 0 {
		h = 24
	}

	var out []string
	topPad := h/2 - 8
	if topPad < 1 {
		topPad = 1
	}
	for i := 0; i < topPad; i++ {
		out = append(out, "")
	}

	purple := lipgloss.NewStyle().Foreground(theme.Purple).Bold(true)
	logo := []string{
		`  __  __ _____ _____ _____ ___  ____   ___ ___ ____  `,
		` |  \/  | ____|_   _| ____/ _ \|  _ \ / _ \_ _|  _ \ `,
		` | |\/| |  _|   | | |  _|| | | | |_) | | | | || | | |`,
		` | |  | | |___  | | | |__| |_| |  _ <| |_| | || |_| |`,
		` |_|  |_|_____| |_| |_____\___/|_| \_\\___/___|____/ `,
	}
	if m.bootStep >= bootLogo {
		for _, l := range logo {
			pad := (w - len(l)) / 2
			if pad < 0 {
				pad = 0
			}
			out = append(out, strings.Repeat(" ", pad)+purple.Render(l))
		}
	}
	out = append(out, "")
	if m.bootStep >= bootSub {
		sub := "AI-Powered Code Generation Terminal"
		pad := (w - len(sub)) / 2
		if pad < 0 {
			pad = 0
		}
		out = append(out, strings.Repeat(" ", pad)+lipgloss.NewStyle().Foreground(theme.Slate).Render(sub))
	} else {
		out = append(out, "")
	}
	out = append(out, "")

	for i, step := range bootSteps {
		phase := bootPhase(int(bootS1) + i)
		if m.bootStep < phase {
			out = append(out, "")
			continue
		}
		var line string
		if m.bootStep == phase {
			dots := strings.Repeat(".", m.bootDots)
			line = lipgloss.NewStyle().Foreground(theme.Cyan).Render(">>") +
				lipgloss.NewStyle().Foreground(theme.Slate).Render("  "+step) +
				lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(dots)
		} else {
			line = lipgloss.NewStyle().Foreground(theme.Teal).Render("OK") +
				lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("  "+step)
		}
		pad := (w - len(step) - 6) / 2
		if pad < 4 {
			pad = 4
		}
		out = append(out, strings.Repeat(" ", pad)+line)
	}
	if m.bootStep >= bootReady {
		out = append(out, "")
		r := "--- ALL SYSTEMS READY ---"
		out = append(out, center(lipgloss.NewStyle().Foreground(theme.Teal).Bold(true).Render(r), r, w))
		out = append(out, "")
		h2 := "Press any key to continue"
		out = append(out, center(lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(h2), h2, w))
	}
	return strings.Join(out, "\n")
}

// --- Header ---

func (m Model) viewHeader() string {
	logo := lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render(" * Meteoroid")
	tag := lipgloss.NewStyle().Foreground(theme.Dim).Render(" - AI Code Generation Terminal")
	var conn string
	if m.connected {
		conn = lipgloss.NewStyle().Foreground(theme.Teal).Render("[connected] ")
	} else {
		conn = lipgloss.NewStyle().Foreground(theme.Rose).Render("[disconnected] ")
	}
	left := logo + tag
	gap := m.width - lipgloss.Width(left) - lipgloss.Width(conn)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + conn
}

// --- Tabs ---

func (m Model) viewTabs() string {
	tabs := []struct{ key, label string }{
		{"chat", "Chat"}, {"plugins", "Plugins"}, {"context", "Context"}, {"history", "History"},
	}
	var parts []string
	for _, t := range tabs {
		if t.key == m.activeView {
			parts = append(parts, lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render(" ["+t.label+"] "))
		} else {
			parts = append(parts, lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("  "+t.label+"  "))
		}
	}
	return "  " + strings.Join(parts, "")
}

// --- Pipeline ---

func (m Model) viewPipeline() string {
	var s strings.Builder

	// Show current phase prominently
	s.WriteString(" " + m.spinner.View() + " ")
	s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render(m.pipelineMsg))
	s.WriteString("\n")

	// Show recent pipeline steps from backend
	if len(m.pipelineSteps) > 0 {
		s.WriteString(lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("  Recent: "))
		start := len(m.pipelineSteps) - 3
		if start < 0 {
			start = 0
		}
		for i := start; i < len(m.pipelineSteps); i++ {
			if i > start {
				s.WriteString(lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(" → "))
			}
			s.WriteString(lipgloss.NewStyle().Foreground(theme.Slate).Render(m.pipelineSteps[i]))
		}
	}

	// Show files written count
	if len(m.filesWritten) > 0 {
		s.WriteString("\n")
		s.WriteString(lipgloss.NewStyle().Foreground(theme.Teal).Render(
			fmt.Sprintf("  📁 %d files written", len(m.filesWritten))))
	}

	// Show SSE connection status
	if m.sseConnected {
		s.WriteString(lipgloss.NewStyle().Foreground(theme.Teal).Render(" • SSE ●"))
	} else {
		s.WriteString(lipgloss.NewStyle().Foreground(theme.Rose).Render(" • SSE ○"))
	}

	return s.String()
}

// --- Input ---

func (m Model) viewInput() string {
	if m.configMode {
		badge := lipgloss.NewStyle().Foreground(lipgloss.Color("#0F172A")).
			Background(theme.Amber).Padding(0, 1).Bold(true).Render("CONFIG")
		return " " + badge + m.input.View()
	}
	var badge string
	if m.inputMode == "execute" {
		badge = lipgloss.NewStyle().Foreground(lipgloss.Color("#0F172A")).
			Background(theme.Purple).Padding(0, 1).Bold(true).Render("BUILD")
	} else {
		badge = lipgloss.NewStyle().Foreground(lipgloss.Color("#0F172A")).
			Background(theme.Cyan).Padding(0, 1).Bold(true).Render("CHAT")
	}
	return " " + badge + m.input.View()
}

// --- Nav hints ---

func (m Model) viewNavHints() string {
	var hint string
	switch m.activeView {
	case "plugins":
		hint = "  arrows navigate | enter/space configure | esc back"
	case "context":
		hint = "  scroll to view context tree | esc back"
	case "history":
		hint = "  up/down select | enter load | d delete | esc back"
	}
	return lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(hint)
}

// --- Status ---

func (m Model) viewStatus() string {
	left := "  ctrl+t mode | ctrl+s save | tab views | esc quit"
	if m.configMode {
		left = "  enter confirm | esc cancel config"
	}
	leftStyled := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(left)
	uptime := time.Since(m.startTime).Round(time.Second)
	right := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(fmt.Sprintf("uptime %s  ", uptime))
	gap := m.width - lipgloss.Width(leftStyled) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return leftStyled + strings.Repeat(" ", gap) + right
}

// --- Viewport content ---

func (m *Model) refreshContent() {
	if !m.ready {
		return
	}
	switch m.activeView {
	case "chat":
		m.viewport.SetContent(m.renderChat())
		m.viewport.GotoBottom()
	case "plugins":
		m.viewport.SetContent(m.renderPlugins())
	case "context":
		m.viewport.SetContent(m.renderContextTree())
	case "history":
		m.viewport.SetContent(m.renderHistoryList())
	}
}

// ===================================================================
// Chat
// ===================================================================

func (m Model) renderChat() string {
	if len(m.history) == 0 {
		return m.renderWelcome()
	}
	var b strings.Builder
	for i, e := range m.history {
		b.WriteString(renderEntry(e))
		if i < len(m.history)-1 {
			b.WriteString("\n")
		}
	}
	return b.String()
}

func (m Model) renderWelcome() string {
	title := lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("Welcome to Meteoroid")
	return strings.Join([]string{
		"", " " + title, "",
		sdim("  Type a prompt and press Enter to start."),
		sdim("  Use Ctrl+T to switch between BUILD and CHAT modes."),
		sdim("  Press Tab to navigate between views."), "",
		sdim("  BUILD  Full AI orchestration pipeline"),
		sdim("  CHAT   Direct AI conversation"),
	}, "\n")
}

func renderEntry(e ChatEntry) string {
	ts := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(e.Timestamp.Format("15:04:05"))
	switch e.Role {
	case "user":
		return fmt.Sprintf(" %s %s\n   %s", ts,
			lipgloss.NewStyle().Foreground(theme.Cyan).Bold(true).Render("> You"),
			lipgloss.NewStyle().Foreground(theme.White).Render(e.Content))
	case "assistant":
		meta := fmtMeta(e.Meta)
		return fmt.Sprintf(" %s %s\n   %s%s", ts,
			lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("* Meteoroid"),
			lipgloss.NewStyle().Foreground(theme.White).Render(e.Content), meta)
	case "code":
		hdr := ""
		if e.Meta != nil && e.Meta["subtask"] != "" {
			hdr = "\n   " + lipgloss.NewStyle().Foreground(theme.Cyan).Render(e.Meta["subtask"])
		}
		return fmt.Sprintf(" %s %s%s\n   %s", ts,
			lipgloss.NewStyle().Foreground(theme.Teal).Bold(true).Render("* Code"), hdr,
			lipgloss.NewStyle().Foreground(theme.Teal).Render(e.Content))
	case "system":
		return fmt.Sprintf(" %s %s  %s", ts,
			lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("* System"),
			lipgloss.NewStyle().Foreground(theme.Amber).Render(e.Content))
	case "error":
		return fmt.Sprintf(" %s %s  %s", ts,
			lipgloss.NewStyle().Foreground(theme.Rose).Bold(true).Render("! Error"),
			lipgloss.NewStyle().Foreground(theme.Rose).Render(e.Content))
	case "pipeline":
		lines := strings.Split(e.Content, "\n")
		var r []string
		for _, l := range lines {
			r = append(r, lipgloss.NewStyle().Foreground(theme.Slate).Render(l))
		}
		return fmt.Sprintf(" %s %s\n   %s", ts,
			lipgloss.NewStyle().Foreground(theme.Indigo).Bold(true).Render("> Pipeline"),
			strings.Join(r, "\n   "))
	}
	return "  " + e.Content
}

// ===================================================================
// Plugins (with config panel)
// ===================================================================

func (m Model) renderPlugins() string {
	var s strings.Builder
	s.WriteString("\n")
	s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  Plugin Manager"))
	s.WriteString("\n")
	s.WriteString(sdim("  Select and configure plugins for your tech stack"))
	s.WriteString("\n\n")

	// Category tabs
	for i, cat := range m.catalog {
		if i == m.pluginCatIdx {
			s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  [" + cat.Name + "]"))
		} else {
			s.WriteString(lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("   " + cat.Name + " "))
		}
	}
	s.WriteString("\n")
	s.WriteString(sdim("  " + strings.Repeat("-", 60)))
	s.WriteString("\n\n")

	// Plugin list
	if m.pluginCatIdx < len(m.catalog) {
		cat := m.catalog[m.pluginCatIdx]
		for i, p := range cat.Plugins {
			key := fmt.Sprintf("%d:%d", m.pluginCatIdx, i)
			enabled := m.enabledPlugins[key]
			isSelected := i == m.pluginItemIdx

			// Cursor
			cursor := "  "
			if isSelected {
				cursor = lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("> ")
			}

			// Checkbox
			check := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("[ ]")
			if enabled {
				check = lipgloss.NewStyle().Foreground(theme.Teal).Render("[x]")
			}

			// Name
			var name string
			if isSelected {
				name = lipgloss.NewStyle().Foreground(theme.White).Bold(true).Render(p.Name)
			} else if enabled {
				name = lipgloss.NewStyle().Foreground(theme.Teal).Render(p.Name)
			} else {
				name = lipgloss.NewStyle().Foreground(theme.Slate).Render(p.Name)
			}

			pad := 20 - len(p.Name)
			if pad < 1 {
				pad = 1
			}

			// Description + config indicator
			desc := p.Desc
			if enabled && len(p.Fields) > 0 {
				desc += " (configured)"
			} else if len(p.Fields) > 0 {
				desc += " (needs config)"
			}
			descStyled := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(desc)

			s.WriteString(fmt.Sprintf("  %s %s %s%s%s\n", cursor, check, name, strings.Repeat(" ", pad), descStyled))

			// Show config details for selected enabled plugin
			if isSelected && enabled && len(p.Fields) > 0 {
				cfg := m.pluginConfigs[key]
				for _, f := range p.Fields {
					val := ""
					if cfg != nil {
						val = cfg[f.Key]
					}
					display := val
					if f.Secret && val != "" {
						display = strings.Repeat("*", 8)
					}
					if display == "" {
						display = "(not set)"
					}
					fieldLabel := lipgloss.NewStyle().Foreground(theme.Dim).Render("        " + f.Label + ": ")
					fieldVal := lipgloss.NewStyle().Foreground(theme.Slate).Render(display)
					s.WriteString(fieldLabel + fieldVal + "\n")
				}
			}
		}
	}

	// Config mode indicator
	if m.configMode && m.pluginCatIdx < len(m.catalog) {
		plugin := m.catalog[m.pluginCatIdx].Plugins[m.pluginItemIdx]
		s.WriteString("\n")
		s.WriteString(lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("  Configuring: ") +
			lipgloss.NewStyle().Foreground(theme.White).Bold(true).Render(plugin.Name))
		s.WriteString("\n")

		for i, f := range plugin.Fields {
			key := fmt.Sprintf("%d:%d", m.pluginCatIdx, m.pluginItemIdx)
			val := ""
			if cfg := m.pluginConfigs[key]; cfg != nil {
				val = cfg[f.Key]
			}

			indicator := "  "
			if i == m.configFieldIdx {
				indicator = lipgloss.NewStyle().Foreground(theme.Amber).Render(">>")
			} else if i < m.configFieldIdx {
				indicator = lipgloss.NewStyle().Foreground(theme.Teal).Render("OK")
			}

			label := lipgloss.NewStyle().Foreground(theme.Slate).Render(f.Label + ": ")
			var valueStr string
			if i < m.configFieldIdx {
				if f.Secret {
					valueStr = lipgloss.NewStyle().Foreground(theme.Teal).Render(strings.Repeat("*", 8))
				} else if val != "" {
					valueStr = lipgloss.NewStyle().Foreground(theme.Teal).Render(val)
				}
			} else if i == m.configFieldIdx {
				valueStr = lipgloss.NewStyle().Foreground(theme.Amber).Render("(type below and press Enter)")
			} else {
				valueStr = lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("(pending)")
			}

			s.WriteString(fmt.Sprintf("  %s %s%s\n", indicator, label, valueStr))
		}
	}

	// Active plugins summary
	s.WriteString("\n")
	var active []string
	for key, on := range m.enabledPlugins {
		if !on {
			continue
		}
		var ci, pi int
		fmt.Sscanf(key, "%d:%d", &ci, &pi)
		if ci < len(m.catalog) && pi < len(m.catalog[ci].Plugins) {
			active = append(active, m.catalog[ci].Plugins[pi].Name)
		}
	}
	if len(active) > 0 {
		s.WriteString(sdim("  Active: "))
		s.WriteString(lipgloss.NewStyle().Foreground(theme.Teal).Render(strings.Join(active, ", ")))
	} else {
		s.WriteString(sdim("  No plugins enabled"))
	}
	return s.String()
}

// ===================================================================
// Context Tree
// ===================================================================

func (m Model) renderContextTree() string {
	var s strings.Builder
	s.WriteString("\n")
	s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  Context Tree"))
	s.WriteString("\n")
	s.WriteString(sdim("  Branching view of context built for the current prompt"))
	s.WriteString("\n\n")

	if len(m.contextTree) == 0 {
		s.WriteString(sdim("  No context available. Send a prompt first."))
		return s.String()
	}

	prompt := "(last prompt)"
	for i := len(m.history) - 1; i >= 0; i-- {
		if m.history[i].Role == "user" {
			prompt = m.history[i].Content
			if len(prompt) > 60 {
				prompt = prompt[:57] + "..."
			}
			break
		}
	}
	s.WriteString(fmt.Sprintf("  %s %s\n",
		lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("[ROOT]"),
		lipgloss.NewStyle().Foreground(theme.White).Bold(true).Render(prompt)))

	for i, node := range m.contextTree {
		isLast := i == len(m.contextTree)-1
		s.WriteString(renderTreeNode(node, "  ", isLast, m.width))
	}

	s.WriteString("\n")
	s.WriteString(sdim(fmt.Sprintf("  Total context: %d nodes | %s estimated",
		countNodes(m.contextTree), sumTreeSize(m.contextTree))))
	return s.String()
}

func renderTreeNode(node ContextNode, prefix string, isLast bool, maxW int) string {
	var s strings.Builder
	connector := "|-- "
	childPrefix := "|   "
	if isLast {
		connector = "+-- "
		childPrefix = "    "
	}
	connStyled := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(connector)
	cpStyled := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(childPrefix)

	tagColor := theme.Indigo
	switch node.Tag {
	case "INTENT":
		tagColor = theme.Cyan
	case "VECTOR":
		tagColor = theme.Violet
	case "PLUGINS":
		tagColor = theme.Purple
	case "AGENTS":
		tagColor = theme.Amber
	case "OUTPUT":
		tagColor = theme.Teal
	case "file":
		tagColor = theme.Teal
	case "db", "Database":
		tagColor = theme.Cyan
	case "sec", "Security":
		tagColor = theme.Rose
	}

	tag := lipgloss.NewStyle().Foreground(tagColor).Bold(true).Render("[" + node.Tag + "]")
	label := lipgloss.NewStyle().Foreground(theme.White).Render(" " + node.Label)
	size := lipgloss.NewStyle().Foreground(theme.Dim).Render(node.Size)

	mainWidth := lipgloss.Width(tag) + lipgloss.Width(label) + lipgloss.Width(size)
	rightPad := maxW - len(prefix) - 4 - mainWidth - 2
	if rightPad < 2 {
		rightPad = 2
	}

	s.WriteString(prefix + connStyled + tag + label + strings.Repeat(" ", rightPad) + size + "\n")

	if node.Summary != "" {
		for _, line := range strings.Split(node.Summary, "\n") {
			s.WriteString(prefix + cpStyled + lipgloss.NewStyle().Foreground(theme.Slate).Render(line) + "\n")
		}
	}
	for j, child := range node.Children {
		s.WriteString(renderTreeNode(child, prefix+childPrefix, j == len(node.Children)-1, maxW))
	}
	return s.String()
}

func sumTreeSize(nodes []ContextNode) string {
	total := 0.0
	for _, n := range nodes {
		total += parseSize(n.Size)
		for _, c := range n.Children {
			total += parseSize(c.Size)
		}
	}
	if total >= 1024 {
		return fmt.Sprintf("%.1f MB", total/1024)
	}
	return fmt.Sprintf("%.1f KB", total)
}

func parseSize(s string) float64 {
	var val float64
	if strings.Contains(s, "~") {
		fmt.Sscanf(s, "~%f", &val)
	} else {
		fmt.Sscanf(s, "%f", &val)
	}
	return val
}

func countNodes(nodes []ContextNode) int {
	count := len(nodes)
	for _, n := range nodes {
		count += countNodes(n.Children)
	}
	return count
}

// ===================================================================
// History
// ===================================================================

func (m Model) renderHistoryList() string {
	var s strings.Builder
	s.WriteString("\n")
	s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  Chat History"))
	s.WriteString("\n")
	s.WriteString(sdim("  Saved sessions (Ctrl+S in chat to save)"))
	s.WriteString("\n\n")

	if len(m.sessions) == 0 {
		s.WriteString(sdim("  No saved sessions yet."))
		return s.String()
	}
	for i, sess := range m.sessions {
		cursor := "  "
		if i == m.historyIdx {
			cursor = lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("> ")
		}
		ts := sess.Timestamp.Format("2006-01-02 15:04")
		if i == m.historyIdx {
			s.WriteString(fmt.Sprintf("  %s %s  %s%s\n", cursor,
				lipgloss.NewStyle().Foreground(theme.Cyan).Render(ts),
				lipgloss.NewStyle().Foreground(theme.White).Render(sess.Preview),
				lipgloss.NewStyle().Foreground(theme.Dim).Render(fmt.Sprintf(" (%d msgs)", sess.Count))))
		} else {
			s.WriteString(fmt.Sprintf("  %s %s  %s%s\n", cursor,
				lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(ts),
				lipgloss.NewStyle().Foreground(theme.Slate).Render(sess.Preview),
				lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(fmt.Sprintf(" (%d msgs)", sess.Count))))
		}
	}
	return s.String()
}

// ===================================================================
// Helpers
// ===================================================================

func dimLine(w int) string {
	return lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(strings.Repeat("-", w))
}

func sdim(s string) string {
	return lipgloss.NewStyle().Foreground(theme.Slate).Render(s)
}

func center(styled, raw string, w int) string {
	pad := (w - len(raw)) / 2
	if pad < 0 {
		pad = 0
	}
	return strings.Repeat(" ", pad) + styled
}

func fmtMeta(meta map[string]string) string {
	if len(meta) == 0 {
		return ""
	}
	var parts []string
	for k, v := range meta {
		if v != "" && v != "0" {
			parts = append(parts, k+":"+v)
		}
	}
	if len(parts) == 0 {
		return ""
	}
	return "\n   " + lipgloss.NewStyle().Foreground(theme.Dim).Render(strings.Join(parts, " | "))
}
