# 🚀 Loveable CLI

> **AI-Powered Backend Testing & Development Interface**

A beautiful, premium command-line interface for testing and interacting with the Loveable Backend system. Test all features including AI code generation, service integrations, authentication, and more!

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                          🚀 LOVEABLE CLI                                  ║
║          AI-Powered Backend Testing & Development Interface               ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

## ✨ Features

### 🧠 AI Orchestrator
- Interactive code generation with AI
- Intent analysis testing
- Vector search testing
- Multi-model pipeline testing

### 🤖 AI Agents
- View all registered agents
- Browse agent capabilities
- View benchmark results

### 💻 Code Generator
- Generate from templates
- Quick project scaffolding
- Database schema generation
- API route generation

### 🔌 Service Registry (Phase 21)
- Browse 100+ available services
- Search by category
- View service details and templates

### 🔗 Connections
- Manage service connections
- Test connections
- Create new integrations

### 🔐 Authentication
- Login/Register testing
- Token refresh testing
- API key validation
- Protected endpoint testing

### 🚀 Live Preview
- Create preview sessions
- Manage sandbox environments
- View session metrics

### ⚙️ System
- Health checks
- CLI configuration

## 🛠️ Installation

```bash
# Navigate to CLI package
cd packages/cli

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build and run
npm run build
npm start
```

## 📋 Usage

### Interactive Mode (Default)

```bash
npm run dev
```

This starts the beautiful interactive menu where you can navigate through all features.

### Direct Commands

```bash
# Check server health
npm run dev -- health

# Browse services
npm run dev -- services

# Start code generation
npm run dev -- generate

# View AI agents
npm run dev -- agents

# Authentication testing
npm run dev -- auth

# Preview management
npm run dev -- preview
```

## 🎨 UI Features

The CLI includes a premium visual experience with:

- **Gradient banners** - Beautiful ASCII art with color gradients
- **Animated spinners** - Loading indicators for async operations
- **Styled tables** - Clean data presentation
- **Status indicators** - Clear success/error/warning states
- **Interactive menus** - Easy navigation with arrow keys
- **Syntax highlighting** - Code blocks with highlighting
- **Progress bars** - Visual feedback for long operations

## 📁 Project Structure

```
packages/cli/
├── src/
│   ├── index.ts           # Main entry point
│   ├── commands/          # Command modules
│   │   ├── health.ts      # Health check command
│   │   ├── services.ts    # Service registry
│   │   ├── orchestrator.ts # AI orchestrator
│   │   ├── agents.ts      # AI agents
│   │   ├── auth.ts        # Authentication
│   │   ├── codegen.ts     # Code generation
│   │   ├── connections.ts # Service connections
│   │   ├── preview.ts     # Live preview
│   │   └── config.ts      # CLI configuration
│   └── utils/
│       ├── theme.ts       # Colors, gradients, icons
│       ├── api.ts         # HTTP client
│       └── ui.ts          # UI components
├── package.json
└── tsconfig.json
```

## 🔧 Configuration

The CLI can be configured through the interactive Config menu:

- **Server URL** - Backend server address (default: `http://localhost:3000`)
- **API Version** - API version to use (default: `v1`)

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `chalk` | Terminal colors |
| `ora` | Spinners |
| `inquirer` | Interactive prompts |
| `boxen` | Styled boxes |
| `gradient-string` | Color gradients |
| `cli-table3` | Tables |
| `figlet` | ASCII art |
| `commander` | CLI framework |

## 🚀 Quick Start

1. **Start your backend server** (in another terminal):
   ```bash
   npm run dev
   ```

2. **Run the CLI**:
   ```bash
   cd packages/cli
   npm run dev
   ```

3. **Select "Health Check"** to verify connection

4. **Explore!** - Try the AI Orchestrator to generate code

## 🎯 Example Workflows

### Generate a REST API

1. Select **AI Orchestrator**
2. Choose **Generate Code (Interactive)**
3. Describe: "Build a REST API for managing tasks with CRUD operations"
4. Select language/framework or let AI decide
5. Watch the generation happen!

### Connect a Service

1. Select **Connections**
2. Choose **Create New Connection**
3. Pick a service (e.g., Supabase)
4. Enter your credentials
5. Test the connection

### Test Authentication

1. Select **Authentication**
2. Choose **Login with Email/Password**
3. Enter credentials
4. Use **Test Protected Endpoint** to verify

---

Made with ❤️ for the Loveable Backend System
