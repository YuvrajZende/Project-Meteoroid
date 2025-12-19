/**
 * Loveable CLI Theme - Clean Professional Styling
 * No emojis, clean text-based interface
 */

import chalk from 'chalk';

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════════════

export const colors = {
    // Primary Colors
    primary: chalk.hex('#8B5CF6'),      // Purple
    secondary: chalk.hex('#06B6D4'),    // Cyan
    accent: chalk.hex('#F59E0B'),       // Amber

    // Status Colors
    success: chalk.hex('#10B981'),      // Green
    error: chalk.hex('#EF4444'),        // Red
    warning: chalk.hex('#F59E0B'),      // Amber
    info: chalk.hex('#3B82F6'),         // Blue

    // Neutral Colors
    text: chalk.white,
    muted: chalk.gray,
    dim: chalk.dim,
    bold: chalk.bold,
    header: chalk.bold.hex('#8B5CF6'),
};

// ═══════════════════════════════════════════════════════════════════════════
// SYMBOLS - Clean text-based, no emojis
// ═══════════════════════════════════════════════════════════════════════════

export const symbols = {
    success: '[OK]',
    error: '[ERR]',
    warning: '[!]',
    info: '[i]',
    pending: '[...]',
    arrow: '->',
    bullet: '*',
    line: '-',
    doubleLine: '=',
    check: '[+]',
    cross: '[-]',
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
}

export function divider(width = 70, char = '-'): string {
    return colors.dim(char.repeat(width));
}

export function header(title: string): void {
    console.log();
    console.log(colors.header(`=== ${title.toUpperCase()} ===`));
    console.log();
}

export function subheader(title: string): void {
    console.log(colors.primary(`--- ${title} ---`));
}

export function success(msg: string): void {
    console.log(`${colors.success(symbols.success)} ${msg}`);
}

export function error(msg: string): void {
    console.log(`${colors.error(symbols.error)} ${msg}`);
}

export function warning(msg: string): void {
    console.log(`${colors.warning(symbols.warning)} ${msg}`);
}

export function info(msg: string): void {
    console.log(`${colors.info(symbols.info)} ${msg}`);
}

export function line(label: string, value: string, ok?: boolean): void {
    const status = ok === undefined ? '' : ok ? colors.success(symbols.success) : colors.error(symbols.cross);
    console.log(`  ${colors.muted(label + ':')} ${value} ${status}`);
}

export function bullet(msg: string): void {
    console.log(`  ${symbols.bullet} ${msg}`);
}

export default {
    colors,
    symbols,
    formatDuration,
    divider,
    header,
    subheader,
    success,
    error,
    warning,
    info,
    line,
    bullet,
};
