/**
 * Meteoroid CLI - UI Utilities
 * Provides enhanced UI components similar to Claude Code
 */

import chalk from 'chalk';
import boxen from 'boxen';
import ora, { Ora } from 'ora';
import { symbols, colors, ASCII_LOGO, ASCII_LOGO_SMALL, box } from './theme.js';

// ═══════════════════════════════════════════════════════════════════════════
// BANNER & HEADER
// ═══════════════════════════════════════════════════════════════════════════

export interface WelcomeConfig {
    version: string;
    model?: string;
    workingDir?: string;
    serverUrl?: string;
    showTips?: boolean;
}

export function showBanner(): void {
    console.clear();

    // Use small logo for narrow terminals, large for wide
    const termWidth = process.stdout.columns || 80;
    const logo = termWidth >= 60 ? ASCII_LOGO : ASCII_LOGO_SMALL;

    // Center and colorize the logo
    console.log(colors.primary(logo));
}

export function showWelcome(versionOrConfig: string | WelcomeConfig): void {
    const config: WelcomeConfig = typeof versionOrConfig === 'string'
        ? { version: versionOrConfig }
        : versionOrConfig;

    console.clear();

    // Show ASCII logo
    const termWidth = process.stdout.columns || 80;
    const logo = termWidth >= 60 ? ASCII_LOGO : ASCII_LOGO_SMALL;
    console.log(colors.primary(logo));

    // Subtitle line
    console.log(colors.muted('                 AI-Powered Backend Development Platform'));
    console.log();

    // Info section with box-style layout
    const infoBox = boxen(
        [
            `${colors.muted('Version:')}    ${colors.secondary(config.version)}`,
            config.model ? `${colors.muted('Model:')}      ${colors.secondary(config.model)}` : null,
            config.workingDir ? `${colors.muted('Directory:')}  ${colors.secondary(config.workingDir)}` : null,
        ].filter(Boolean).join('\n'),
        {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderStyle: 'round',
            borderColor: 'gray',
            dimBorder: true,
        }
    );
    console.log(infoBox);

    // Tips section
    if (config.showTips !== false) {
        console.log();
        console.log(colors.accent('Tips for getting started'));
        console.log(colors.muted('─'.repeat(Math.min(50, termWidth - 4))));
        console.log(colors.muted('  Run ') + colors.cyan('/help') + colors.muted(' to see available commands'));
        console.log(colors.muted('  Type ') + colors.cyan('exit') + colors.muted(' or press ') + colors.cyan('Ctrl+C') + colors.muted(' to quit'));
    }

    console.log();

    // Keyboard shortcuts hint (bottom bar style)
    const shortcuts = [
        `${colors.cyan('tab')} switch mode`,
        `${colors.cyan('ctrl+c')} quit`,
    ].join('  ·  ');
    console.log(colors.dim(shortcuts));
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

// ═══════════════════════════════════════════════════════════════════════════
// SHORTCUT MENU DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

export interface ShortcutEntry {
    key: string;
    description: string;
    path?: string;
}

export interface ShortcutMenuConfig {
    title?: string;
    shortcuts: Record<string, ShortcutEntry[]>;
    errors?: Array<{ key: string; location: string; message: string }>;
}

export function showShortcutMenu(config: ShortcutMenuConfig): void {
    const lines: string[] = [];

    // Shortcut categories
    for (const [category, entries] of Object.entries(config.shortcuts)) {
        lines.push(colors.accent(category.toUpperCase()));
        lines.push(colors.dim('─'.repeat(category.length)));

        for (const entry of entries) {
            lines.push(`  ${colors.cyan(entry.key.padEnd(8))} ${colors.muted('→')} ${entry.description}`);
        }
        lines.push('');
    }

    // Errors section (if any)
    if (config.errors && config.errors.length > 0) {
        lines.push(colors.error(`ERRORS (Active: ${config.errors.length})`));
        lines.push(colors.dim('──────'));

        for (const error of config.errors.slice(0, 5)) {
            lines.push(`  ${colors.error(error.key.padEnd(8))} ${colors.muted('→')} ${error.message}`);
        }
        lines.push('');
    }
    // Create the boxed display
    const content = lines.join('\n');
    const title = config.title || 'METEOROID - HELP';

    console.log();
    console.log(boxen(content, {
        title: colors.secondary(title) as unknown as string,
        titleAlignment: 'center',
        padding: 1,
        borderStyle: 'double',
        borderColor: 'magenta',
    }));
    console.log(colors.dim("Press 'q' to close"));
    console.log();
}

export function showErrorList(errors: Array<{ key: string; location: string; message: string; type?: string }>): void {
    console.log();
    console.log(chalk.bold(colors.error(`Active Errors (${errors.length})`)));
    console.log(colors.dim('─'.repeat(40)));

    for (const error of errors) {
        const typeColor = error.type === 'type' ? colors.error :
            error.type === 'validation' ? colors.warning :
                colors.error;
        console.log(`  ${typeColor(error.key.padEnd(10))} ${error.message}`);
        console.log(`  ${colors.dim(' '.repeat(10))} ${colors.muted('at')} ${colors.secondary(error.location)}`);
    }
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
    showShortcutMenu,
    showErrorList,
};
