import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentAttemptResult, DependencyMap, RunResult } from './types';

const GLYPH: Record<AgentAttemptResult['status'], string> = {
    success: '✅',
    degraded: '⚠️',
    failed: '❌',
    skipped: '⏭️',
};

export function renderReport(run: RunResult, deps: DependencyMap): string {
    const lines: string[] = [];
    lines.push('═'.repeat(72));
    lines.push(`📊 METEOROID RUN REPORT — exit ${run.exitCode} — ${run.totalDurationMs}ms`);
    lines.push('═'.repeat(72));
    lines.push('AGENT'.padEnd(22) + 'STATUS'.padEnd(10) + 'ATT'.padEnd(5) + 'FILES'.padEnd(7) + 'MS'.padEnd(7) + 'NOTE');
    lines.push('-'.repeat(72));

    for (const r of run.results) {
        const noteParts: string[] = [];
        if (deps[r.agentId]?.stub) noteParts.push('stub');
        if (r.error) noteParts.push(`${r.error.code}: ${r.error.message}`.substring(0, 40));
        lines.push(
            r.agentId.padEnd(22)
            + GLYPH[r.status].padEnd(10)
            + String(r.attempts).padEnd(5)
            + String(r.filesProduced).padEnd(7)
            + String(r.durationMs).padEnd(7)
            + noteParts.join(' | ')
        );
    }
    lines.push('═'.repeat(72));
    return lines.join('\n');
}

export async function writeReportJson(run: RunResult, outDir: string): Promise<string> {
    const filePath = path.join(outDir, 'run-report.json');
    const payload = {
        exitCode: run.exitCode,
        totalDurationMs: run.totalDurationMs,
        errors: run.errors,
        results: run.results,
    };
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
}
