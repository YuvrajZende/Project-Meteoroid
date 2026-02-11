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
	s.WriteString("\n")
	s.WriteString(" ")
	s.WriteString(m.viewport.View())
	s.WriteString("\n")

	if m.activeView == "chat" && m.loading {
		s.WriteString(m.viewPipeline())
	} else {
		s.WriteString(dimLine(m.width))
	}
	s.WriteString("\n")

	if m.activeView == "chat" {
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
		styled := lipgloss.NewStyle().Foreground(theme.Slate).Render(sub)
		pad := (w - len(sub)) / 2
		if pad < 0 {
			pad = 0
		}
		out = append(out, strings.Repeat(" ", pad)+styled)
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
		isCurrent := m.bootStep == phase
		var line string
		if isCurrent {
			dots := strings.Repeat(".", m.bootDots)
			icon := lipgloss.NewStyle().Foreground(theme.Cyan).Render(">>")
			text := lipgloss.NewStyle().Foreground(theme.Slate).Render("  " + step)
			line = icon + text + lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(dots)
		} else {
			icon := lipgloss.NewStyle().Foreground(theme.Teal).Render("OK")
			text := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("  " + step)
			line = icon + text
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
	right := conn
	gap := m.width - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

// --- Tab bar ---

func (m Model) viewTabs() string {
	tabs := []struct{ key, label string }{
		{"chat", "Chat"}, {"plugins", "Plugins"}, {"context", "Context"}, {"history", "History"},
	}
	var parts []string
	for _, t := range tabs {
		if t.key == m.activeView {
			parts = append(parts, lipgloss.NewStyle().
				Foreground(theme.Purple).Bold(true).Render(" ["+t.label+"] "))
		} else {
			parts = append(parts, lipgloss.NewStyle().
				Foreground(theme.DarkSlate).Render("  "+t.label+"  "))
		}
	}
	return "  " + strings.Join(parts, "")
}

// --- Pipeline ---

func (m Model) viewPipeline() string {
	total := len(pipelinePhases)
	cur := m.pipelinePhase
	if cur >= total {
		cur = total - 1
	}
	var bar strings.Builder
	for i := 0; i < total; i++ {
		if i < cur {
			bar.WriteString(lipgloss.NewStyle().Foreground(theme.Teal).Render("--"))
		} else if i == cur {
			bar.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("--"))
		} else {
			bar.WriteString(lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("--"))
		}
	}
	label := m.spinner.View() + " " +
		lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render(m.pipelineMsg) +
		lipgloss.NewStyle().Foreground(theme.Dim).Render(fmt.Sprintf(" [%d/%d]", cur+1, total))
	return " " + bar.String() + "  " + label
}

// --- Input ---

func (m Model) viewInput() string {
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

// --- Nav hints for non-chat views ---

func (m Model) viewNavHints() string {
	var hint string
	switch m.activeView {
	case "plugins":
		hint = "  arrows navigate | space toggle | esc back to chat"
	case "context":
		hint = "  scroll to view | esc back to chat"
	case "history":
		hint = "  up/down select | enter load | d delete | esc back"
	}
	return lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(hint)
}

// --- Status bar ---

func (m Model) viewStatus() string {
	leftParts := "  ctrl+t mode | ctrl+s save | tab views | esc quit"
	left := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(leftParts)
	uptime := time.Since(m.startTime).Round(time.Second)
	right := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(fmt.Sprintf("uptime %s  ", uptime))
	gap := m.width - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

// --- Content refresh ---

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
		m.viewport.SetContent(m.renderContext())
	case "history":
		m.viewport.SetContent(m.renderHistoryList())
	}
}

// --- Chat content ---

func (m Model) renderChat() string {
	if len(m.history) == 0 {
		return m.renderWelcome()
	}
	var b strings.Builder
	for i, e := range m.history {
		b.WriteString(renderEntry(e, m.width))
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
		dim("  Type a prompt and press Enter to start."),
		dim("  Use Ctrl+T to switch between BUILD and CHAT modes."),
		dim("  Press Tab to navigate between views."),
		"",
		dim("  BUILD  Full AI orchestration pipeline"),
		dim("  CHAT   Direct AI conversation"),
	}, "\n")
}

func renderEntry(e ChatEntry, w int) string {
	ts := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(e.Timestamp.Format("15:04:05"))
	switch e.Role {
	case "user":
		lbl := lipgloss.NewStyle().Foreground(theme.Cyan).Bold(true).Render("> You")
		txt := lipgloss.NewStyle().Foreground(theme.White).Render(e.Content)
		return fmt.Sprintf(" %s %s\n   %s", ts, lbl, txt)
	case "assistant":
		lbl := lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("* Meteoroid")
		txt := lipgloss.NewStyle().Foreground(theme.White).Render(e.Content)
		meta := fmtMeta(e.Meta)
		return fmt.Sprintf(" %s %s\n   %s%s", ts, lbl, txt, meta)
	case "code":
		lbl := lipgloss.NewStyle().Foreground(theme.Teal).Bold(true).Render("* Code")
		hdr := ""
		if e.Meta != nil && e.Meta["subtask"] != "" {
			hdr = "\n   " + lipgloss.NewStyle().Foreground(theme.Cyan).Render(e.Meta["subtask"])
		}
		code := lipgloss.NewStyle().Foreground(theme.Teal).Render(e.Content)
		return fmt.Sprintf(" %s %s%s\n   %s", ts, lbl, hdr, code)
	case "system":
		lbl := lipgloss.NewStyle().Foreground(theme.Amber).Bold(true).Render("* System")
		return fmt.Sprintf(" %s %s  %s", ts, lbl, lipgloss.NewStyle().Foreground(theme.Amber).Render(e.Content))
	case "error":
		lbl := lipgloss.NewStyle().Foreground(theme.Rose).Bold(true).Render("! Error")
		return fmt.Sprintf(" %s %s  %s", ts, lbl, lipgloss.NewStyle().Foreground(theme.Rose).Render(e.Content))
	case "pipeline":
		lbl := lipgloss.NewStyle().Foreground(theme.Indigo).Bold(true).Render("> Pipeline")
		lines := strings.Split(e.Content, "\n")
		var r []string
		for _, l := range lines {
			r = append(r, lipgloss.NewStyle().Foreground(theme.Slate).Render(l))
		}
		return fmt.Sprintf(" %s %s\n   %s", ts, lbl, strings.Join(r, "\n   "))
	}
	return "  " + e.Content
}

// --- Plugins content ---

func (m Model) renderPlugins() string {
	var s strings.Builder
	s.WriteString("\n")
	s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  Plugin Manager"))
	s.WriteString("\n")
	s.WriteString(dim("  Select plugins to include in your tech stack context"))
	s.WriteString("\n\n")

	// Category tabs
	for i, cat := range m.catalog {
		name := cat.Name
		if i == m.pluginCatIdx {
			s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  [" + name + "]"))
		} else {
			s.WriteString(lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("   " + name + " "))
		}
	}
	s.WriteString("\n")
	s.WriteString(dim("  " + strings.Repeat("-", 60)))
	s.WriteString("\n\n")

	// Items for active category
	if m.pluginCatIdx < len(m.catalog) {
		cat := m.catalog[m.pluginCatIdx]
		for i, p := range cat.Plugins {
			key := fmt.Sprintf("%d:%d", m.pluginCatIdx, i)
			enabled := m.enabledPlugins[key]

			cursor := "  "
			if i == m.pluginItemIdx {
				cursor = lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("> ")
			}

			check := "[ ]"
			if enabled {
				check = lipgloss.NewStyle().Foreground(theme.Teal).Render("[x]")
			} else {
				check = lipgloss.NewStyle().Foreground(theme.DarkSlate).Render("[ ]")
			}

			name := p.Name
			if i == m.pluginItemIdx {
				name = lipgloss.NewStyle().Foreground(theme.White).Bold(true).Render(p.Name)
			} else if enabled {
				name = lipgloss.NewStyle().Foreground(theme.Teal).Render(p.Name)
			} else {
				name = lipgloss.NewStyle().Foreground(theme.Slate).Render(p.Name)
			}

			desc := lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(p.Desc)

			// Pad name to 20 chars for alignment
			rawName := p.Name
			pad := 20 - len(rawName)
			if pad < 1 {
				pad = 1
			}

			s.WriteString(fmt.Sprintf("  %s %s %s%s%s\n", cursor, check, name, strings.Repeat(" ", pad), desc))
		}
	}

	// Enabled summary
	s.WriteString("\n")
	var enabled []string
	for key, on := range m.enabledPlugins {
		if !on {
			continue
		}
		var ci, pi int
		fmt.Sscanf(key, "%d:%d", &ci, &pi)
		if ci < len(m.catalog) && pi < len(m.catalog[ci].Plugins) {
			enabled = append(enabled, m.catalog[ci].Plugins[pi].Name)
		}
	}
	if len(enabled) > 0 {
		s.WriteString(dim("  Active: "))
		s.WriteString(lipgloss.NewStyle().Foreground(theme.Teal).Render(strings.Join(enabled, ", ")))
	} else {
		s.WriteString(dim("  No plugins enabled"))
	}

	return s.String()
}

// --- Context content ---

func (m Model) renderContext() string {
	var s strings.Builder
	s.WriteString("\n")
	s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  Context Inspector"))
	s.WriteString("\n")
	s.WriteString(dim("  Shows the context built from your last prompt"))
	s.WriteString("\n\n")

	if m.lastResponse == nil {
		s.WriteString(dim("  No context available yet. Send a prompt in Chat view first."))
		return s.String()
	}

	r := m.lastResponse

	// Intent
	if r.IntentAnalysis != nil {
		s.WriteString(section("  Intent Analysis"))
		s.WriteString(field("    Intent", r.IntentAnalysis.Intent))
		s.WriteString(field("    Language", r.IntentAnalysis.Language))
		s.WriteString(field("    Framework", r.IntentAnalysis.Framework))
		s.WriteString(field("    Confidence", fmt.Sprintf("%.0f%%", r.IntentAnalysis.Confidence*100)))
		if r.IntentAnalysis.Reasoning != "" {
			s.WriteString(field("    Reasoning", r.IntentAnalysis.Reasoning))
		}
		s.WriteString("\n")
	}

	// Pipeline info
	s.WriteString(section("  Pipeline Summary"))
	s.WriteString(field("    Task ID", r.TaskID))
	s.WriteString(field("    Success", fmt.Sprintf("%v", r.Success)))
	s.WriteString(field("    Steps", fmt.Sprintf("%d", r.Steps)))
	s.WriteString(field("    Duration", fmt.Sprintf("%.1fs", r.TotalDuration/1000)))
	s.WriteString(field("    Vector Learning", fmt.Sprintf("%v", r.VectorUsed)))
	s.WriteString("\n")

	// Agents
	if len(r.AgentsExecuted) > 0 {
		s.WriteString(section("  Agents Executed"))
		for _, a := range r.AgentsExecuted {
			s.WriteString("    " + lipgloss.NewStyle().Foreground(theme.Cyan).Render("- "+a) + "\n")
		}
		s.WriteString("\n")
	}

	// Generated files
	if len(r.GeneratedCode) > 0 {
		s.WriteString(section("  Generated Files"))
		for i, c := range r.GeneratedCode {
			label := fmt.Sprintf("    %d. ", i+1)
			if c.Subtask != "" {
				label += c.Subtask
			} else {
				label += "(unnamed)"
			}
			if c.Agent != "" {
				label += " [" + c.Agent + "]"
			}
			s.WriteString(lipgloss.NewStyle().Foreground(theme.Slate).Render(label) + "\n")
		}
		s.WriteString("\n")
	}

	// Enabled plugins
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
		s.WriteString(section("  Active Plugins"))
		for _, p := range active {
			s.WriteString("    " + lipgloss.NewStyle().Foreground(theme.Teal).Render("[x] "+p) + "\n")
		}
	}

	return s.String()
}

// --- History list ---

func (m Model) renderHistoryList() string {
	var s strings.Builder
	s.WriteString("\n")
	s.WriteString(lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("  Chat History"))
	s.WriteString("\n")
	s.WriteString(dim("  Saved sessions (Ctrl+S in chat to save)"))
	s.WriteString("\n\n")

	if len(m.sessions) == 0 {
		s.WriteString(dim("  No saved sessions yet."))
		return s.String()
	}

	for i, sess := range m.sessions {
		cursor := "  "
		if i == m.historyIdx {
			cursor = lipgloss.NewStyle().Foreground(theme.Purple).Bold(true).Render("> ")
		}

		ts := sess.Timestamp.Format("2006-01-02 15:04")
		var tsStyled, preview, count string
		if i == m.historyIdx {
			tsStyled = lipgloss.NewStyle().Foreground(theme.Cyan).Render(ts)
			preview = lipgloss.NewStyle().Foreground(theme.White).Render(sess.Preview)
			count = lipgloss.NewStyle().Foreground(theme.Dim).Render(fmt.Sprintf(" (%d msgs)", sess.Count))
		} else {
			tsStyled = lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(ts)
			preview = lipgloss.NewStyle().Foreground(theme.Slate).Render(sess.Preview)
			count = lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(fmt.Sprintf(" (%d msgs)", sess.Count))
		}

		s.WriteString(fmt.Sprintf("  %s %s  %s%s\n", cursor, tsStyled, preview, count))
	}

	return s.String()
}

// --- Helpers ---

func dimLine(w int) string {
	return lipgloss.NewStyle().Foreground(theme.DarkSlate).Render(strings.Repeat("-", w))
}

func dim(s string) string {
	return lipgloss.NewStyle().Foreground(theme.Slate).Render(s)
}

func section(title string) string {
	return lipgloss.NewStyle().Foreground(theme.Indigo).Bold(true).Render(title) + "\n"
}

func field(label, value string) string {
	l := lipgloss.NewStyle().Foreground(theme.Dim).Render(label + ": ")
	v := lipgloss.NewStyle().Foreground(theme.White).Render(value)
	return l + v + "\n"
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
