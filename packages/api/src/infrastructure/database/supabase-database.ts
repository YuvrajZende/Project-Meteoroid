/**
 * Supabase Database Adapter
 * Implements IDatabase for Supabase by translating a deliberately small SQL
 * dialect into PostgREST (supabase-js query builder) calls.
 *
 * The translator is strict: every WHERE condition must be understood and
 * applied, otherwise a SqlTranslationError is thrown. It never silently drops
 * a condition (a dropped `AND user_id = $userId` on a DELETE previously wiped
 * all of a user's rows).
 *
 * Supported:
 *   SELECT *|col, ...|COUNT(*) [AS count]|DISTINCT col FROM t
 *       [WHERE ...] [ORDER BY col [ASC|DESC] [NULLS FIRST|LAST], ...] [LIMIT n] [OFFSET n]
 *   INSERT INTO t (cols) VALUES (vals)
 *       [ON CONFLICT (cols) DO NOTHING | DO UPDATE SET c = EXCLUDED.c, ...] [RETURNING *]
 *   UPDATE t SET c = v, c = c + n, ... WHERE ... [RETURNING *]
 *   DELETE FROM t WHERE ... [RETURNING *|COUNT(*) [AS count]]
 *
 * WHERE: either an AND-chain or an OR-chain (not mixed) of
 *   col = | != | <> | < | > | <= | >= | LIKE | ILIKE value
 *   col IS NULL, col IS NOT NULL, col IN (v, ...), col = ANY($array)
 * Values: $param (optionally ::type cast), 'string', number, TRUE, FALSE.
 *
 * Anything else (JOINs, GROUP BY, aliases, sub-queries, CASE, NOT IN, mixed
 * AND/OR, UPDATE/DELETE without WHERE, ...) throws SqlTranslationError.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-client.js';
import type { IDatabase, Transaction } from '../../interfaces/database.interface.js';

// ============================================
// TRANSLATION TYPES
// ============================================

export class SqlTranslationError extends Error {
    constructor(message: string, public readonly sql: string) {
        super(`${message} — SQL: ${sql.replace(/\s+/g, ' ').trim().slice(0, 300)}`);
        this.name = 'SqlTranslationError';
    }
}

export type ComparisonOp = 'eq' | 'neq' | 'lt' | 'gt' | 'lte' | 'gte' | 'like' | 'ilike';

export type SqlFilter =
    | { kind: 'cmp'; column: string; op: ComparisonOp; value: unknown }
    | { kind: 'is'; column: string; negate: boolean }
    | { kind: 'in'; column: string; values: unknown[] };

export interface SqlWhere {
    mode: 'and' | 'or';
    filters: SqlFilter[];
}

export interface SqlOrder {
    column: string;
    ascending: boolean;
    nullsFirst?: boolean;
}

export type SqlPlan =
    | {
        op: 'select';
        table: string;
        columns: string;
        distinct: boolean;
        count: boolean;
        where: SqlWhere | null;
        order: SqlOrder[];
        limit?: number;
        offset?: number;
    }
    | {
        op: 'insert';
        table: string;
        row: Record<string, unknown>;
        onConflict?: { columns: string[]; ignoreDuplicates: boolean };
    }
    | {
        op: 'update';
        table: string;
        set: Record<string, unknown>;
        increments: Record<string, number>;
        where: SqlWhere;
    }
    | {
        op: 'delete';
        table: string;
        where: SqlWhere;
        returning: 'none' | 'rows' | 'count';
    };

type Params = Record<string, unknown>;

const IDENT = '[A-Za-z_][A-Za-z0-9_]*';
const IDENT_RE = new RegExp(`^${IDENT}$`);
const NO_VALUE = Symbol('no-value');

const OPS: Record<string, ComparisonOp> = {
    '=': 'eq',
    '!=': 'neq',
    '<>': 'neq',
    '<': 'lt',
    '>': 'gt',
    '<=': 'lte',
    '>=': 'gte',
    'LIKE': 'like',
    'ILIKE': 'ilike',
};

// ============================================
// TRANSLATOR
// ============================================

interface Ctx {
    sql: string;
    params: Params;
    literals: string[];
}

/**
 * Replace single-quoted string literals with placeholders so structural
 * regexes cannot be confused by keywords/parens/commas inside strings.
 */
function maskLiterals(sql: string): { masked: string; literals: string[] } {
    const literals: string[] = [];
    let masked = '';
    let i = 0;
    while (i < sql.length) {
        const ch = sql[i];
        if (ch === '\'') {
            let j = i + 1;
            let value = '';
            for (; ;) {
                if (j >= sql.length) {
                    throw new SqlTranslationError('Unterminated string literal', sql);
                }
                if (sql[j] === '\'') {
                    if (sql[j + 1] === '\'') {
                        value += '\'';
                        j += 2;
                        continue;
                    }
                    break;
                }
                value += sql[j];
                j++;
            }
            masked += `__LIT${literals.length}__`;
            literals.push(value);
            i = j + 1;
        } else {
            masked += ch;
            i++;
        }
    }
    return { masked, literals };
}

/** Split on a separator regex, only where parenthesis depth is zero. */
function splitTopLevel(input: string, separator: RegExp): string[] {
    const parts: string[] = [];
    const flags = separator.flags.includes('g') ? separator.flags : separator.flags + 'g';
    const re = new RegExp(separator.source, flags);
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(input)) !== null) {
        const before = input.slice(0, match.index);
        const depth = (before.match(/\(/g)?.length ?? 0) - (before.match(/\)/g)?.length ?? 0);
        if (depth === 0) {
            parts.push(input.slice(last, match.index));
            last = match.index + match[0].length;
        }
        if (match[0].length === 0) re.lastIndex++;
    }
    parts.push(input.slice(last));
    return parts.map(p => p.trim());
}

function toSnakeCase(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Resolve a named parameter. Accepts `name`, `$name` and (because
 * BaseRepository.entityToRow() emits snake_case keys) the snake_case form.
 * Returns NO_VALUE when absent/undefined.
 */
function resolveParam(name: string, params: Params): unknown {
    const candidates = [name, `$${name}`, toSnakeCase(name)];
    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined) {
            return params[key];
        }
    }
    return NO_VALUE;
}

function maybeParseJson(value: unknown, force: boolean): unknown {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (
        force ||
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
        try {
            return JSON.parse(trimmed);
        } catch {
            if (force) return value;
        }
    }
    return value;
}

type ParsedValue = { kind: 'value'; value: unknown } | { kind: 'null' } | { kind: 'missing'; param: string };

/**
 * Parse a scalar SQL value expression.
 * `forWrite` enables JSON-string -> native conversion for json/jsonb columns.
 */
function parseValue(token: string, ctx: Ctx, forWrite: boolean): ParsedValue {
    const t = token.trim();

    const param = t.match(new RegExp(`^\\$(${IDENT}|\\d+)(?:::(${IDENT})(\\[\\])?)?$`));
    if (param) {
        const [, name, cast] = param;
        const value = resolveParam(name, ctx.params);
        if (value === NO_VALUE) return { kind: 'missing', param: name };
        if (value === null) return { kind: 'null' };
        const isJsonCast = cast ? /^jsonb?$/i.test(cast) : false;
        return { kind: 'value', value: forWrite ? maybeParseJson(value, isJsonCast) : value };
    }

    const lit = t.match(new RegExp(`^__LIT(\\d+)__(?:::(${IDENT}))?$`));
    if (lit) {
        const raw = ctx.literals[Number(lit[1])];
        const isJsonCast = lit[2] ? /^jsonb?$/i.test(lit[2]) : false;
        return { kind: 'value', value: forWrite && isJsonCast ? maybeParseJson(raw, true) : raw };
    }

    if (/^-?\d+(\.\d+)?$/.test(t)) return { kind: 'value', value: Number(t) };
    if (/^TRUE$/i.test(t)) return { kind: 'value', value: true };
    if (/^FALSE$/i.test(t)) return { kind: 'value', value: false };
    if (/^NULL$/i.test(t)) return { kind: 'null' };

    throw new SqlTranslationError(`Unsupported value expression "${restore(t, ctx)}"`, ctx.sql);
}

function restore(text: string, ctx: Ctx): string {
    return text.replace(/__LIT(\d+)__/g, (_, n) => `'${ctx.literals[Number(n)]}'`);
}

function requireIdent(name: string, ctx: Ctx, what: string): string {
    if (!IDENT_RE.test(name)) {
        throw new SqlTranslationError(`Unsupported ${what} "${restore(name, ctx)}"`, ctx.sql);
    }
    return name;
}

function parseCondition(raw: string, ctx: Ctx): SqlFilter {
    const c = raw.trim();

    let m = c.match(new RegExp(`^(${IDENT})\\s+IS\\s+(NOT\\s+)?NULL$`, 'i'));
    if (m) return { kind: 'is', column: m[1], negate: Boolean(m[2]) };

    m = c.match(new RegExp(`^(${IDENT})\\s*=\\s*ANY\\s*\\(\\s*(\\$[^)\\s]+)\\s*\\)$`, 'i'));
    if (m) {
        const parsed = parseValue(m[2], ctx, false);
        if (parsed.kind !== 'value' || !Array.isArray(parsed.value)) {
            throw new SqlTranslationError(`ANY() requires an array parameter for column "${m[1]}"`, ctx.sql);
        }
        return { kind: 'in', column: m[1], values: parsed.value };
    }

    m = c.match(new RegExp(`^(${IDENT})\\s+IN\\s*\\((.*)\\)$`, 'i'));
    if (m) {
        const items = splitTopLevel(m[2], /,/);
        const values = items.map(item => {
            const parsed = parseValue(item, ctx, false);
            if (parsed.kind === 'missing') {
                throw new SqlTranslationError(`Missing value for parameter "$${parsed.param}"`, ctx.sql);
            }
            if (parsed.kind === 'null') {
                throw new SqlTranslationError('NULL inside IN (...) is not supported', ctx.sql);
            }
            return parsed.value;
        });
        if (values.length === 0) {
            throw new SqlTranslationError('Empty IN () list', ctx.sql);
        }
        return { kind: 'in', column: m[1], values };
    }

    m = c.match(new RegExp(`^(${IDENT})\\s*(<=|>=|<>|!=|=|<|>|\\bI?LIKE\\b)\\s*(.+)$`, 'i'));
    if (m) {
        const [, column, opRaw, rhs] = m;
        const op = OPS[opRaw.toUpperCase()];
        const parsed = parseValue(rhs, ctx, false);
        if (parsed.kind === 'missing') {
            throw new SqlTranslationError(`Missing value for parameter "$${parsed.param}" in WHERE`, ctx.sql);
        }
        if (parsed.kind === 'null') {
            throw new SqlTranslationError(`Comparison with NULL on "${column}" (use IS [NOT] NULL)`, ctx.sql);
        }
        const value = parsed.value instanceof Date ? parsed.value.toISOString() : parsed.value;
        if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
            throw new SqlTranslationError(`Cannot compare column "${column}" with a non-scalar value`, ctx.sql);
        }
        return { kind: 'cmp', column, op, value };
    }

    throw new SqlTranslationError(`Unsupported WHERE condition "${restore(c, ctx)}"`, ctx.sql);
}

function parseWhere(clause: string, ctx: Ctx): SqlWhere {
    const text = clause.trim();
    if (!text) throw new SqlTranslationError('Empty WHERE clause', ctx.sql);

    const andParts = splitTopLevel(text, /\s+AND\s+/i);
    const orParts = splitTopLevel(text, /\s+OR\s+/i);

    if (andParts.length > 1 && orParts.length > 1) {
        throw new SqlTranslationError('Mixed AND/OR conditions are not supported', ctx.sql);
    }

    if (orParts.length > 1) {
        return { mode: 'or', filters: orParts.map(p => parseCondition(p, ctx)) };
    }
    return { mode: 'and', filters: andParts.map(p => parseCondition(p, ctx)) };
}

function parseOrderBy(clause: string, ctx: Ctx): SqlOrder[] {
    return splitTopLevel(clause, /,/).map(part => {
        const m = part.match(new RegExp(`^(${IDENT})(?:\\s+(ASC|DESC))?(?:\\s+NULLS\\s+(FIRST|LAST))?$`, 'i'));
        if (!m) throw new SqlTranslationError(`Unsupported ORDER BY item "${restore(part, ctx)}"`, ctx.sql);
        const order: SqlOrder = { column: m[1], ascending: (m[2] ?? 'ASC').toUpperCase() !== 'DESC' };
        if (m[3]) order.nullsFirst = m[3].toUpperCase() === 'FIRST';
        return order;
    });
}

function parseNonNegativeInt(token: string, ctx: Ctx, what: string): number {
    const parsed = parseValue(token, ctx, false);
    const value = parsed.kind === 'value' ? Number(parsed.value) : NaN;
    if (!Number.isInteger(value) || value < 0) {
        throw new SqlTranslationError(`Invalid ${what} value "${restore(token, ctx)}"`, ctx.sql);
    }
    return value;
}

function translateSelect(s: string, ctx: Ctx): SqlPlan {
    const m = s.match(new RegExp(`^SELECT\\s+(.+?)\\s+FROM\\s+(${IDENT})(?:\\s+(.*))?$`, 'is'));
    if (!m) throw new SqlTranslationError('Unsupported SELECT statement', ctx.sql);
    const [, columnsRaw, table, restRaw = ''] = m;

    const rest = restRaw.trim().match(
        /^(?:WHERE\s+(.+?))?\s*(?:ORDER\s+BY\s+(.+?))?\s*(?:LIMIT\s+(\S+))?\s*(?:OFFSET\s+(\S+))?$/is
    );
    if (!rest) throw new SqlTranslationError('Unsupported SELECT clauses (JOIN/GROUP BY/alias?)', ctx.sql);
    const [, whereRaw, orderRaw, limitRaw, offsetRaw] = rest;

    let columns = '*';
    let distinct = false;
    let count = false;
    const cols = columnsRaw.trim();
    if (/^COUNT\s*\(\s*\*\s*\)(?:\s+AS\s+count)?$/i.test(cols)) {
        count = true;
    } else if (cols !== '*') {
        const d = cols.match(new RegExp(`^DISTINCT\\s+(${IDENT})$`, 'i'));
        if (d) {
            distinct = true;
            columns = d[1];
        } else {
            columns = splitTopLevel(cols, /,/).map(c => requireIdent(c, ctx, 'select column')).join(',');
        }
    }

    const plan: SqlPlan = {
        op: 'select',
        table,
        columns,
        distinct,
        count,
        where: whereRaw ? parseWhere(whereRaw, ctx) : null,
        order: orderRaw ? parseOrderBy(orderRaw, ctx) : [],
    };
    if (limitRaw) plan.limit = parseNonNegativeInt(limitRaw, ctx, 'LIMIT');
    if (offsetRaw) plan.offset = parseNonNegativeInt(offsetRaw, ctx, 'OFFSET');
    if (count && (plan.order.length || plan.limit !== undefined || plan.offset !== undefined)) {
        throw new SqlTranslationError('COUNT(*) with ORDER BY/LIMIT/OFFSET is not supported', ctx.sql);
    }
    return plan;
}

function translateInsert(s: string, ctx: Ctx): SqlPlan {
    const m = s.match(new RegExp(
        `^INSERT\\s+INTO\\s+(${IDENT})\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\((.*?)\\)` +
        `(?:\\s+ON\\s+CONFLICT\\s*\\(([^)]*)\\)\\s*DO\\s+(NOTHING|UPDATE\\s+SET\\s+(.+?)))?` +
        `(?:\\s+RETURNING\\s+(.+))?$`,
        'is'
    ));
    if (!m) throw new SqlTranslationError('Unsupported INSERT statement', ctx.sql);
    const [, table, colsRaw, valsRaw, conflictRaw, conflictAction, conflictSet, returning] = m;

    if (returning && returning.trim() !== '*') {
        throw new SqlTranslationError('Only RETURNING * is supported for INSERT', ctx.sql);
    }

    const columns = splitTopLevel(colsRaw, /,/).map(c => requireIdent(c, ctx, 'insert column'));
    const values = splitTopLevel(valsRaw, /,/);
    if (columns.length !== values.length) {
        throw new SqlTranslationError(`INSERT has ${columns.length} columns but ${values.length} values`, ctx.sql);
    }

    const row: Record<string, unknown> = {};
    columns.forEach((column, i) => {
        const parsed = parseValue(values[i], ctx, true);
        // An absent parameter means "not provided": omit it so the column default applies.
        if (parsed.kind === 'missing') return;
        row[column] = parsed.kind === 'null' ? null : (parsed.value instanceof Date ? parsed.value.toISOString() : parsed.value);
    });

    const plan: SqlPlan = { op: 'insert', table, row };

    if (conflictRaw !== undefined) {
        const conflictColumns = splitTopLevel(conflictRaw, /,/).map(c => requireIdent(c, ctx, 'conflict column'));
        if (/^NOTHING$/i.test(conflictAction)) {
            plan.onConflict = { columns: conflictColumns, ignoreDuplicates: true };
        } else {
            // PostgREST upserts overwrite every supplied column, so only accept
            // DO UPDATE SET lists that are exactly "all non-key columns = EXCLUDED.col".
            const updated = splitTopLevel(conflictSet, /,/).map(a => {
                const am = a.match(new RegExp(`^(${IDENT})\\s*=\\s*EXCLUDED\\.(${IDENT})$`, 'i'));
                if (!am || am[1] !== am[2]) {
                    throw new SqlTranslationError(`Unsupported ON CONFLICT assignment "${restore(a, ctx)}"`, ctx.sql);
                }
                return am[1];
            });
            const expected = columns.filter(c => !conflictColumns.includes(c)).sort();
            const actual = [...new Set(updated)].sort();
            if (expected.join(',') !== actual.join(',')) {
                throw new SqlTranslationError(
                    'ON CONFLICT DO UPDATE must update exactly the non-conflict inserted columns',
                    ctx.sql
                );
            }
            plan.onConflict = { columns: conflictColumns, ignoreDuplicates: false };
        }
    }

    return plan;
}

function translateUpdate(s: string, ctx: Ctx): SqlPlan {
    const m = s.match(new RegExp(
        `^UPDATE\\s+(${IDENT})\\s+SET\\s+(.+?)(?:\\s+WHERE\\s+(.+?))?(?:\\s+RETURNING\\s+(.+))?$`,
        'is'
    ));
    if (!m) throw new SqlTranslationError('Unsupported UPDATE statement', ctx.sql);
    const [, table, setRaw, whereRaw, returning] = m;

    if (!whereRaw) {
        throw new SqlTranslationError('UPDATE without WHERE is refused', ctx.sql);
    }
    if (returning && returning.trim() !== '*') {
        throw new SqlTranslationError('Only RETURNING * is supported for UPDATE', ctx.sql);
    }

    const set: Record<string, unknown> = {};
    const increments: Record<string, number> = {};

    for (const assignment of splitTopLevel(setRaw, /,/)) {
        const am = assignment.match(new RegExp(`^(${IDENT})\\s*=\\s*(.+)$`, 's'));
        if (!am) throw new SqlTranslationError(`Unsupported SET assignment "${restore(assignment, ctx)}"`, ctx.sql);
        const [, column, rhs] = am;

        const inc = rhs.trim().match(new RegExp(`^(${IDENT})\\s*([+-])\\s*(\\d+(?:\\.\\d+)?)$`));
        if (inc) {
            if (inc[1] !== column) {
                throw new SqlTranslationError(`Unsupported expression in SET for "${column}"`, ctx.sql);
            }
            increments[column] = Number(inc[3]) * (inc[2] === '-' ? -1 : 1);
            continue;
        }

        const parsed = parseValue(rhs, ctx, true);
        // An undefined parameter leaves the column untouched (same as JSON serialisation).
        if (parsed.kind === 'missing') continue;
        set[column] = parsed.kind === 'null' ? null : (parsed.value instanceof Date ? parsed.value.toISOString() : parsed.value);
    }

    if (Object.keys(set).length === 0 && Object.keys(increments).length === 0) {
        throw new SqlTranslationError('UPDATE has no values to set', ctx.sql);
    }

    return { op: 'update', table, set, increments, where: parseWhere(whereRaw, ctx) };
}

function translateDelete(s: string, ctx: Ctx): SqlPlan {
    const m = s.match(new RegExp(
        `^DELETE\\s+FROM\\s+(${IDENT})(?:\\s+WHERE\\s+(.+?))?(?:\\s+RETURNING\\s+(.+))?$`,
        'is'
    ));
    if (!m) throw new SqlTranslationError('Unsupported DELETE statement', ctx.sql);
    const [, table, whereRaw, returningRaw] = m;

    if (!whereRaw) {
        throw new SqlTranslationError('DELETE without WHERE is refused', ctx.sql);
    }

    let returning: 'none' | 'rows' | 'count' = 'none';
    if (returningRaw) {
        const r = returningRaw.trim();
        if (r === '*') returning = 'rows';
        else if (/^COUNT\s*\(\s*\*\s*\)(?:\s+AS\s+count)?$/i.test(r)) returning = 'count';
        else throw new SqlTranslationError(`Unsupported RETURNING "${restore(r, ctx)}"`, ctx.sql);
    }

    return { op: 'delete', table, where: parseWhere(whereRaw, ctx), returning };
}

/**
 * Translate a SQL statement + named params into a PostgREST execution plan.
 * Throws SqlTranslationError for anything it cannot represent exactly.
 */
export function translateSql(sql: string, params: Params = {}): SqlPlan {
    const { masked, literals } = maskLiterals(sql);
    const statement = masked.replace(/\s+/g, ' ').trim().replace(/;$/, '').trim();
    const ctx: Ctx = { sql, params, literals };

    if (/--|\/\*|;/.test(statement)) {
        throw new SqlTranslationError('Comments and multiple statements are not supported', sql);
    }

    const keyword = statement.split(' ', 1)[0].toUpperCase();
    switch (keyword) {
        case 'SELECT': return translateSelect(statement, ctx);
        case 'INSERT': return translateInsert(statement, ctx);
        case 'UPDATE': return translateUpdate(statement, ctx);
        case 'DELETE': return translateDelete(statement, ctx);
        default:
            throw new SqlTranslationError(`Unsupported statement type "${keyword}"`, sql);
    }
}

// ============================================
// EXECUTION
// ============================================

/** Minimal structural view of the PostgREST filter builder we rely on. */
interface FilterBuilder {
    eq(column: string, value: unknown): FilterBuilder;
    neq(column: string, value: unknown): FilterBuilder;
    lt(column: string, value: unknown): FilterBuilder;
    gt(column: string, value: unknown): FilterBuilder;
    lte(column: string, value: unknown): FilterBuilder;
    gte(column: string, value: unknown): FilterBuilder;
    like(column: string, pattern: string): FilterBuilder;
    ilike(column: string, pattern: string): FilterBuilder;
    is(column: string, value: null): FilterBuilder;
    not(column: string, operator: string, value: unknown): FilterBuilder;
    in(column: string, values: unknown[]): FilterBuilder;
    or(filters: string): FilterBuilder;
    order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): FilterBuilder;
    limit(count: number): FilterBuilder;
    range(from: number, to: number): FilterBuilder;
    select(columns?: string): FilterBuilder;
    then<R>(onfulfilled: (value: PostgrestResult) => R): Promise<R>;
}

interface PostgrestResult {
    data: unknown;
    error: { message: string } | null;
    count?: number | null;
}

/** Quote a value for a PostgREST `or=(...)` filter string. */
function formatOrValue(value: unknown): string {
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    const str = value instanceof Date ? value.toISOString() : String(value);
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function filterToOrString(filter: SqlFilter): string {
    switch (filter.kind) {
        case 'is': return `${filter.column}.${filter.negate ? 'not.is' : 'is'}.null`;
        case 'in': return `${filter.column}.in.(${filter.values.map(formatOrValue).join(',')})`;
        case 'cmp': return `${filter.column}.${filter.op}.${formatOrValue(filter.value)}`;
    }
}

export function applyWhere(builder: FilterBuilder, where: SqlWhere | null): FilterBuilder {
    if (!where) return builder;

    if (where.mode === 'or') {
        return builder.or(where.filters.map(filterToOrString).join(','));
    }

    let q = builder;
    for (const f of where.filters) {
        switch (f.kind) {
            case 'is':
                q = f.negate ? q.not(f.column, 'is', null) : q.is(f.column, null);
                break;
            case 'in':
                q = q.in(f.column, f.values);
                break;
            case 'cmp':
                if (f.op === 'like' || f.op === 'ilike') {
                    q = q[f.op](f.column, String(f.value));
                } else {
                    q = q[f.op](f.column, f.value);
                }
                break;
        }
    }
    return q;
}

function unwrap(result: PostgrestResult, what: string): unknown[] {
    if (result.error) {
        throw new Error(`${what} failed: ${result.error.message}`);
    }
    return Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
}

export class SupabaseDatabase implements IDatabase {
    private initialized: boolean = false;
    // No constructor parameters: this class is resolved by the DI container.
    private clientFactory: () => SupabaseClient = getSupabaseAdmin;

    /** Create an instance bound to a specific client (used by tests and scripts). */
    static withClient(factory: () => SupabaseClient): SupabaseDatabase {
        const db = new SupabaseDatabase();
        db.clientFactory = factory;
        return db;
    }

    private from(table: string): Record<string, (...args: unknown[]) => FilterBuilder> {
        return this.clientFactory().from(table) as unknown as Record<string, (...args: unknown[]) => FilterBuilder>;
    }

    async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        const plan = translateSql(sql, params ?? {});

        switch (plan.op) {
            case 'select': {
                let q = plan.count
                    ? this.from(plan.table).select('*', { count: 'exact', head: true })
                    : this.from(plan.table).select(plan.columns);
                q = applyWhere(q, plan.where);
                for (const o of plan.order) {
                    q = q.order(o.column, o.nullsFirst === undefined
                        ? { ascending: o.ascending }
                        : { ascending: o.ascending, nullsFirst: o.nullsFirst });
                }
                if (plan.offset !== undefined) {
                    const size = plan.limit ?? 1000;
                    q = q.range(plan.offset, plan.offset + size - 1);
                } else if (plan.limit !== undefined) {
                    q = q.limit(plan.limit);
                }

                const result = await q;
                if (plan.count) {
                    if (result.error) throw new Error(`Query failed: ${result.error.message}`);
                    return [{ count: result.count ?? 0 }] as T[];
                }
                const rows = unwrap(result, 'Query');
                if (plan.distinct) {
                    const seen = new Set<string>();
                    return rows.filter(r => {
                        const key = JSON.stringify((r as Record<string, unknown>)[plan.columns]);
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    }) as T[];
                }
                return rows as T[];
            }

            case 'insert': {
                const base = plan.onConflict
                    ? this.from(plan.table).upsert(plan.row, {
                        onConflict: plan.onConflict.columns.join(','),
                        ignoreDuplicates: plan.onConflict.ignoreDuplicates,
                    })
                    : this.from(plan.table).insert(plan.row);
                return unwrap(await base.select(), 'Insert') as T[];
            }

            case 'update': {
                if (Object.keys(plan.increments).length === 0) {
                    const q = applyWhere(this.from(plan.table).update(plan.set), plan.where);
                    return unwrap(await q.select(), 'Update') as T[];
                }

                // PostgREST cannot express "col = col + n"; read-modify-write per row by id.
                // NOTE: not atomic — concurrent increments can be lost. Use an RPC if that matters.
                const current = unwrap(await applyWhere(this.from(plan.table).select('*'), plan.where), 'Update (fetch)');
                const updated: unknown[] = [];
                for (const row of current as Record<string, unknown>[]) {
                    if (row.id === undefined || row.id === null) {
                        throw new Error(`Update failed: rows of "${plan.table}" have no id column for increment`);
                    }
                    const data: Record<string, unknown> = { ...plan.set };
                    for (const [column, delta] of Object.entries(plan.increments)) {
                        data[column] = Number(row[column] ?? 0) + delta;
                    }
                    const q = this.from(plan.table).update(data).eq('id', row.id);
                    updated.push(...unwrap(await q.select(), 'Update'));
                }
                return updated as T[];
            }

            case 'delete': {
                const base = plan.returning === 'count'
                    ? this.from(plan.table).delete({ count: 'exact' })
                    : this.from(plan.table).delete();
                let q = applyWhere(base, plan.where);
                if (plan.returning === 'rows') q = q.select();
                const result = await q;
                if (plan.returning === 'count') {
                    if (result.error) throw new Error(`Delete failed: ${result.error.message}`);
                    return [{ count: result.count ?? 0 }] as T[];
                }
                const rows = unwrap(result, 'Delete');
                return (plan.returning === 'rows' ? rows : []) as T[];
            }
        }
    }

    /**
     * Transactions are NOT supported: PostgREST executes each request in its own
     * transaction, so there is no way to group several statements client-side.
     * Use a Postgres function invoked via supabase.rpc() for atomic multi-step writes.
     */
    async transaction<T>(_callback: (trx: Transaction) => Promise<T>): Promise<T> {
        throw new Error(
            'SupabaseDatabase.transaction() is not supported: PostgREST cannot group statements. ' +
            'Implement the operation as a Postgres function and call it via supabase.rpc().'
        );
    }

    /**
     * Get connection health status
     */
    async getConnectionState(): Promise<{ connected: boolean; latency?: number }> {
        const startTime = Date.now();

        try {
            const { error } = await this.clientFactory().from('users').select('id').limit(1);
            if (error) {
                return { connected: false };
            }
            return { connected: true, latency: Date.now() - startTime };
        } catch {
            return { connected: false };
        }
    }

    /**
     * Supabase client is a shared singleton; nothing to close.
     */
    async close(): Promise<void> {
        this.initialized = false;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        const state = await this.getConnectionState();
        if (!state.connected) {
            throw new Error('Failed to connect to Supabase');
        }

        this.initialized = true;
    }
}
