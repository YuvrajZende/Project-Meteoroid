package tui

// PluginCategory groups related plugins
type PluginCategory struct {
	Name    string
	Plugins []PluginItem
}

// PluginItem is a single configurable plugin
type PluginItem struct {
	Name string
	Desc string
}

func defaultCatalog() []PluginCategory {
	return []PluginCategory{
		{Name: "Database", Plugins: []PluginItem{
			{"Supabase", "Open-source Firebase alternative with Postgres"},
			{"Convex", "Reactive backend platform with real-time sync"},
			{"PostgreSQL", "Advanced open-source relational database"},
			{"MongoDB", "Document-oriented NoSQL database"},
			{"MySQL", "Popular open-source relational database"},
			{"Redis", "In-memory data structure store and cache"},
			{"TigerBeetle", "High-performance financial accounting database"},
			{"SQLite", "Lightweight embedded relational database"},
			{"CockroachDB", "Distributed SQL for cloud-native apps"},
			{"PlanetScale", "Serverless MySQL-compatible platform"},
		}},
		{Name: "Security", Plugins: []PluginItem{
			{"OAuth 2.0", "Industry-standard authorization framework"},
			{"JWT Auth", "JSON Web Token authentication"},
			{"API Keys", "Key-based API access control"},
			{"RBAC", "Role-based access control system"},
			{"Encryption", "AES-256 data encryption at rest and transit"},
			{"Rate Limiting", "Request throttling and DDoS protection"},
			{"CORS", "Cross-origin resource sharing configuration"},
			{"Helmet", "HTTP security headers middleware"},
			{"CSRF Protection", "Cross-site request forgery prevention"},
			{"2FA / MFA", "Multi-factor authentication support"},
		}},
		{Name: "CI/CD", Plugins: []PluginItem{
			{"GitHub Actions", "GitHub-native CI/CD workflows"},
			{"GitLab CI", "GitLab integrated pipeline automation"},
			{"Jenkins", "Open-source automation server"},
			{"CircleCI", "Cloud-native continuous integration"},
			{"Docker", "Container build, ship and run"},
			{"Kubernetes", "Container orchestration platform"},
			{"Terraform", "Infrastructure as code provisioning"},
			{"Ansible", "Agentless IT automation"},
			{"ArgoCD", "Declarative GitOps for Kubernetes"},
			{"Vercel", "Frontend deployment and edge functions"},
		}},
		{Name: "Monitoring", Plugins: []PluginItem{
			{"Prometheus", "Metrics collection and alerting toolkit"},
			{"Grafana", "Observability and dashboard platform"},
			{"Datadog", "Cloud-scale monitoring and analytics"},
			{"Sentry", "Error tracking and performance monitoring"},
			{"New Relic", "Full-stack observability platform"},
			{"PagerDuty", "Incident response and on-call management"},
			{"Uptime Robot", "Website and API uptime monitoring"},
			{"LogRocket", "Frontend session replay and analytics"},
			{"Jaeger", "Distributed request tracing system"},
			{"ELK Stack", "Elasticsearch, Logstash, Kibana suite"},
		}},
	}
}
