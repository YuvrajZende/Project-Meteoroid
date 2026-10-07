#!/usr/bin/env node
/**
 * Launch the API (http://localhost:3000) and the web app (http://localhost:3001) together.
 * Output is prefixed per service; Ctrl+C or either process exiting stops both.
 *
 *   npm start            # both
 *   npm start -- --open  # both, then open the web app in the browser
 */

import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const WEB_URL = 'http://localhost:3001';
const API_HEALTH = 'http://localhost:3000/health';

const services = [
    { name: 'api', color: '\x1b[36m', args: ['run', 'dev', '-w', '@meteoroid/api'] },
    { name: 'web', color: '\x1b[35m', args: ['run', 'dev', '-w', '@meteoroid/web'] },
];

const reset = '\x1b[0m';
const children = [];
let shuttingDown = false;

function prefixLines(name, color, stream, target) {
    let buffer = '';
    stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) target.write(`${color}[${name}]${reset} ${line}\n`);
    });
    stream.on('end', () => buffer && target.write(`${color}[${name}]${reset} ${buffer}\n`));
}

function stopAll(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
        if (child.exitCode !== null) continue;
        if (isWindows) {
            // npm spawns a process tree on Windows; kill the whole tree.
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            child.kill('SIGINT');
        }
    }
    setTimeout(() => process.exit(code), 500);
}

for (const { name, color, args } of services) {
    const child = spawn(npm, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWindows, // .cmd shims need a shell on Windows
        env: { ...process.env, FORCE_COLOR: '1' },
    });
    prefixLines(name, color, child.stdout, process.stdout);
    prefixLines(name, color, child.stderr, process.stderr);
    child.on('exit', (code) => {
        if (shuttingDown) return;
        console.log(`${color}[${name}]${reset} exited with code ${code}; stopping everything.`);
        stopAll(code ?? 1);
    });
    children.push(child);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

// Announce (and optionally open) once both servers answer.
const open = process.argv.includes('--open');
const deadline = Date.now() + 180_000;
async function waitUntilReady() {
    while (!shuttingDown && Date.now() < deadline) {
        const ok = await Promise.all([
            fetch(API_HEALTH, { headers: { 'User-Agent': 'Mozilla/5.0 meteoroid-dev', 'Accept-Language': 'en' } }).then(r => r.ok, () => false),
            fetch(WEB_URL).then(r => r.ok, () => false),
        ]);
        if (ok.every(Boolean)) {
            console.log(`\n\x1b[1m  Meteoroid is ready → ${WEB_URL}\x1b[0m  (API: http://localhost:3000, docs: http://localhost:3000/docs)\n`);
            if (open) {
                const opener = isWindows ? ['cmd', ['/c', 'start', '', WEB_URL]] : process.platform === 'darwin' ? ['open', [WEB_URL]] : ['xdg-open', [WEB_URL]];
                spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
            }
            return;
        }
        await new Promise((r) => setTimeout(r, 1500));
    }
}
void waitUntilReady();
