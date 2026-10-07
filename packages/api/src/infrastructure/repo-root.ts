/**
 * Repository root resolution, independent of process.cwd().
 * Works when started from the repo root, packages/api, or dist/.
 */

import fs from 'fs';
import path from 'path';

function findRepoRoot(startDir: string): string | null {
    let dir = startDir;
    for (;;) {
        const pkgPath = path.join(dir, 'package.json');
        try {
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { workspaces?: unknown };
                if (pkg.workspaces) return dir;
            }
        } catch {
            // Unreadable package.json - keep walking up
        }
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

// This package compiles to CommonJS, so __dirname is the module's directory (src/ or dist/).
export const REPO_ROOT = findRepoRoot(__dirname) ?? path.resolve(process.cwd(), '..', '..');
export const API_ROOT = path.join(REPO_ROOT, 'packages', 'api');
