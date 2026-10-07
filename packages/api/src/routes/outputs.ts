/**
 * Output Routes
 * Read access to generated projects on disk (output/<projectId>/).
 *
 * Ownership: projects record their creator in `.meteoroid.json`. A project owned by a user is
 * only visible to that user. Anonymous or unlabelled projects are only reachable when
 * AUTH_REQUIRED is off (local/dev usage); otherwise access fails closed.
 */

import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/index.js';
import { authenticate } from '../middleware/auth-middleware.js';
import { getFileWriter, isValidProjectId, resolveInside } from '../infrastructure/file-writer.js';

export const OUTPUT_META_FILE = '.meteoroid.json';
/** Metadata file name used before the Meteoroid rename */
const LEGACY_META_FILE = '.loveable.json';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'target']);
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 2000;

export interface OutputMeta {
    projectId: string;
    taskId?: string;
    userId: string;
    prompt?: string;
    language?: string;
    framework?: string;
    createdAt: string;
}

interface OutputFile {
    path: string;
    size: number;
}

type ProjectParams = { Params: { projectId: string } };

/**
 * Persist ownership/metadata next to a generated project.
 */
export async function writeOutputMeta(meta: OutputMeta): Promise<void> {
    const projectPath = getFileWriter().getProjectPath(meta.projectId);
    await fs.mkdir(projectPath, { recursive: true });
    await fs.writeFile(path.join(projectPath, OUTPUT_META_FILE), JSON.stringify(meta, null, 2), 'utf-8');
}

export async function readOutputMeta(projectPath: string): Promise<Partial<OutputMeta>> {
    for (const name of [OUTPUT_META_FILE, LEGACY_META_FILE]) {
        try {
            return JSON.parse(await fs.readFile(path.join(projectPath, name), 'utf-8'));
        } catch {
            // Try the next candidate
        }
    }
    return {};
}

export function canAccess(meta: Partial<OutputMeta>, userId: string | undefined): boolean {
    if (meta.userId && meta.userId !== 'anonymous') return meta.userId === userId;
    return !env.AUTH_REQUIRED;
}

async function walk(root: string): Promise<OutputFile[]> {
    const files: OutputFile[] = [];

    async function visit(dir: string, rel: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        await Promise.all(entries.map(async (entry) => {
            if (files.length >= MAX_FILES) return;
            const relPath = rel ? `${rel}/${entry.name}` : entry.name;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name)) await visit(fullPath, relPath);
            } else if (entry.isFile() && relPath !== OUTPUT_META_FILE && relPath !== LEGACY_META_FILE) {
                const stat = await fs.stat(fullPath);
                files.push({ path: relPath, size: stat.size });
            }
        }));
    }

    await visit(root, '');
    return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Resolve a project directory the caller is allowed to see, or send the error response.
 */
async function resolveProject(
    request: FastifyRequest<ProjectParams>,
    reply: FastifyReply,
): Promise<{ projectPath: string; meta: Partial<OutputMeta> } | null> {
    const { projectId } = request.params;
    if (!isValidProjectId(projectId)) {
        await reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid project ID' });
        return null;
    }

    const projectPath = getFileWriter().getProjectPath(projectId);
    const stat = await fs.stat(projectPath).catch(() => null);
    const meta = stat?.isDirectory() ? await readOutputMeta(projectPath) : {};

    // Respond 404 for both missing and foreign projects so IDs can't be probed.
    if (!stat?.isDirectory() || !canAccess(meta, request.authUser?.id)) {
        await reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Project ${projectId} not found` });
        return null;
    }

    return { projectPath, meta };
}

export async function registerOutputRoutes(app: FastifyInstance): Promise<void> {
    const optionalAuth = authenticate({ required: env.AUTH_REQUIRED });

    app.get('/api/v1/outputs', {
        preHandler: optionalAuth,
        schema: { tags: ['Outputs'], summary: 'List generated projects' },
    }, async (request) => {
        const outputDir = getFileWriter().getOutputDir();
        const entries = await fs.readdir(outputDir, { withFileTypes: true }).catch(() => []);

        const projects = await Promise.all(entries
            .filter(entry => entry.isDirectory() && isValidProjectId(entry.name))
            .map(async (entry) => {
                const projectPath = path.join(outputDir, entry.name);
                const [meta, stat] = await Promise.all([readOutputMeta(projectPath), fs.stat(projectPath)]);
                if (!canAccess(meta, request.authUser?.id)) return null;
                return {
                    projectId: entry.name,
                    prompt: meta.prompt ?? null,
                    language: meta.language ?? null,
                    framework: meta.framework ?? null,
                    createdAt: meta.createdAt ?? stat.birthtime.toISOString(),
                    updatedAt: stat.mtime.toISOString(),
                };
            }));

        const visible = projects
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        return { success: true, projects: visible, total: visible.length };
    });

    app.get<ProjectParams>('/api/v1/outputs/:projectId', {
        preHandler: optionalAuth,
        schema: { tags: ['Outputs'], summary: 'Get generated project files with contents' },
    }, async (request, reply) => {
        const project = await resolveProject(request, reply);
        if (!project) return reply;

        const files = await walk(project.projectPath);
        const withContent = await Promise.all(files.map(async (file) => ({
            ...file,
            content: file.size <= MAX_FILE_BYTES
                ? await fs.readFile(resolveInside(project.projectPath, file.path), 'utf-8')
                : null,
            truncated: file.size > MAX_FILE_BYTES,
        })));

        return {
            success: true,
            projectId: request.params.projectId,
            meta: project.meta,
            files: withContent,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
        };
    });

    app.get<ProjectParams>('/api/v1/outputs/:projectId/download', {
        preHandler: optionalAuth,
        schema: { tags: ['Outputs'], summary: 'Download generated project as ZIP' },
    }, async (request, reply) => {
        const project = await resolveProject(request, reply);
        if (!project) return reply;

        const zip = new AdmZip();
        const files = await walk(project.projectPath);
        for (const file of files) {
            zip.addFile(file.path, await fs.readFile(resolveInside(project.projectPath, file.path)));
        }

        return reply
            .header('Content-Type', 'application/zip')
            .header('Content-Disposition', `attachment; filename="${request.params.projectId}.zip"`)
            .send(zip.toBuffer());
    });

    app.delete<ProjectParams>('/api/v1/outputs/:projectId', {
        preHandler: optionalAuth,
        schema: { tags: ['Outputs'], summary: 'Delete a generated project' },
    }, async (request, reply) => {
        const project = await resolveProject(request, reply);
        if (!project) return reply;

        await getFileWriter().deleteProject(request.params.projectId);
        return { success: true };
    });
}
