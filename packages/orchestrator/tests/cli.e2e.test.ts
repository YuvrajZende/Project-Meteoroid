import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runPipeline } from '../src/cli';

function tmpOut(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), 'meteoroid-e2e-'));
}

describe('runPipeline end-to-end (demo mode)', () => {
    it('runs all 13 agents green and materializes the backend', async () => {
        const out = await tmpOut();
        const outcome = await runPipeline({
            mode: 'demo',
            outDir: path.join(out, 'backend'),
            requestName: 'mini-commerce',
        });
        expect(outcome.exitCode).toBe(0);
        expect(outcome.results.filter(r => r.status === 'success')).toHaveLength(13);

        const prisma = await fs.readFile(path.join(out, 'backend/prisma/schema.prisma'), 'utf8');
        expect(prisma).toContain('model Product');
        expect(prisma).toContain('model Order');
        expect(await fs.stat(path.join(out, 'backend/package.json'))).toBeTruthy();
        expect(await fs.stat(path.join(out, 'backend/.github/workflows/ci.yml'))).toBeTruthy();

        const report = JSON.parse(await fs.readFile(outcome.reportPath, 'utf8'));
        expect(report.results).toHaveLength(13);
    }, 120_000);

    it('fails fatally (exit 2 semantics via throw) on missing analysis file', async () => {
        const out = await tmpOut();
        await expect(runPipeline({
            mode: 'analysis',
            analysisPath: path.join(out, 'nope.json'),
            outDir: path.join(out, 'b'),
            requestName: 'x',
        })).rejects.toThrow(/ENOENT/);
    }, 30_000);
});
