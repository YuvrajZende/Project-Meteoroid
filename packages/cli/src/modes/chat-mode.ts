/**
 * Meteoroid CLI - Chat Mode
 * Interactive chat interface with context awareness, similar to Claude Code
 */

import readline from 'readline';
import { api } from '../utils/index.js';
import { showStatusBar, createSpinner, emptyLine, separator } from '../utils/ui.js';
import { colors } from '../utils/theme.js';
import { executeCommand } from '../commands/slash-commands.js';
import { llmClient } from '../utils/llm-client.js';

// ═══════════════════════════════════════════════════════════════════════════
// CHAT CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

export interface ChatContext {
    messages: ChatMessage[];
    mode: 'chat' | 'code' | 'analyze';
    model?: string;
    projectPath?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// READLINE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

let rl: readline.Interface | null = null;
let shouldExit = false;

function createInterface(): readline.Interface {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        // Handle SIGINT (Ctrl+C)
        rl.on('SIGINT', () => {
            shouldExit = true;
            console.log();
            console.log(colors.muted('Exiting...'));
            process.exit(0);
        });

        // Handle close event
        rl.on('close', () => {
            if (!shouldExit) {
                // Unexpected close, recreate interface
                rl = null;
            }
        });
    }
    return rl;
}

function closeInterface(): void {
    shouldExit = true;
    if (rl) {
        rl.close();
        rl = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════

function getPrompt(mode: string): string {
    switch (mode) {
        case 'chat':
            return colors.cyan('Chat') + colors.dim(' > ');
        case 'code':
            return colors.green('Code') + colors.dim(' > ');
        case 'analyze':
            return colors.yellow('Analyze') + colors.dim(' > ');
        default:
            return colors.cyan('You') + colors.dim(' > ');
    }
}

function getSystemPrompt(mode: string): string {
    switch (mode) {
        case 'code':
            return `You are Meteoroid, an expert AI coding assistant. You help developers write clean, efficient, production-ready code.
When asked to generate code:
- Write complete, working implementations
- Include proper error handling
- Add helpful comments
- Follow best practices for the language/framework
Be concise but thorough. Focus on practical, implementable solutions.`;
        case 'analyze':
            return `You are Meteoroid, an AI analysis assistant. You help developers understand and analyze code, architecture, and technical concepts.
When analyzing:
- Break down complex problems
- Identify patterns and anti-patterns
- Suggest improvements
- Explain trade-offs
Be thorough in your analysis while remaining clear and actionable.`;
        default:
            return `You are Meteoroid, a helpful AI assistant for software development. You help developers with coding questions, debugging, architecture decisions, and general programming topics.
Be friendly, concise, and practical. When providing code examples, ensure they are correct and well-formatted.`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT MODE
// ═══════════════════════════════════════════════════════════════════════════

export async function startChatMode(context: Partial<ChatContext> = {}): Promise<void> {
    const chatContext: ChatContext = {
        messages: [],
        mode: 'chat',
        ...context,
    };

    const iface = createInterface();

    // Show welcome
    console.log();
    console.log(colors.primary('Chat Mode'));
    console.log(colors.muted('─────────────────────────────────────────────────────────────'));
    console.log();

    // Initialize LLM client
    const llmInit = llmClient.initialize();
    if (llmInit.success) {
        console.log(colors.success(`LLM Connected: ${llmInit.provider} (${llmInit.model})`));
        chatContext.model = `${llmInit.provider}/${llmInit.model}`;
    } else {
        console.log(colors.warning(`No LLM configured: ${llmInit.error}`));
        console.log(colors.muted('Chat will try to connect to API server at localhost:3000'));
    }
    console.log();

    console.log(colors.muted('Chat with the AI assistant. Type /help for available commands.'));
    console.log(colors.muted('Use ') + colors.cyan('/chat') + colors.muted(', ') + colors.cyan('/code') + colors.muted(' or ') + colors.cyan('/analyze') + colors.muted(' to switch modes.'));
    console.log(colors.muted('Type ') + colors.cyan('exit') + colors.muted(' or ') + colors.cyan('/exit') + colors.muted(' to quit.'));
    console.log();

    // Main chat loop
    while (true) {
        // Update status bar
        showStatusBar({
            mode: chatContext.mode.toUpperCase(),
            model: chatContext.model || 'default',
            status: 'ready',
        });

        // Get user input
        const input = await new Promise<string>((resolve) => {
            iface.question(getPrompt(chatContext.mode), (answer) => {
                resolve(answer.trim());
            });
        });

        // Check for empty input
        if (!input) continue;

        // Check for exit
        if (input === 'exit' || input === 'quit') {
            console.log();
            console.log(colors.muted('Exiting chat mode...'));
            console.log();
            break;
        }

        // Detect CLI commands typed in chat mode
        if (input.startsWith('meteoroid ') || input === 'meteoroid') {
            console.log();
            console.log(colors.warning('This is a CLI command. Exit chat mode first, then run it in your terminal:'));
            console.log();
            console.log(`  ${colors.cyan(input)}`);
            console.log();
            console.log(colors.muted('Type "exit" to leave chat mode.'));
            console.log();
            continue;
        }

        // Handle slash commands
        if (input.startsWith('/')) {
            // Handle mode switching
            if (input === '/chat') {
                chatContext.mode = 'chat';
                console.log(colors.success('Switched to chat mode'));
                console.log();
                continue;
            }
            if (input === '/code') {
                chatContext.mode = 'code';
                console.log(colors.success('Switched to code mode'));
                console.log();
                continue;
            }
            if (input === '/analyze') {
                chatContext.mode = 'analyze';
                console.log(colors.success('Switched to analyze mode'));
                console.log();
                continue;
            }

            // Handle other commands
            const wasCommand = await executeCommand(input);
            if (wasCommand) {
                continue;
            }

            // Unknown command
            console.log(colors.error(`Unknown command: ${input}`));
            console.log(colors.muted('Type /help for available commands'));
            console.log();
            continue;
        }

        // Process as message
        await processMessage(input, chatContext);
    }

    closeInterface();
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

async function processMessage(input: string, context: ChatContext): Promise<void> {
    // Add user message to context
    context.messages.push({
        role: 'user',
        content: input,
        timestamp: new Date(),
    });

    // Show user message
    console.log();
    console.log(colors.cyan.bold('You') + colors.dim(' > ') + colors.white(input));
    console.log();

    try {
        // Try direct LLM first (works without API server)
        if (llmClient.isInitialized()) {
            // Show thinking indicator (no spinner to avoid readline issues)
            console.log(colors.dim('Thinking...'));

            // Build messages for LLM
            const llmMessages = [
                { role: 'system' as const, content: getSystemPrompt(context.mode) },
                ...context.messages.map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                })),
            ];

            const response = await llmClient.chat(llmMessages);

            if (response.success && response.content) {
                // Show response
                console.log();
                console.log(colors.primary.bold('AI') + colors.dim(' > '));
                console.log(colors.white(response.content));
                console.log();

                // Add to context
                context.messages.push({
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date(),
                });

                // Show token usage if available
                if (response.usage) {
                    console.log(colors.dim(`[${response.usage.totalTokens} tokens]`));
                    console.log();
                }
            } else {
                console.log(colors.error(`LLM Error: ${response.error}`));
                console.log();
            }
            return; // Return after direct LLM call (loop will continue)
        }

        // Fallback to API server - use spinner here since we're not in readline loop
        const spin = createSpinner('Thinking...');
        let endpoint = '/orchestrator/chat';
        let body: any = { message: input };

        if (context.mode === 'code') {
            endpoint = '/orchestrator/execute';
            body = { prompt: input };
        } else if (context.mode === 'analyze') {
            endpoint = '/orchestrator/think';
            body = { task: input, useAI: true };
        }

        // Make request
        const response = await api.post<any>(endpoint, body);

        spin.stop();

        if (!response.success) {
            console.log(colors.error(`Error: ${response.error}`));
            console.log();

            // Add error as system message
            context.messages.push({
                role: 'system',
                content: `Error: ${response.error}`,
                timestamp: new Date(),
            });
            return;
        }

        // Extract response based on mode
        let assistantMessage = '';

        if (context.mode === 'chat') {
            assistantMessage = response.data?.response || 'No response';
        } else if (context.mode === 'code') {
            const data = response.data;

            // Handle question detection
            if (data.isQuestion && data.answer) {
                assistantMessage = data.answer;
            } else {
                // Build code generation response
                const parts: string[] = [];

                if (data.intentAnalysis) {
                    parts.push(`Intent: ${data.intentAnalysis.intent}`);
                    parts.push(`Language: ${data.intentAnalysis.language || 'auto'}`);
                    parts.push(`Framework: ${data.intentAnalysis.framework || 'none'}`);
                }

                if (data.fileWriteResult?.filesWritten) {
                    parts.push(`\nFiles written: ${data.fileWriteResult.filesWritten.length}`);
                    data.fileWriteResult.filesWritten.slice(0, 5).forEach((f: string) => {
                        parts.push(`  • ${f}`);
                    });
                    if (data.fileWriteResult.filesWritten.length > 5) {
                        parts.push(`  ... and ${data.fileWriteResult.filesWritten.length - 5} more`);
                    }
                }

                if (data.generatedCode) {
                    parts.push(`\nGenerated ${data.generatedCode.length} components:`);
                    data.generatedCode.slice(0, 3).forEach((c: any) => {
                        parts.push(`  • ${c.subtask}`);
                        if (c.explanation) {
                            parts.push(`    ${c.explanation.substring(0, 100)}...`);
                        }
                    });
                }

                assistantMessage = parts.join('\n');
            }
        } else if (context.mode === 'analyze') {
            const data = response.data;
            const parts: string[] = [];

            if (data.localAnalysis) {
                parts.push(`Complexity: ${data.localAnalysis.complexity}`);
                if (data.localAnalysis.requirements?.length) {
                    parts.push(`\nRequirements:`);
                    data.localAnalysis.requirements.forEach((r: string) => {
                        parts.push(`  • ${r}`);
                    });
                }
                if (data.localAnalysis.suggestedAgents?.length) {
                    parts.push(`\nSuggested Agents:`);
                    data.localAnalysis.suggestedAgents.forEach((a: string) => {
                        parts.push(`  • ${a}`);
                    });
                }
            }

            assistantMessage = parts.join('\n');
        }

        // Show assistant response
        console.log(colors.primary.bold('Assistant') + colors.dim(' > '));
        console.log(colors.white(assistantMessage));
        console.log();

        // Add to context
        context.messages.push({
            role: 'assistant',
            content: assistantMessage,
            timestamp: new Date(),
        });

        // Show separator
        separator();

    } catch (err) {
        console.log(colors.error(`Failed: ${err}`));
        console.log();

        context.messages.push({
            role: 'system',
            content: `Error: ${err}`,
            timestamp: new Date(),
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// STREAMING CHAT (future enhancement)
// ═══════════════════════════════════════════════════════════════════════════

export async function startStreamingChatMode(): Promise<void> {
    // TODO: Implement SSE-based streaming chat
    console.log(colors.muted('Streaming chat not yet implemented. Use regular chat mode.'));
}

export default {
    startChatMode,
    startStreamingChatMode,
};
