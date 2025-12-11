# CodeGen Agent Module

**Assigned to:** Person 4  
**Status:** ✅ Implemented

## Overview
Complete code generation pipeline with 5 components:

| Agent | Purpose |
|-------|---------|
| **CodegenAgent** | Generates code in memory |
| **ArchitectureAgent** | Creates directories/files (mkdir, touch) |
| **CodeWriterAgent** | Writes code to files |
| **DependencyAgent** | Installs npm packages |
| **CodegenOrchestrator** | Coordinates all agents |

## Complete Workflow
```
1. ArchitectureAgent  →  mkdir, touch (structure)
2. CodegenAgent       →  Generate code (memory)
3. CodeWriterAgent    →  fs.writeFile (to disk)
4. DependencyAgent    →  npm install (packages)
```

## Quick Usage

### Generate Complete Project
```typescript
import { codegenOrchestrator } from './agents';

await codegenOrchestrator.generateProject({
    projectName: 'my-api',
    outputPath: './output/my-api',
    type: 'express',
    modules: ['User', 'Product'],
    installDependencies: true,
});
```

### Generate Single Module
```typescript
await codegenOrchestrator.generateModule('Order', './my-project');
```

## Files
- `index.ts` - CodegenAgent
- `architecture-agent.ts` - ArchitectureAgent
- `codewriter-agent.ts` - CodeWriterAgent
- `dependency-agent.ts` - DependencyAgent
- `orchestrator.ts` - CodegenOrchestrator
- `templates/index.ts` - Code templates
