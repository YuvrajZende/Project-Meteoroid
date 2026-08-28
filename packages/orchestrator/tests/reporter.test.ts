import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { renderReport, writeReportJson } from '../src/pipeline/reporter';
import { TEST_DEPS } from './helpers/test-deps';
import type { RunResult } from '../src/pipeline/types';

const fakeRun = (): RunResult => ({
    results: [
        { agentId: 'analysis-agent', status: 'success', attempts: 1, durationMs: 5, filesProduced: 0 },
        { agentId: 'database-agent', status: 'degraded', attempts: 2, durationMs: 10, filesProduced: 3 },
        { agentId: 'api-agent', status: 'failed', attempts: 2, durationMs: 8, filesProduced: 0, error: { agentId: 'api-agent', code: 'AGENT_FAILED', message: 'boom', attempts: 2 } },
        { agentId: 'auth-agent', status: 'skipped', attempts: 0, durationMs: 0, filesProduced: 0, error: { agentId: 'auth-agent', code: 'SKIPPED', message: 'upstream api-agent failed', attempts: 0 } },
        { agentId: 'monitoring-agent', status: 'success', attempts: 1, durationMs: 0, filesProduced: 0 },
    ],
    errors: [],
    exitCode: 1,
    totalDurationMs: 23,
});

describe('reporter', () => {
    it('renders all four states with glyphs and stub labels', () => {
        const text = renderReport(fakeRun(), TEST_DEPS);
        expect(text).toContain('✅');
        expect(text).toContain('⚠️');
        expect(text).toContain('❌');
        expect(text).toContain('⏭️');
        expect(text).toContain('stub');          // TEST_DEPS marks monitoring etc.
        expect(text).toContain('AGENT_FAILED');
    });

    it('writes parseable run-report.json', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'meteoroid-report-'));
        const p = await writeReportJson(fakeRun(), dir);
        const parsed = JSON.parse(await fs.readFile(p, 'utf8'));
        expect(parsed.exitCode).toBe(1);
        expect(parsed.results).toHaveLength(5);
    });
});
