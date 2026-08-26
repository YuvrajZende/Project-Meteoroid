import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GeneratedFile } from '@loveable/shared';

export interface WriteSummary {
    written: number;
    rootDir: string;
}

export async function writeFiles(files: Map<string, GeneratedFile>, outRoot: string): Promise<WriteSummary> {
    const existing = await fs.readdir(outRoot).catch(err => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    });
    if (existing !== null && existing.length > 0) {
        throw new Error(`refusing to overwrite existing output directory: ${outRoot}`);
    }

    for (const file of files.values()) {
        const target = path.join(outRoot, file.path);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, file.content, 'utf8');
    }
    return { written: files.size, rootDir: outRoot };
}
