/**
 * Meteoroid CLI - Shortcut Commands
 * Commands for navigating and interacting with shortcuts
 */

import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { colors } from '../utils/theme.js';
import { showShortcutMenu, showErrorList, createSpinner } from '../utils/ui.js';
import { shortcuts } from '../utils/shortcuts.js';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: goto
// Navigate to a file/section/error
// ═══════════════════════════════════════════════════════════════════════════

export async function gotoCommand(shortcut: string): Promise<boolean> {
    if (!shortcut) {
        console.log(colors.error('Usage: goto [shortcut]'));
        console.log(colors.muted('Example: goto Fa, goto Aa:jwt, goto E1'));
        return false;
    }

    const resolved = shortcuts.resolve(shortcut);
    if (!resolved) {
        console.log(colors.error(`Unknown shortcut: ${shortcut}`));
        console.log(colors.muted('Use /shortcuts to see available shortcuts'));
        return false;
    }

    console.log();
    console.log(colors.success(`Navigating to: ${shortcut}`));
    console.log(colors.muted(`Path: ${resolved.path}`));
    if (resolved.line) {
        console.log(colors.muted(`Line: ${resolved.line}`));
    }

    // Show related shortcuts
    const related = shortcuts.getRelated(shortcut);
    if (related.length > 0) {
        console.log(colors.muted(`Related: ${related.slice(0, 5).join(', ')}`));
    }
    console.log();

    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: open
// Open a file in VS Code
// ═══════════════════════════════════════════════════════════════════════════

export async function openCommand(shortcut: string): Promise<boolean> {
    if (!shortcut) {
        console.log(colors.error('Usage: open [shortcut]'));
        return false;
    }

    const resolved = shortcuts.resolve(shortcut);
    if (!resolved) {
        console.log(colors.error(`Unknown shortcut: ${shortcut}`));
        return false;
    }

    // Check if file exists
    if (!existsSync(resolved.path)) {
        console.log(colors.warning(`File not found: ${resolved.path}`));
        return false;
    }

    // Build VS Code command
    let cmd = `code "${resolved.path}"`;
    if (resolved.line) {
        cmd = `code -g "${resolved.path}:${resolved.line}"`;
    }

    try {
        await execAsync(cmd);
        console.log(colors.success(`Opened ${shortcut} in VS Code`));
        return true;
    } catch (err) {
        console.log(colors.error(`Failed to open in VS Code: ${err}`));
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: show
// Display file content in terminal
// ═══════════════════════════════════════════════════════════════════════════

export async function showCommand(shortcut: string, lines?: number): Promise<boolean> {
    if (!shortcut) {
        console.log(colors.error('Usage: show [shortcut] [lines]'));
        return false;
    }

    const resolved = shortcuts.resolve(shortcut);
    if (!resolved) {
        console.log(colors.error(`Unknown shortcut: ${shortcut}`));
        return false;
    }

    if (!existsSync(resolved.path)) {
        console.log(colors.warning(`File not found: ${resolved.path}`));
        return false;
    }

    try {
        let content = readFileSync(resolved.path, 'utf-8');
        const allLines = content.split('\n');

        // If line specified, show context around that line
        if (resolved.line) {
            const start = Math.max(0, resolved.line - 5);
            const end = Math.min(allLines.length, resolved.line + (lines || 10));
            const contextLines = allLines.slice(start, end);

            console.log();
            console.log(colors.primary.bold(`File: ${shortcut}`));
            console.log(colors.muted(`Path: ${resolved.path}`));
            console.log(colors.muted('─'.repeat(50)));

            contextLines.forEach((line, i) => {
                const lineNum = start + i + 1;
                const isTarget = lineNum === resolved.line;
                const prefix = isTarget ? colors.accent('→ ') : '  ';
                const lineNumStr = colors.muted(lineNum.toString().padStart(4, ' ') + ' │ ');
                console.log(prefix + lineNumStr + (isTarget ? colors.white(line) : colors.muted(line)));
            });
        } else {
            // Show first N lines
            const maxLines = lines || 30;
            const displayLines = allLines.slice(0, maxLines);

            console.log();
            console.log(colors.primary.bold(`File: ${shortcut}`));
            console.log(colors.muted(`Path: ${resolved.path}`));
            console.log(colors.muted('─'.repeat(50)));

            displayLines.forEach((line, i) => {
                const lineNum = colors.muted((i + 1).toString().padStart(4, ' ') + ' │ ');
                console.log(lineNum + line);
            });

            if (allLines.length > maxLines) {
                console.log(colors.muted(`... ${allLines.length - maxLines} more lines`));
            }
        }

        console.log(colors.muted('─'.repeat(50)));
        console.log();
        return true;
    } catch (err) {
        console.log(colors.error(`Failed to read file: ${err}`));
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: errors
// List all error shortcuts
// ═══════════════════════════════════════════════════════════════════════════

export async function errorsCommand(): Promise<boolean> {
    const errors = shortcuts.getErrors();

    if (errors.size === 0) {
        console.log();
        console.log(colors.success('No active errors'));
        console.log();
        return true;
    }

    const errorList = Array.from(errors.values()).map(e => ({
        key: e.key,
        location: `${e.fileKey}:${e.line}`,
        message: e.message,
        type: e.type,
    }));

    showErrorList(errorList);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: shortcuts / ?
// Show shortcut reference menu
// ═══════════════════════════════════════════════════════════════════════════

export async function shortcutsCommand(): Promise<boolean> {
    const categories = shortcuts.getByCategory();
    const errors = shortcuts.getErrors();

    const shortcutConfig: Record<string, Array<{ key: string; description: string; path?: string }>> = {};
    for (const [cat, entries] of Object.entries(categories)) {
        shortcutConfig[cat] = entries;
    }

    const errorList = Array.from(errors.values()).map(e => ({
        key: e.key,
        location: `${e.fileKey}:${e.line}`,
        message: e.message,
    }));

    showShortcutMenu({
        shortcuts: shortcutConfig,
        errors: errorList.length > 0 ? errorList : undefined,
    });

    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: related
// Show related shortcuts
// ═══════════════════════════════════════════════════════════════════════════

export async function relatedCommand(shortcut: string): Promise<boolean> {
    if (!shortcut) {
        console.log(colors.error('Usage: related [shortcut]'));
        return false;
    }

    const related = shortcuts.getRelated(shortcut);

    console.log();
    console.log(colors.primary.bold(`Related to ${shortcut}:`));
    console.log(colors.muted('─'.repeat(40)));

    if (related.length === 0) {
        console.log(colors.muted('No related shortcuts found'));
    } else {
        for (const key of related) {
            const resolved = shortcuts.resolve(key);
            console.log(`  ${colors.cyan(key.padEnd(10))} ${colors.muted('→')} ${resolved?.path || 'unknown'}`);
        }
    }
    console.log();

    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: bookmark
// Create a bookmark
// ═══════════════════════════════════════════════════════════════════════════

export async function bookmarkCommand(shortcut: string, name?: string): Promise<boolean> {
    if (!shortcut) {
        // List bookmarks
        const bookmarks = shortcuts.getBookmarks();
        console.log();
        console.log(colors.primary.bold('Bookmarks'));
        console.log(colors.muted('─'.repeat(40)));

        if (bookmarks.size === 0) {
            console.log(colors.muted('No bookmarks yet'));
            console.log(colors.muted('Use: bookmark [shortcut] [name]'));
        } else {
            for (const [key, bm] of bookmarks) {
                console.log(`  ${colors.cyan(key.padEnd(15))} → ${bm.target}`);
            }
        }
        console.log();
        return true;
    }

    if (!name) {
        console.log(colors.error('Usage: bookmark [shortcut] [name]'));
        return false;
    }

    // Verify the target shortcut exists
    const resolved = shortcuts.resolve(shortcut);
    if (!resolved) {
        console.log(colors.error(`Unknown shortcut: ${shortcut}`));
        return false;
    }

    shortcuts.registerBookmark(name, shortcut);
    console.log(colors.success(`Bookmark created: ${name} → ${shortcut}`));

    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: recent
// Show recently accessed shortcuts
// ═══════════════════════════════════════════════════════════════════════════

export async function recentCommand(): Promise<boolean> {
    const recent = shortcuts.getRecent(10);

    console.log();
    console.log(colors.primary.bold('Recently Accessed'));
    console.log(colors.muted('─'.repeat(40)));

    if (recent.length === 0) {
        console.log(colors.muted('No recent shortcuts'));
    } else {
        for (const file of recent) {
            const timeAgo = file.lastAccessed
                ? formatTimeAgo(file.lastAccessed)
                : 'never';
            console.log(`  ${colors.cyan(file.key.padEnd(6))} ${file.description.padEnd(30)} ${colors.muted(timeAgo)}`);
        }
    }
    console.log();

    return true;
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTE SHORTCUT COMMAND
// ═══════════════════════════════════════════════════════════════════════════

export async function executeShortcutCommand(input: string): Promise<boolean> {
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
        case 'goto':
            return gotoCommand(args[0]);

        case 'open':
            return openCommand(args[0]);

        case 'show':
            return showCommand(args[0], args[1] ? parseInt(args[1], 10) : undefined);

        case 'errors':
            return errorsCommand();

        case 'shortcuts':
        case '?':
            return shortcutsCommand();

        case 'related':
            return relatedCommand(args[0]);

        case 'bookmark':
            return bookmarkCommand(args[0], args[1]);

        case 'recent':
            return recentCommand();

        default:
            return false;
    }
}

export default {
    gotoCommand,
    openCommand,
    showCommand,
    errorsCommand,
    shortcutsCommand,
    relatedCommand,
    bookmarkCommand,
    recentCommand,
    executeShortcutCommand,
};
