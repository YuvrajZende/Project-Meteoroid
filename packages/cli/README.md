# Meteoroid CLI

> AI-Powered Backend Development Platform

A comprehensive command-line interface for the Meteoroid platform, similar to Claude Code. Interact with the AI orchestrator, generate code, manage services, and more!

```
╔══════════════════════════════════════════════════════════════════╗
║                         METEOROID CLI                            ║
║              AI-Powered Backend Development Platform            ║
╚══════════════════════════════════════════════════════════════════╝
```

## Features

- **Interactive Chat Mode** - Conversational AI interface with slash commands
- **Code Generation** - Generate complete backend systems with AI
- **Task Analysis** - Analyze requirements before implementation
- **Service Registry** - Browse 100+ available service integrations
- **Agent Management** - View and manage AI agents
- **File Operations** - Read and analyze files from the CLI
- **System Status** - Monitor server health and infrastructure

## Installation

```bash
cd packages/cli
npm install
npm run build
```

## Quick Start

### 1. Start the Backend Server

First, ensure your Meteoroid backend server is running:

```bash
cd packages/api
npm run dev
```

### 2. Use the CLI

```bash
# Interactive chat mode (default)
npm run dev

# Or send a prompt directly
npm run dev "Create a REST API for user management"

# Show help
npm run dev -- --help
```

## Commands

### Default Command (Chat Mode)

```bash
meteoroid [prompt...]
```

Starts interactive chat mode. If a prompt is provided, sends it directly to the AI.

**Examples:**
```bash
meteoroid
meteoroid "Explain how microservices work"
meteoroid --server http://localhost:3000
```

### chat

```bash
meteoroid chat [options] [message...]
```

Start interactive chat mode with optional direct message.

**Options:**
- `-c, --code` - Code generation mode
- `-a, --analyze` - Analysis mode

**Examples:**
```bash
meteoroid chat
meteoroid chat --code "Create a user authentication service"
meteoroid chat --analyze "Implement a scalable caching layer"
```

### generate

```bash
meteoroid generate|gen [options] <prompt>
```

Generate code using AI.

**Options:**
- `-l, --language <lang>` - Programming language
- `-f, --framework <fw>` - Framework
- `-o, --output <path>` - Output directory
- `-q, --quick` - Quick mode (no file writing)

**Examples:**
```bash
meteoroid generate "Create a REST API for task management"
meteoroid gen -l typescript -f fastify "Build user authentication"
meteoroid gen -q "Quick prototype for a blog API"
```

### analyze

```bash
meteoroid analyze|analyse <task>
```

Analyze a task or requirement before implementation.

**Examples:**
```bash
meteoroid analyze "Build a scalable e-commerce backend"
meteoroid analyse "Implement real-time notifications"
```

### status

```bash
meteoroid status
```

Show system status and infrastructure health.

### agents

```bash
meteoroid agents [options]
```

List available AI agents.

**Options:**
- `-v, --verbose` - Show detailed information including capabilities

**Examples:**
```bash
meteoroid agents
meteoroid agents --verbose
```

### services

```bash
meteoroid services [category]
```

Browse the service registry.

**Examples:**
```bash
meteoroid services          # List all categories
meteoroid services database # Show database services
meteoroid services auth     # Show authentication services
```

### read

```bash
meteoroid read [options] <file>
```

Read and display a file.

**Options:**
- `-l, --lines <n>` - Number of lines to show

**Examples:**
```bash
meteoroid read src/app.ts
meteoroid read --lines 50 package.json
```

### config

```bash
meteoroid config [options]
```

Manage CLI configuration.

**Options:**
- `--show` - Show current configuration
- `--set <key>=<value>` - Set configuration value

**Examples:**
```bash
meteoroid config --show
meteoroid config --set server=http://localhost:3000
```

## Slash Commands

When in interactive chat mode, you can use slash commands:

| Command | Description |
|---------|-------------|
| `/help [command]` | Show available commands or detailed help |
| `/status` | Show system status |
| `/health` | Run detailed health check |
| `/agents` | List available agents |
| `/services [category]` | Browse service registry |
| `/read <file>` | Read a file |
| `/generate <prompt>` | Generate code |
| `/config` | Show configuration |
| `/clear` | Clear screen |
| `/version` | Show version info |
| `/chat` | Switch to chat mode |
| `/code` | Switch to code mode |
| `/analyze` | Switch to analyze mode |
| `/exit` or `/quit` | Exit the CLI |

## Chat Modes

The CLI supports three different chat modes:

### Chat Mode (`/chat`)
Default conversational mode for general questions and discussions.

### Code Mode (`/code`)
Specialized mode for code generation and implementation tasks.

### Analyze Mode (`/analyze`)
Analysis mode for breaking down requirements and planning implementations.

## Configuration

### Command Line Options

```bash
# Set custom server URL
meteoroid --server http://localhost:4000

# Set authentication token
meteoroid --token your-api-token

# Enable verbose output
meteoroid --verbose
```

### Environment Variables

You can also configure the CLI via environment variables:

```bash
export METEOROID_SERVER=http://localhost:3000
export METEOROID_TOKEN=your-api-token
```

## Examples

### Generate a Complete Backend

```bash
meteoroid generate "Create a REST API for a todo app with user authentication, database integration, and JWT tokens"
```

### Analyze Before Building

```bash
meteoroid analyze "Design a scalable microservices architecture for an e-commerce platform"
```

### Interactive Session

```bash
meteoroid chat

You > /status
You > /services database
You > What databases are available?
You > /code Create a PostgreSQL service integration
You > /agents
You > /exit
```

## Development

### Project Structure

```
packages/cli/
├── src/
│   ├── index.ts           # Main CLI entry point
│   ├── types.ts           # Type definitions
│   ├── commands/
│   │   └── slash-commands.ts  # Slash command handlers
│   ├── modes/
│   │   └── chat-mode.ts   # Chat mode implementation
│   └── utils/
│       ├── api.ts         # API client
│       ├── theme.ts       # Colors and styling
│       ├── ui.ts          # UI components
│       └── index.ts       # Utility exports
├── dist/                  # Compiled output
├── package.json
└── tsconfig.json
```

### Building

```bash
npm run build    # Compile TypeScript
npm run dev      # Run in development mode
npm start        # Run compiled version
```

## Troubleshooting

### Server Not Reachable

```
[!] Server not reachable
    Some features may not work. Server: http://localhost:3000
```

**Solution:** Make sure the backend server is running:
```bash
cd packages/api
npm run dev
```

### Timeouts on Long Operations

For complex code generation, the operation might timeout. Increase the timeout:

```bash
# The CLI has a 15-minute timeout for code generation
# For longer operations, check the server logs
```

## Roadmap

- [ ] Streaming responses (SSE)
- [ ] Multi-file editing
- [ ] Project initialization wizard
- [ ] Configuration file support
- [ ] Shell completion
- [ ] Plugin system

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## License

ISC

---

Made with ❤️ for the Meteoroid Platform
