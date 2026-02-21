package tui

// PluginField defines a configurable credential for a plugin
type PluginField struct {
	Key    string // map key (e.g. "api_key")
	Label  string // display label (e.g. "API Key")
	Secret bool   // mask input with ****
}

// PluginCategory groups related plugins
type PluginCategory struct {
	Name    string
	Plugins []PluginItem
}

// PluginItem is a single configurable plugin
type PluginItem struct {
	Name   string
	Desc   string
	Fields []PluginField
}

func defaultCatalog() []PluginCategory {
	return []PluginCategory{
		{Name: "Database", Plugins: []PluginItem{
			{"Supabase", "Open-source Firebase alternative with Postgres", []PluginField{
				{"url", "Project URL", false},
				{"anon_key", "Anon Key", true},
				{"service_key", "Service Role Key", true},
			}},
			{"Convex", "Reactive backend platform with real-time sync", []PluginField{
				{"deploy_url", "Deployment URL", false},
				{"deploy_key", "Deploy Key", true},
			}},
			{"PostgreSQL", "Advanced open-source relational database", []PluginField{
				{"connection_url", "Connection URL", true},
			}},
			{"MongoDB", "Document-oriented NoSQL database", []PluginField{
				{"connection_string", "Connection String", true},
			}},
			{"MySQL", "Popular open-source relational database", []PluginField{
				{"connection_url", "Connection URL", true},
			}},
			{"Redis", "In-memory data structure store and cache", []PluginField{
				{"url", "Redis URL", false},
				{"password", "Password", true},
			}},
			{"TigerBeetle", "High-performance financial accounting database", []PluginField{
				{"cluster_id", "Cluster ID", false},
				{"addresses", "Addresses (comma-separated)", false},
			}},
			{"SQLite", "Lightweight embedded relational database", []PluginField{
				{"db_path", "Database File Path", false},
			}},
			{"CockroachDB", "Distributed SQL for cloud-native apps", []PluginField{
				{"connection_url", "Connection URL", true},
			}},
			{"PlanetScale", "Serverless MySQL-compatible platform", []PluginField{
				{"host", "Host", false},
				{"username", "Username", false},
				{"password", "Password", true},
			}},
		}},
		{Name: "Security", Plugins: []PluginItem{
			{"OAuth 2.0", "Industry-standard authorization framework", []PluginField{
				{"client_id", "Client ID", false},
				{"client_secret", "Client Secret", true},
				{"redirect_url", "Redirect URL", false},
			}},
			{"JWT Auth", "JSON Web Token authentication", []PluginField{
				{"secret", "JWT Secret Key", true},
				{"issuer", "Issuer", false},
			}},
			{"API Keys", "Key-based API access control", []PluginField{
				{"header", "Header Name", false},
				{"prefix", "Key Prefix", false},
			}},
			{"RBAC", "Role-based access control system", nil},
			{"Encryption", "AES-256 data encryption at rest and transit", []PluginField{
				{"encryption_key", "Encryption Key", true},
			}},
			{"Rate Limiting", "Request throttling and DDoS protection", []PluginField{
				{"max_requests", "Max Requests per Window", false},
				{"window_seconds", "Window (seconds)", false},
			}},
			{"CORS", "Cross-origin resource sharing configuration", []PluginField{
				{"origins", "Allowed Origins (comma-separated)", false},
			}},
			{"Helmet", "HTTP security headers middleware", nil},
			{"CSRF Protection", "Cross-site request forgery prevention", []PluginField{
				{"secret", "CSRF Secret", true},
			}},
			{"2FA / MFA", "Multi-factor authentication support", []PluginField{
				{"issuer_name", "Issuer Name", false},
			}},
		}},
		{Name: "CI/CD", Plugins: []PluginItem{
			{"GitHub Actions", "GitHub-native CI/CD workflows", []PluginField{
				{"token", "GitHub Token", true},
			}},
			{"GitLab CI", "GitLab integrated pipeline automation", []PluginField{
				{"token", "GitLab Token", true},
				{"project_id", "Project ID", false},
			}},
			{"Jenkins", "Open-source automation server", []PluginField{
				{"url", "Jenkins URL", false},
				{"token", "API Token", true},
			}},
			{"CircleCI", "Cloud-native continuous integration", []PluginField{
				{"token", "CircleCI Token", true},
			}},
			{"Docker", "Container build, ship and run", []PluginField{
				{"registry_url", "Registry URL", false},
				{"username", "Username", false},
				{"password", "Password", true},
			}},
			{"Kubernetes", "Container orchestration platform", []PluginField{
				{"cluster_url", "Cluster URL", false},
				{"token", "Bearer Token", true},
			}},
			{"Terraform", "Infrastructure as code provisioning", nil},
			{"Ansible", "Agentless IT automation", nil},
			{"ArgoCD", "Declarative GitOps for Kubernetes", []PluginField{
				{"server_url", "Server URL", false},
				{"token", "Auth Token", true},
			}},
			{"Vercel", "Frontend deployment and edge functions", []PluginField{
				{"token", "Vercel Token", true},
				{"project_id", "Project ID", false},
			}},
		}},
		{Name: "Monitoring", Plugins: []PluginItem{
			{"Prometheus", "Metrics collection and alerting toolkit", []PluginField{
				{"endpoint", "Scrape Endpoint", false},
			}},
			{"Grafana", "Observability and dashboard platform", []PluginField{
				{"url", "Grafana URL", false},
				{"api_key", "API Key", true},
			}},
			{"Datadog", "Cloud-scale monitoring and analytics", []PluginField{
				{"api_key", "API Key", true},
				{"app_key", "App Key", true},
			}},
			{"Sentry", "Error tracking and performance monitoring", []PluginField{
				{"dsn", "Sentry DSN", true},
			}},
			{"New Relic", "Full-stack observability platform", []PluginField{
				{"license_key", "License Key", true},
			}},
			{"PagerDuty", "Incident response and on-call management", []PluginField{
				{"api_key", "API Key", true},
			}},
			{"Uptime Robot", "Website and API uptime monitoring", []PluginField{
				{"api_key", "API Key", true},
			}},
			{"LogRocket", "Frontend session replay and analytics", []PluginField{
				{"app_id", "App ID", false},
			}},
			{"Jaeger", "Distributed request tracing system", []PluginField{
				{"endpoint", "Collector Endpoint", false},
			}},
			{"ELK Stack", "Elasticsearch, Logstash, Kibana suite", []PluginField{
				{"es_url", "Elasticsearch URL", false},
				{"api_key", "API Key", true},
			}},
		}},
	}
}
