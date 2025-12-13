/**
 * Server Logger - Clean, Professional Console Output
 * Centralized logging utility for consistent, readable server output
 */

// ANSI color codes for terminal styling
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
};

// Unicode box-drawing characters
const box = {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    line: '─',
};

// Status indicators (minimal emojis - only for important status)
const status = {
    ok: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warn: `${colors.yellow}!${colors.reset}`,
    info: `${colors.blue}›${colors.reset}`,
    loading: `${colors.cyan}○${colors.reset}`,
};

/**
 * Logger class for clean console output
 */
class ServerLogger {
    private silent: boolean = false;
    private startTime: number = Date.now();

    /** Print a horizontal divider line */
    divider(char: string = '─', length: number = 60): void {
        if (this.silent) return;
        console.log(`${colors.dim}${char.repeat(length)}${colors.reset}`);
    }

    /** Print a section header */
    section(title: string): void {
        if (this.silent) return;
        console.log('');
        console.log(`${colors.bold}${colors.cyan}${title}${colors.reset}`);
        this.divider('─', title.length + 4);
    }

    /** Print the main server banner */
    banner(version: string = '1.0.0'): void {
        if (this.silent) return;
        console.log('');
        console.log(`${colors.bold}${colors.cyan}╭${'─'.repeat(50)}╮${colors.reset}`);
        console.log(`${colors.bold}${colors.cyan}│${colors.reset}  LOVEABLE BACKEND                               ${colors.cyan}│${colors.reset}`);
        console.log(`${colors.cyan}│${colors.reset}  ${colors.dim}AI-Powered Code Generation Server${colors.reset}              ${colors.cyan}│${colors.reset}`);
        console.log(`${colors.cyan}│${colors.reset}  ${colors.dim}Version ${version}${colors.reset}                                   ${colors.cyan}│${colors.reset}`);
        console.log(`${colors.bold}${colors.cyan}╰${'─'.repeat(50)}╯${colors.reset}`);
        console.log('');
    }

    /** Print a status line with indicator */
    status(label: string, value: string, isOk: boolean = true): void {
        if (this.silent) return;
        const indicator = isOk ? status.ok : status.error;
        const valueColor = isOk ? colors.green : colors.red;
        console.log(`  ${indicator} ${colors.dim}${label.padEnd(20)}${colors.reset} ${valueColor}${value}${colors.reset}`);
    }

    /** Print a key-value pair */
    info(label: string, value: string): void {
        if (this.silent) return;
        console.log(`  ${status.info} ${colors.dim}${label.padEnd(20)}${colors.reset} ${value}`);
    }

    /** Print a warning */
    warn(message: string): void {
        if (this.silent) return;
        console.log(`  ${status.warn} ${colors.yellow}${message}${colors.reset}`);
    }

    /** Print an error */
    error(message: string): void {
        if (this.silent) return;
        console.log(`  ${status.error} ${colors.red}${message}${colors.reset}`);
    }

    /** Print a success message */
    success(message: string): void {
        if (this.silent) return;
        console.log(`  ${status.ok} ${colors.green}${message}${colors.reset}`);
    }

    /** Print a loading/in-progress message */
    loading(label: string): void {
        if (this.silent) return;
        console.log(`  ${status.loading} ${colors.dim}${label}...${colors.reset}`);
    }

    /** Print a simple line */
    log(message: string): void {
        if (this.silent) return;
        console.log(`  ${message}`);
    }

    /** Print an empty line */
    newline(): void {
        if (this.silent) return;
        console.log('');
    }

    /** Print a list of items */
    list(items: Array<{ label: string; value: string; ok?: boolean }>): void {
        if (this.silent) return;
        items.forEach(item => {
            if (item.ok !== undefined) {
                this.status(item.label, item.value, item.ok);
            } else {
                this.info(item.label, item.value);
            }
        });
    }

    /** Print the final ready message */
    ready(address: string, docsUrl: string): void {
        if (this.silent) return;
        const elapsed = Date.now() - this.startTime;

        console.log('');
        console.log(`${colors.bold}${colors.green}╭${'─'.repeat(50)}╮${colors.reset}`);
        console.log(`${colors.green}│${colors.reset}  ${colors.bold}SERVER READY${colors.reset}                                   ${colors.green}│${colors.reset}`);
        console.log(`${colors.green}│${colors.reset}                                                   ${colors.green}│${colors.reset}`);
        console.log(`${colors.green}│${colors.reset}  ${colors.dim}Local:${colors.reset}    ${colors.cyan}${address}${colors.reset}                    ${colors.green}│${colors.reset}`);
        console.log(`${colors.green}│${colors.reset}  ${colors.dim}Docs:${colors.reset}     ${colors.cyan}${docsUrl}${colors.reset}               ${colors.green}│${colors.reset}`);
        console.log(`${colors.green}│${colors.reset}                                                   ${colors.green}│${colors.reset}`);
        console.log(`${colors.green}│${colors.reset}  ${colors.dim}Started in ${elapsed}ms${colors.reset}                              ${colors.green}│${colors.reset}`);
        console.log(`${colors.bold}${colors.green}╰${'─'.repeat(50)}╯${colors.reset}`);
        console.log('');
    }

    /** Print a compact table */
    table(title: string, rows: Array<{ key: string; value: string; status?: boolean }>): void {
        if (this.silent) return;

        console.log(`  ${colors.bold}${title}${colors.reset}`);
        rows.forEach(row => {
            const statusIcon = row.status === undefined ? '  ' : row.status ? status.ok : status.error;
            console.log(`    ${statusIcon} ${colors.dim}${row.key.padEnd(16)}${colors.reset} ${row.value}`);
        });
    }

    /** Set silent mode */
    setSilent(silent: boolean): void {
        this.silent = silent;
    }

    /** Reset start timer */
    resetTimer(): void {
        this.startTime = Date.now();
    }
}

// Singleton instance
export const logger = new ServerLogger();

// Export types and utilities
export { colors, status, box };
