import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeFiles } from '../src/pipeline/writer';
import type { GeneratedFile } from '@loveable/shared';

function tmpRoot(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), 'meteoroid-writer-'));
}

const fileOf = (p: string): GeneratedFile => ({ path: p, content: `content-of-${p}`, type: 'code' });

describe('writeFiles', () => {
    it('writes nested trees and creates directories', async () => {
        const root = await tmpRoot();
        const files = new Map([
            ['package.json', fileOf('package.json')],
            ['prisma/schema.prisma', fileOf('prisma/schema.prisma')],
            ['src/routes/users.ts', fileOf('src/routes/users.ts')],
        ]);
        const summary = await writeFiles(files, path.join(root, 'backend'));
        expect(summary.written).toBe(3);
        expect(await fs.readFile(path.join(root, 'backend/prisma/schema.prisma'), 'utf8')).toBe('content-of-prisma/schema.prisma');
        expect(await fs.readFile(path.join(root, 'backend/src/routes/users.ts'), 'utf8')).toBe('content-of-src/routes/users.ts');
    });

    it('refuses to overwrite a non-empty output directory', async () => {
        const root = await tmpRoot();
        await fs.writeFile(path.join(root, 'existing.txt'), 'keep me');
        await expect(writeFiles(new Map([['a.txt', fileOf('a.txt')]]), root))
            .rejects.toThrow(/refusing to overwrite/i);
    });
});
