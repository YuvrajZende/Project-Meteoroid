/**
 * Unit tests: SQL -> PostgREST translator and SupabaseDatabase execution
 */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { translateSql, SqlTranslationError, SupabaseDatabase } from '../supabase-database.js';

describe('translateSql', () => {
    describe('WHERE AND-chains', () => {
        it('keeps every condition of a DELETE (regression: user-wide wipe)', () => {
            const plan = translateSql(
                'DELETE FROM project_contexts WHERE user_id = $userId AND project_id = $projectId',
                { userId: 'u1', projectId: 'p1' }
            );
            expect(plan).toEqual({
                op: 'delete',
                table: 'project_contexts',
                returning: 'none',
                where: {
                    mode: 'and',
                    filters: [
                        { kind: 'cmp', column: 'user_id', op: 'eq', value: 'u1' },
                        { kind: 'cmp', column: 'project_id', op: 'eq', value: 'p1' },
                    ],
                },
            });
        });

        it('handles =, !=, <>, <, >, <=, >= with params and literals', () => {
            const plan = translateSql(
                `SELECT * FROM projects WHERE user_id = $userId AND status != 'deleted' AND kind <> 'x'
                 AND a < 1 AND b > $b AND c <= 2.5 AND d >= $d`,
                { userId: 'u1', b: 5, d: new Date('2024-01-01T00:00:00Z') }
            );
            if (plan.op !== 'select') throw new Error('expected select');
            expect(plan.where?.filters).toEqual([
                { kind: 'cmp', column: 'user_id', op: 'eq', value: 'u1' },
                { kind: 'cmp', column: 'status', op: 'neq', value: 'deleted' },
                { kind: 'cmp', column: 'kind', op: 'neq', value: 'x' },
                { kind: 'cmp', column: 'a', op: 'lt', value: 1 },
                { kind: 'cmp', column: 'b', op: 'gt', value: 5 },
                { kind: 'cmp', column: 'c', op: 'lte', value: 2.5 },
                { kind: 'cmp', column: 'd', op: 'gte', value: '2024-01-01T00:00:00.000Z' },
            ]);
        });

        it('handles IS NULL / IS NOT NULL', () => {
            const plan = translateSql('SELECT * FROM tasks WHERE completed_at IS NULL AND started_at IS NOT NULL');
            if (plan.op !== 'select') throw new Error('expected select');
            expect(plan.where?.filters).toEqual([
                { kind: 'is', column: 'completed_at', negate: false },
                { kind: 'is', column: 'started_at', negate: true },
            ]);
        });

        it('handles IN (...) lists and = ANY($array)', () => {
            const plan = translateSql(
                `SELECT * FROM tasks WHERE status IN ('a', $s, 3) AND id = ANY($ids)`,
                { s: 'b', ids: ['1', '2'] }
            );
            if (plan.op !== 'select') throw new Error('expected select');
            expect(plan.where?.filters).toEqual([
                { kind: 'in', column: 'status', values: ['a', 'b', 3] },
                { kind: 'in', column: 'id', values: ['1', '2'] },
            ]);
        });

        it('does not split on AND/commas inside string literals', () => {
            const plan = translateSql(`SELECT * FROM t WHERE name = 'a AND b, c' AND x = 'it''s'`);
            if (plan.op !== 'select') throw new Error('expected select');
            expect(plan.where?.filters).toEqual([
                { kind: 'cmp', column: 'name', op: 'eq', value: 'a AND b, c' },
                { kind: 'cmp', column: 'x', op: 'eq', value: 'it\'s' },
            ]);
        });

        it('resolves snake_case params produced by entityToRow()', () => {
            const plan = translateSql('SELECT * FROM t WHERE project_id = $projectId', { project_id: 'p9' });
            if (plan.op !== 'select') throw new Error('expected select');
            expect(plan.where?.filters[0]).toEqual({ kind: 'cmp', column: 'project_id', op: 'eq', value: 'p9' });
        });

        it('supports pure OR-chains', () => {
            const plan = translateSql('SELECT * FROM users WHERE name ILIKE $q OR email ILIKE $q', { q: '%bob%' });
            if (plan.op !== 'select') throw new Error('expected select');
            expect(plan.where?.mode).toBe('or');
            expect(plan.where?.filters).toHaveLength(2);
        });
    });

    describe('refuses what it cannot fully translate', () => {
        const cases: Array<[string, string, Record<string, unknown>?]> = [
            ['missing WHERE param', 'DELETE FROM t WHERE user_id = $userId AND id = $id', { id: '1' }],
            ['mixed AND/OR', 'SELECT * FROM t WHERE a = 1 AND b = 2 OR c = 3'],
            ['parenthesised groups', 'SELECT * FROM t WHERE (a = 1 OR b = 2) AND c = 3'],
            ['function on column', 'SELECT * FROM t WHERE LOWER(email) = $e', { e: 'x' }],
            ['BETWEEN', 'SELECT * FROM t WHERE a BETWEEN 1 AND 2'],
            ['NOT IN', `SELECT * FROM t WHERE a NOT IN ('x')`],
            ['= NULL', 'SELECT * FROM t WHERE a = NULL'],
            ['DELETE without WHERE', 'DELETE FROM t'],
            ['UPDATE without WHERE', 'UPDATE t SET a = 1'],
            ['JOIN', 'SELECT * FROM t JOIN u ON u.id = t.uid WHERE t.a = 1'],
            ['table alias', 'SELECT p.* FROM projects p WHERE p.id = $id', { id: '1' }],
            ['GROUP BY', 'SELECT role, COUNT(*) as count FROM users GROUP BY role'],
            ['CASE in SET', 'UPDATE tasks SET status = CASE WHEN id = $a THEN $b END WHERE id = ANY($ids)', { a: 1, b: 2, ids: [1] }],
            ['ANY with non-array', 'SELECT * FROM t WHERE id = ANY($ids)', { ids: 'x' }],
            ['multiple statements', 'DELETE FROM t WHERE id = 1; DELETE FROM u WHERE id = 2'],
            ['comments', 'DELETE FROM t WHERE id = 1 -- AND user_id = 2'],
            ['partial ON CONFLICT update', 'INSERT INTO t (a, b, c) VALUES (1, 2, 3) ON CONFLICT (a) DO UPDATE SET b = EXCLUDED.b'],
        ];

        it.each(cases)('throws on %s', (_name, sql, params) => {
            expect(() => translateSql(sql, params ?? {})).toThrow(SqlTranslationError);
        });
    });

    describe('SELECT', () => {
        it('parses multi-column ORDER BY, LIMIT and OFFSET (literal and param)', () => {
            const plan = translateSql(
                'SELECT * FROM learned_patterns ORDER BY frequency DESC, confidence DESC NULLS LAST LIMIT $limit OFFSET 20',
                { limit: 10 }
            );
            expect(plan).toMatchObject({
                op: 'select',
                order: [
                    { column: 'frequency', ascending: false },
                    { column: 'confidence', ascending: false, nullsFirst: false },
                ],
                limit: 10,
                offset: 20,
            });
        });

        it('recognises COUNT(*) and DISTINCT', () => {
            expect(translateSql('SELECT COUNT(*) as count FROM projects WHERE user_id = $u', { u: '1' }))
                .toMatchObject({ op: 'select', count: true });
            expect(translateSql('SELECT DISTINCT user_id FROM audit_logs WHERE project_id = $p', { p: '1' }))
                .toMatchObject({ op: 'select', distinct: true, columns: 'user_id' });
        });
    });

    describe('INSERT', () => {
        it('maps columns to values, omits undefined params and parses JSON for json columns', () => {
            const plan = translateSql(
                `INSERT INTO tasks (id, config, result, status) VALUES ($id, $config::jsonb, $result::jsonb, 'pending') RETURNING *`,
                { id: 't1', config: '{"a":1}', extra: 'ignored' }
            );
            expect(plan).toEqual({
                op: 'insert',
                table: 'tasks',
                row: { id: 't1', config: { a: 1 }, status: 'pending' },
            });
        });

        it('translates a full ON CONFLICT DO UPDATE into an upsert', () => {
            const plan = translateSql(
                `INSERT INTO project_contexts (user_id, project_id, preferences) VALUES ($userId, $projectId, $preferences)
                 ON CONFLICT (user_id, project_id) DO UPDATE SET preferences = EXCLUDED.preferences`,
                { user_id: 'u', project_id: 'p', preferences: '{}' }
            );
            expect(plan).toMatchObject({
                op: 'insert',
                row: { user_id: 'u', project_id: 'p', preferences: {} },
                onConflict: { columns: ['user_id', 'project_id'], ignoreDuplicates: false },
            });
        });
    });

    describe('UPDATE', () => {
        it('builds SET from the SET clause only (not from WHERE params)', () => {
            const plan = translateSql(
                `UPDATE project_contexts SET preferences = $1, last_active = $lastActive
                 WHERE user_id = $userId AND project_id = $projectId`,
                { $1: '{"t":1}', lastActive: '2024-01-01', userId: 'u', projectId: 'p' }
            );
            expect(plan).toEqual({
                op: 'update',
                table: 'project_contexts',
                set: { preferences: { t: 1 }, last_active: '2024-01-01' },
                increments: {},
                where: {
                    mode: 'and',
                    filters: [
                        { kind: 'cmp', column: 'user_id', op: 'eq', value: 'u' },
                        { kind: 'cmp', column: 'project_id', op: 'eq', value: 'p' },
                    ],
                },
            });
        });

        it('supports column increments and NULL / literal assignments', () => {
            const plan = translateSql(
                `UPDATE learned_patterns SET frequency = frequency + 1, note = NULL, status = 'x' WHERE id = $id`,
                { id: '1' }
            );
            expect(plan).toMatchObject({
                op: 'update',
                set: { note: null, status: 'x' },
                increments: { frequency: 1 },
            });
        });
    });

    describe('DELETE', () => {
        it('supports RETURNING COUNT(*)', () => {
            expect(translateSql('DELETE FROM audit_logs WHERE created_at < $date RETURNING COUNT(*) as count', { date: 'x' }))
                .toMatchObject({ op: 'delete', returning: 'count' });
        });
    });
});

// ============================================
// EXECUTION AGAINST A RECORDING FAKE CLIENT
// ============================================

type Call = [string, ...unknown[]];

function fakeClient(result: { data?: unknown; error?: { message: string } | null; count?: number }) {
    const calls: Call[] = [];
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'lt', 'gt', 'lte', 'gte',
        'like', 'ilike', 'is', 'not', 'in', 'or', 'order', 'limit', 'range']) {
        builder[method] = (...args: unknown[]) => {
            calls.push([method, ...args]);
            return builder;
        };
    }
    builder.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: result.data ?? [], error: result.error ?? null, count: result.count }).then(resolve);
    const client = {
        from: (table: string) => {
            calls.push(['from', table]);
            return builder;
        },
    } as unknown as SupabaseClient;
    return { client, calls };
}

describe('SupabaseDatabase.query', () => {
    it('applies every WHERE filter to a DELETE', async () => {
        const { client, calls } = fakeClient({});
        const db = SupabaseDatabase.withClient(() => client);

        await db.query('DELETE FROM project_contexts WHERE user_id = $userId AND project_id = $projectId', {
            userId: 'u1',
            projectId: 'p1',
        });

        expect(calls).toEqual([
            ['from', 'project_contexts'],
            ['delete'],
            ['eq', 'user_id', 'u1'],
            ['eq', 'project_id', 'p1'],
        ]);
    });

    it('never reaches the client when the SQL is untranslatable', async () => {
        const { client, calls } = fakeClient({});
        const db = SupabaseDatabase.withClient(() => client);

        await expect(db.query('DELETE FROM t WHERE user_id = $userId', {})).rejects.toThrow(SqlTranslationError);
        expect(calls).toEqual([]);
    });

    it('maps operators, IS NULL, IN, ORDER BY and pagination', async () => {
        const { client, calls } = fakeClient({ data: [{ id: 1 }] });
        const db = SupabaseDatabase.withClient(() => client);

        const rows = await db.query(
            `SELECT * FROM projects WHERE user_id = $u AND status != 'deleted' AND archived_at IS NULL
             AND deleted_at IS NOT NULL AND id IN ($a, $b) ORDER BY created_at DESC LIMIT 10 OFFSET 20`,
            { u: 'u1', a: 'x', b: 'y' }
        );

        expect(rows).toEqual([{ id: 1 }]);
        expect(calls).toEqual([
            ['from', 'projects'],
            ['select', '*'],
            ['eq', 'user_id', 'u1'],
            ['neq', 'status', 'deleted'],
            ['is', 'archived_at', null],
            ['not', 'deleted_at', 'is', null],
            ['in', 'id', ['x', 'y']],
            ['order', 'created_at', { ascending: false }],
            ['range', 20, 29],
        ]);
    });

    it('builds a quoted PostgREST or() filter for OR-chains', async () => {
        const { client, calls } = fakeClient({ data: [] });
        const db = SupabaseDatabase.withClient(() => client);

        await db.query('SELECT * FROM users WHERE name ILIKE $q OR email ILIKE $q', { q: '%a,"b"%' });

        expect(calls).toContainEqual(['or', 'name.ilike."%a,\\"b\\"%",email.ilike."%a,\\"b\\"%"']);
    });

    it('returns counts for COUNT(*)', async () => {
        const { client, calls } = fakeClient({ count: 7 });
        const db = SupabaseDatabase.withClient(() => client);

        const rows = await db.query('SELECT COUNT(*) as count FROM projects WHERE user_id = $u', { u: 'u1' });

        expect(rows).toEqual([{ count: 7 }]);
        expect(calls[1]).toEqual(['select', '*', { count: 'exact', head: true }]);
    });

    it('propagates PostgREST errors', async () => {
        const { client } = fakeClient({ error: { message: 'boom' } });
        const db = SupabaseDatabase.withClient(() => client);

        await expect(db.query('SELECT * FROM t WHERE id = $id', { id: 1 })).rejects.toThrow('boom');
    });

    it('refuses transactions instead of pretending', async () => {
        const db = SupabaseDatabase.withClient(() => ({}) as SupabaseClient);
        await expect(db.transaction(async () => 1)).rejects.toThrow(/not supported/);
    });
});
