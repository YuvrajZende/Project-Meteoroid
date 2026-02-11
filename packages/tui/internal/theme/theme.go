package theme

import "github.com/charmbracelet/lipgloss"

// ──────────────────────────────────────────────────────────────
// Meteoroid Color Palette
// ──────────────────────────────────────────────────────────────

var (
	// Core brand colours
	Purple     = lipgloss.Color("#A78BFA") // primary accent
	Violet     = lipgloss.Color("#8B5CF6") // headers
	Indigo     = lipgloss.Color("#6366F1") // active states
	Cyan       = lipgloss.Color("#22D3EE") // info / highlights
	Teal       = lipgloss.Color("#2DD4BF") // success
	Amber      = lipgloss.Color("#FBBF24") // warnings
	Rose       = lipgloss.Color("#FB7185") // errors
	Slate      = lipgloss.Color("#94A3B8") // muted text
	DarkSlate  = lipgloss.Color("#475569") // borders / dim
	Surface    = lipgloss.Color("#0F172A") // dark bg
	SurfaceAlt = lipgloss.Color("#1E293B") // slightly lighter bg
	White      = lipgloss.Color("#F8FAFC") // primary text
	Dim        = lipgloss.Color("#64748B") // dimmed text
)

// ──────────────────────────────────────────────────────────────
// Reusable Styles
// ──────────────────────────────────────────────────────────────

// Header renders the top logo / title bar
var Header = lipgloss.NewStyle().
	Bold(true).
	Foreground(Purple).
	PaddingLeft(1)

// StatusBar is the bottom bar
var StatusBar = lipgloss.NewStyle().
	Foreground(Dim).
	PaddingLeft(1).
	PaddingRight(1)

// UserPrompt for the input prompt indicator
var UserPrompt = lipgloss.NewStyle().
	Foreground(Cyan).
	Bold(true)

// AILabel for the AI response block label
var AILabel = lipgloss.NewStyle().
	Foreground(Purple).
	Bold(true)

// SystemLabel for system messages
var SystemLabel = lipgloss.NewStyle().
	Foreground(Amber).
	Bold(true)

// ErrorLabel for error messages
var ErrorLabel = lipgloss.NewStyle().
	Foreground(Rose).
	Bold(true)

// SuccessLabel for success indicators
var SuccessLabel = lipgloss.NewStyle().
	Foreground(Teal).
	Bold(true)

// Muted text
var Muted = lipgloss.NewStyle().
	Foreground(Dim)

// Subtle text (slightly brighter than muted)
var Subtle = lipgloss.NewStyle().
	Foreground(Slate)

// Border box for panels
var PanelBox = lipgloss.NewStyle().
	Border(lipgloss.RoundedBorder()).
	BorderForeground(DarkSlate).
	Padding(0, 1)

// ActivePanelBox has highlighted border
var ActivePanelBox = lipgloss.NewStyle().
	Border(lipgloss.RoundedBorder()).
	BorderForeground(Purple).
	Padding(0, 1)

// CodeBlock for displaying generated code
var CodeBlock = lipgloss.NewStyle().
	Foreground(Teal).
	PaddingLeft(2)

// PhaseIndicator for showing pipeline phases
var PhaseIndicator = lipgloss.NewStyle().
	Foreground(Indigo).
	Bold(true)

// Badge style for tags (e.g., language/framework)
var Badge = lipgloss.NewStyle().
	Foreground(Surface).
	Background(Purple).
	Padding(0, 1).
	Bold(true)

// DimBadge for secondary tags
var DimBadge = lipgloss.NewStyle().
	Foreground(White).
	Background(DarkSlate).
	Padding(0, 1)

// SpinnerDot style
var SpinnerDot = lipgloss.NewStyle().
	Foreground(Purple)

// Divider line
func Divider(width int) string {
	line := ""
	for i := 0; i < width; i++ {
		line += "─"
	}
	return lipgloss.NewStyle().Foreground(DarkSlate).Render(line)
}
