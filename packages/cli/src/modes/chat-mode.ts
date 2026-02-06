/**
 * Meteoroid CLI - Chat Mode
 * Interactive chat interface with context awareness, similar to Claude Code
 */

import readline from 'readline';
import { api } from '../utils/index.js';
import { showStatusBar, createSpinner, emptyLine, separator } from '../utils/ui.js';
import { colors } from '../utils/theme.js';
import { executeCommand } from '../commands/slash-commands.js';

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

function createInterface(): readline.Interface {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
    return rl;
}

function closeInterface(): void {
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

    // Create spinner
    const spin = createSpinner('Thinking...');

    try {
        // Choose endpoint based on mode
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
        spin.stop();
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
