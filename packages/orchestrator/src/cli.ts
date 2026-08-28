import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { buildDefaultRegistry } from './pipeline/registry';
import { planLevels } from './pipeline/planner';
import { DEPENDENCIES } from './pipeline/dependencies';
import { createContext } from './pipeline/context';
import { executePlan } from './pipeline/executor';
import { writeFiles } from './pipeline/writer';
import { renderReport, writeReportJson } from './pipeline/reporter';
import { makeDemoAnalysis } from './pipeline/demo-analysis';
import type { RunResult } from './pipeline/types';

export interface RunOptions {
    mode: 'demo' | 'analysis';
    analysisPath?: string;
    outDir: string;
    requestName: string;
}

export interface RunOutcome extends RunResult {
    written: number;
    reportPath: string;
}

export async function runPipeline(opts: RunOptions): Promise<RunOutcome> {
    let analysisJson: unknown;
    if (opts.mode === 'demo') {
        analysisJson = makeDemoAnalysis();
    } else {
        if (!opts.analysisPath) throw new Error('--analysis requires a file path');
        analysisJson = JSON.parse(await fs.readFile(opts.analysisPath, 'utf8'));
    }

    const registry = buildDefaultRegistry();
    const health = await registry.initializeAll();
    const levels = planLevels(DEPENDENCIES);
    const ctx = createContext(opts.requestName);
    ctx.analysisJson = analysisJson;

    const run = await executePlan(levels, registry, ctx, { deps: DEPENDENCIES, health });
    await fs.mkdir(opts.outDir, { recursive: true });
    const summary = await writeFiles(ctx.files, opts.outDir);
    const reportPath = await writeReportJson(run, opts.outDir);
    return { ...run, written: summary.written, reportPath };
}

function parseArgv(argv: string[]): RunOptions & { help?: boolean } {
    const opts = {
        mode: 'demo' as 'demo' | 'analysis',
        outDir: 'generated-backend/demo',
        requestName: 'demo-backend',
        help: false,
        analysisPath: undefined as string | undefined,
    };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--demo') opts.mode = 'demo';
        else if (arg === '--analysis') {
            opts.mode = 'analysis';
            opts.analysisPath = argv[++i];
        } else if (arg === '--out') opts.outDir = argv[++i];
        else if (arg === '--name') opts.requestName = argv[++i];
        else if (arg === '--help' || arg === '-h') opts.help = true;
    }
    return opts;
}

export async function main(): Promise<void> {
    const argv = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['--demo'];
    const opts = parseArgv(['node', 'cli', ...argv]);
    if (opts.help) {
        console.log('Usage: npm run agents -- [--demo | --analysis <file>] [--out <dir>] [--name <str>]');
        return;
    }
    try {
        const outcome = await runPipeline(opts);
        console.log(renderReport(outcome, DEPENDENCIES));
        console.log(`\nOutput: ${opts.outDir} (${outcome.written} files)`);
        console.log(`Report: ${outcome.reportPath}`);
        process.exitCode = outcome.exitCode;
    } catch (err) {
        console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 2;
    }
}

if (require.main === module) {
    void main();
}
