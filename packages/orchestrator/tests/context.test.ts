import { createContext, recordFile, FileCollisionError } from '../src/pipeline/context';

const f = (path: string) => ({ path, content: 'x', type: 'code' as const });

describe('PipelineContextData', () => {
    it('creates empty context', () => {
        const ctx = createContext('demo');
        expect(ctx.requestName).toBe('demo');
        expect(ctx.files.size).toBe(0);
        expect(ctx.errors).toEqual([]);
        expect(ctx.upstream).toEqual({});
    });

    it('records files', () => {
        const ctx = createContext('demo');
        recordFile(ctx, f('a.ts'));
        expect(ctx.files.get('a.ts')).toBeDefined();
    });

    it('detects collisions loudly', () => {
        const ctx = createContext('demo');
        recordFile(ctx, f('a.ts'));
        expect(() => recordFile(ctx, f('a.ts'))).toThrow(FileCollisionError);
    });
});
