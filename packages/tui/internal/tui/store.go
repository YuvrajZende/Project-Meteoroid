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

// Store handles chat history persistence
type Store struct {
	dir string
}

func newStore() *Store {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".meteoroid")
	os.MkdirAll(dir, 0755)
	return &Store{dir: dir}
}

func (s *Store) path() string {
	return filepath.Join(s.dir, "sessions.json")
}

func (s *Store) Save(entries []ChatEntry) error {
	sessions := s.Load()
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
		ID:        time.Now().Format("20060102-150405"),
		Timestamp: time.Now(),
		Preview:   preview,
		Count:     len(entries),
		Entries:   entries,
	}
	sessions = append([]SavedSession{sess}, sessions...)
	if len(sessions) > 50 {
		sessions = sessions[:50]
	}
	data, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path(), data, 0644)
}

func (s *Store) Load() []SavedSession {
	data, err := os.ReadFile(s.path())
	if err != nil {
		return nil
	}
	var sessions []SavedSession
	json.Unmarshal(data, &sessions)
	return sessions
}

func (s *Store) Delete(idx int) {
	sessions := s.Load()
	if idx < 0 || idx >= len(sessions) {
		return
	}
	sessions = append(sessions[:idx], sessions[idx+1:]...)
	data, _ := json.MarshalIndent(sessions, "", "  ")
	os.WriteFile(s.path(), data, 0644)
}
