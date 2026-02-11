package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"meteoroid/internal/config"
	"meteoroid/internal/tui"
)

func main() {
	cfg := config.Load()

	m := tui.NewModel(cfg)

	p := tea.NewProgram(m, tea.WithAltScreen(), tea.WithMouseCellMotion())

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running Meteoroid: %v\n", err)
		os.Exit(1)
	}
}
