package config

import "os"

// Config holds all configuration for the TUI
type Config struct {
	APIBaseURL string
	APIPort    string
	SSEBaseURL string
}

// Load reads configuration from environment variables with defaults
func Load() *Config {
	cfg := &Config{
		APIBaseURL: getEnv("METEOROID_API_URL", "http://localhost"),
		APIPort:    getEnv("METEOROID_API_PORT", "3000"),
	}
	cfg.SSEBaseURL = cfg.APIBaseURL + ":" + cfg.APIPort
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
