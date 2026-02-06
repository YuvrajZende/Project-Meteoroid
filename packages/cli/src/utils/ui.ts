/**
 * Meteoroid CLI - UI Utilities
 * Provides enhanced UI components similar to Claude Code
 */

import chalk from 'chalk';
import boxen from 'boxen';
import ora, { Ora } from 'ora';
import { symbols, colors } from './theme.js';

// ═══════════════════════════════════════════════════════════════════════════
// BANNER & HEADER
// ═══════════════════════════════════════════════════════════════════════════

export function showBanner(): void {
    console.clear();
    const banner = boxen(
        chalk.cyan.bold('METEOROID') + '\n' +
        chalk.gray('AI-Powered Backend Development Platform'),
        {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center',
        }
    );
    console.log(banner);
}

export function showWelcome(version: string): void {
    showBanner();
    console.log();
    console.log(chalk.gray(`Version: ${version}`));
    console.log(chalk.gray('Type ') + chalk.cyan('/help') + chalk.gray(' for available commands'));
    console.log(chalk.gray('Type ') + chalk.cyan('exit') + chalk.gray(' or press Ctrl+C to quit'));
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS BAR
// ═══════════════════════════════════════════════════════════════════════════

export interface StatusBarConfig {
    mode: string;
    model?: string;
    context?: string;
    status?: 'ready' | 'working' | 'error';
}

export function showStatusBar(config: StatusBarConfig): void {
    const statusColor = config.status === 'ready' ? chalk.green :
                        config.status === 'working' ? chalk.yellow :
                        config.status === 'error' ? chalk.red :
                        chalk.gray;

    const statusSymbol = config.status === 'ready' ? '●' :
                         config.status === 'working' ? '○' :
                         config.status === 'error' ? '×' :
                         '○';

    const parts = [
        statusColor(statusSymbol),
        chalk.cyan(config.mode),
    ];

    if (config.model) {
        parts.push(chalk.gray(`(${config.model})`));
    }

    if (config.context) {
        parts.push(chalk.gray(`| ${config.context}`));
    }

    console.log(chalk.gray('─'.repeat(process.stdout.columns || 80)));
    console.log(parts.join(' '));
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// SPINNER HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function createSpinner(text: string): Ora {
    return ora({
        text,
        spinner: 'dots',
        color: 'cyan',
    }).start();
}

// ═══════════════════════════════════════════════════════════════════════════
// TABLE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

export function displayKeyValueTable(data: Record<string, string | number>): void {
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));

    for (const [key, value] of Object.entries(data)) {
        const paddedKey = key.padEnd(maxKeyLength);
        console.log(`  ${chalk.cyan(paddedKey)}  ${chalk.gray(String(value))}`);
    }
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// INFO BOXES
// ═══════════════════════════════════════════════════════════════════════════

export type BoxType = 'info' | 'success' | 'warning' | 'error';

export function showBox(title: string, content: string, type: BoxType = 'info'): void {
    const borderColor = type === 'info' ? 'blue' :
                        type === 'success' ? 'green' :
                        type === 'warning' ? 'yellow' :
                        'red';

    const titleColor = type === 'info' ? chalk.blue :
                       type === 'success' ? chalk.green :
                       type === 'warning' ? chalk.yellow :
                       chalk.red;

    const box = boxen(
        titleColor.bold(title) + '\n\n' + chalk.white(content),
        {
            padding: 1,
            borderStyle: 'round',
            borderColor: borderColor as any,
            titleAlignment: 'left',
        }
    );

    console.log(box);
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// CODE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

export function showCode(code: string, language?: string): void {
    const lang = language ? chalk.gray(`// ${language}\n`) : '';
    const boxed = boxen(
        lang + chalk.white(code),
        {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderStyle: 'single',
            borderColor: 'gray',
        }
    );
    console.log(boxed);
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

export function showList(items: string[], title?: string): void {
    if (title) {
        console.log(chalk.cyan.bold(`\n${title}\n`));
    }

    items.forEach((item, index) => {
        const prefix = chalk.gray(`${(index + 1).toString().padStart(2, ' ')}. `);
        console.log(prefix + chalk.white(item));
    });
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK LIST
// ═══════════════════════════════════════════════════════════════════════════

export interface Task {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export function showTasks(tasks: Task[], title?: string): void {
    if (title) {
        console.log(chalk.cyan.bold(`\n${title}\n`));
    }

    tasks.forEach(task => {
        const statusIcon = task.status === 'completed' ? chalk.green('✓') :
                           task.status === 'in_progress' ? chalk.yellow('○') :
                           task.status === 'failed' ? chalk.red('×') :
                           chalk.gray('○');

        const statusText = task.status === 'completed' ? chalk.green('done') :
                           task.status === 'in_progress' ? chalk.yellow('working') :
                           task.status === 'failed' ? chalk.red('failed') :
                           chalk.gray('pending');

        console.log(`${statusIcon} ${chalk.white(task.content)} ${chalk.dim(`[${statusText}]`)}`);
    });
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function formatPrompt(prefix: string, text: string): string {
    return `${chalk.cyan.bold(prefix)} ${chalk.white(text)}`;
}

export function formatResponse(text: string): string {
    return chalk.white(text);
}

// ═══════════════════════════════════════════════════════════════════════════
// MISC
// ═══════════════════════════════════════════════════════════════════════════

export function clearScreen(): void {
    console.clear();
}

export function separator(char = '─', length = process.stdout.columns || 80): void {
    console.log(chalk.gray(char.repeat(length)));
}

export function emptyLine(): void {
    console.log();
}

export default {
    showBanner,
    showWelcome,
    showStatusBar,
    createSpinner,
    displayKeyValueTable,
    showBox,
    showCode,
    showList,
    showTasks,
    formatPrompt,
    formatResponse,
    clearScreen,
    separator,
    emptyLine,
};
