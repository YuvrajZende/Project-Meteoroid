package tui

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// SavedSession is a persisted chat session
type SavedSession struct {
	ID        string      `json:"id"`
	Timestamp time.Time   `json:"timestamp"`
	Preview   string      `json:"preview"`
	Count     int         `json:"count"`
	Entries   []ChatEntry `json:"entries"`
}

// Store handles persistence
type Store struct {
	dir string
}

func newStore() *Store {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".meteoroid")
	os.MkdirAll(dir, 0755)
	return &Store{dir: dir}
}

// --- Sessions ---

func (s *Store) SaveSession(entries []ChatEntry) error {
	sessions := s.LoadSessions()
	preview := ""
	for _, e := range entries {
		if e.Role == "user" {
			preview = e.Content
			break
		}
	}
	if len(preview) > 60 {
		preview = preview[:57] + "..."
	}
	if preview == "" {
		preview = "(empty session)"
	}
	sess := SavedSession{
		ID: time.Now().Format("20060102-150405"), Timestamp: time.Now(),
		Preview: preview, Count: len(entries), Entries: entries,
	}
	sessions = append([]SavedSession{sess}, sessions...)
	if len(sessions) > 50 {
		sessions = sessions[:50]
	}
	data, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dir, "sessions.json"), data, 0644)
}

func (s *Store) LoadSessions() []SavedSession {
	data, err := os.ReadFile(filepath.Join(s.dir, "sessions.json"))
	if err != nil {
		return nil
	}
	var sessions []SavedSession
	json.Unmarshal(data, &sessions)
	return sessions
}

func (s *Store) DeleteSession(idx int) {
	sessions := s.LoadSessions()
	if idx < 0 || idx >= len(sessions) {
		return
	}
	sessions = append(sessions[:idx], sessions[idx+1:]...)
	data, _ := json.MarshalIndent(sessions, "", "  ")
	os.WriteFile(filepath.Join(s.dir, "sessions.json"), data, 0644)
}

// --- Plugin configs ---

func (s *Store) SavePluginConfigs(configs map[string]map[string]string, enabled map[string]bool) error {
	payload := map[string]interface{}{
		"configs": configs,
		"enabled": enabled,
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dir, "plugins.json"), data, 0644)
}

func (s *Store) LoadPluginConfigs() (map[string]map[string]string, map[string]bool) {
	data, err := os.ReadFile(filepath.Join(s.dir, "plugins.json"))
	if err != nil {
		return make(map[string]map[string]string), make(map[string]bool)
	}
	var payload struct {
		Configs map[string]map[string]string `json:"configs"`
		Enabled map[string]bool              `json:"enabled"`
	}
	json.Unmarshal(data, &payload)
	if payload.Configs == nil {
		payload.Configs = make(map[string]map[string]string)
	}
	if payload.Enabled == nil {
		payload.Enabled = make(map[string]bool)
	}
	return payload.Configs, payload.Enabled
}
