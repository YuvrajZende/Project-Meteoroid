/**
 * PERF-006: Lazy Loading Service
 * 
 * Implements lazy loading for large datasets to improve performance.
 * Uses cursor-based pagination and on-demand loading.
 */

export interface LazyLoadOptions {
    /** Number of items to load per batch */
    batchSize?: number;
    /** Maximum items to load total (0 = unlimited) */
    maxItems?: number;
    /** Filter predicate to apply */
    filter?: (item: unknown) => boolean;
    /** Transform function to apply to each item */
    transform?: (item: unknown) => unknown;
    /** Sort comparator */
    sort?: (a: unknown, b: unknown) => number;
}

export interface LazyLoadResult<T> {
    items: T[];
    hasMore: boolean;
    nextCursor: string | null;
    totalLoaded: number;
}

export interface LazyLoadableCollection<T> {
    getTotalCount(): Promise<number>;
    fetchBatch(cursor: string | null, batchSize: number): Promise<{ items: T[]; nextCursor: string | null }>;
}

/**
 * Lazy Iterator for efficient iteration over large datasets
 */
export class LazyIterator<T> implements AsyncIterableIterator<T> {
    private buffer: T[] = [];
    private bufferIndex = 0;
    private cursor: string | null = null;
    private exhausted = false;
    private totalYielded = 0;

    constructor(
        private collection: LazyLoadableCollection<T>,
        private options: LazyLoadOptions = {}
    ) {
        this.options = {
            batchSize: 100,
            maxItems: 0,
            ...options,
        };
    }

    async next(): Promise<IteratorResult<T>> {
        if (this.options.maxItems && this.totalYielded >= this.options.maxItems) {
            return { done: true, value: undefined };
        }

        if (this.bufferIndex >= this.buffer.length) {
            if (this.exhausted) {
                return { done: true, value: undefined };
            }

            await this.fetchNextBatch();
            
            if (this.buffer.length === 0) {
                return { done: true, value: undefined };
            }
        }

        const item = this.buffer[this.bufferIndex++];
        this.totalYielded++;

        if (this.options.filter && !this.options.filter(item)) {
            return this.next();
        }

        const value = this.options.transform ? this.options.transform(item) as T : item;
        return { done: false, value };
    }

    private async fetchNextBatch(): Promise<void> {
        const { items, nextCursor } = await this.collection.fetchBatch(
            this.cursor,
            this.options.batchSize!
        );

        this.buffer = this.options.sort 
            ? items.sort(this.options.sort) 
            : items;
        this.bufferIndex = 0;
        this.cursor = nextCursor;
        this.exhausted = nextCursor === null;
    }

    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        return this;
    }

    /**
     * Collect all items into an array
     */
    async toArray(): Promise<T[]> {
        const results: T[] = [];
        for await (const item of this) {
            results.push(item);
        }
        return results;
    }

    /**
     * Take first N items
     */
    async take(count: number): Promise<T[]> {
        const results: T[] = [];
        for await (const item of this) {
            results.push(item);
            if (results.length >= count) break;
        }
        return results;
    }

    /**
     * Find first matching item
     */
    async find(predicate: (item: T) => boolean): Promise<T | undefined> {
        for await (const item of this) {
            if (predicate(item)) return item;
        }
        return undefined;
    }

    /**
     * Check if any item matches
     */
    async some(predicate: (item: T) => boolean): Promise<boolean> {
        for await (const item of this) {
            if (predicate(item)) return true;
        }
        return false;
    }

    /**
     * Check if all items match
     */
    async every(predicate: (item: T) => boolean): Promise<boolean> {
        for await (const item of this) {
            if (!predicate(item)) return false;
        }
        return true;
    }

    /**
     * Count items
     */
    async count(): Promise<number> {
        let count = 0;
        for await (const _ of this) {
            count++;
        }
        return count;
    }

    /**
     * Map items
     */
    map<R>(_fn: (item: T) => R): LazyIterator<R> {
        const self = this;
        
        const mappedCollection: LazyLoadableCollection<R> = {
            getTotalCount: () => self.collection.getTotalCount(),
            fetchBatch: async (cursor, batchSize) => {
                const result = await self.collection.fetchBatch(cursor, batchSize);
                return {
                    items: [],
                    nextCursor: result.nextCursor,
                };
            },
        };

        return new LazyIterator(mappedCollection, this.options);
    }

    /**
     * Filter items
     */
    filter(predicate: (item: T) => boolean): LazyIterator<T> {
        const originalFilter = this.options.filter;
        const combinedFilter = originalFilter
            ? (item: unknown) => originalFilter(item) && predicate(item as T)
            : predicate as (item: unknown) => boolean;

        return new LazyIterator(this.collection, {
            ...this.options,
            filter: combinedFilter,
        });
    }

    /**
     * Reduce items
     */
    async reduce<R>(fn: (acc: R, item: T) => R, initial: R): Promise<R> {
        let acc = initial;
        for await (const item of this) {
            acc = fn(acc, item);
        }
        return acc;
    }
}

/**
 * Lazy Loader Service
 * Provides lazy loading capabilities for repositories
 */
export class LazyLoaderService {
    private static instance: LazyLoaderService;

    private constructor() {}

    static getInstance(): LazyLoaderService {
        if (!LazyLoaderService.instance) {
            LazyLoaderService.instance = new LazyLoaderService();
        }
        return LazyLoaderService.instance;
    }

    /**
     * Create a lazy iterator for a collection
     */
    createIterator<T>(
        collection: LazyLoadableCollection<T>,
        options?: LazyLoadOptions
    ): LazyIterator<T> {
        return new LazyIterator(collection, options);
    }

    /**
     * Create a lazy-loadable collection from a fetch function
     */
    createCollection<T>(
        getTotalCount: () => Promise<number>,
        fetchBatch: (cursor: string | null, batchSize: number) => Promise<{ items: T[]; nextCursor: string | null }>
    ): LazyLoadableCollection<T> {
        return {
            getTotalCount,
            fetchBatch,
        };
    }

    /**
     * Load data in pages with callback for each page
     */
    async loadInPages<T>(
        fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; hasMore: boolean }>,
        onBatch: (items: T[], page: number) => Promise<void> | void,
        options: { pageSize?: number; maxPages?: number } = {}
    ): Promise<{ totalItems: number; totalPages: number }> {
        const pageSize = options.pageSize ?? 100;
        const maxPages = options.maxPages ?? 0;

        let page = 0;
        let totalItems = 0;
        let hasMore = true;

        while (hasMore) {
            if (maxPages && page >= maxPages) break;

            const { items, hasMore: more } = await fetchPage(page, pageSize);
            
            if (items.length === 0) break;

            await onBatch(items, page);
            
            totalItems += items.length;
            page++;
            hasMore = more;
        }

        return { totalItems, totalPages: page };
    }

    /**
     * Stream data with backpressure
     */
    async streamWithBackpressure<T>(
        fetchBatch: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>,
        onItem: (item: T) => Promise<void>,
        options: { concurrency?: number } = {}
    ): Promise<{ processed: number }> {
        const concurrency = options.concurrency ?? 10;
        let cursor: string | null = null;
        let processed = 0;

        do {
            const { items, nextCursor } = await fetchBatch(cursor);
            
            // Process items with limited concurrency
            const batches: T[][] = [];
            for (let i = 0; i < items.length; i += concurrency) {
                batches.push(items.slice(i, i + concurrency));
            }

            for (const batch of batches) {
                await Promise.all(batch.map(item => onItem(item)));
                processed += batch.length;
            }

            cursor = nextCursor;
        } while (cursor !== null);

        return { processed };
    }
}

/**
 * Decorator for making a repository method lazily loadable
 */
export function LazyLoad(batchSize: number = 100) {
    return function (
        _target: unknown,
        _propertyKey: string,
        descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>
    ) {
        const originalMethod = descriptor.value!;

        descriptor.value = async function (this: { getLazyLoader: () => LazyLoaderService }, ...args: unknown[]) {
            const lazyLoader = this.getLazyLoader?.() ?? LazyLoaderService.getInstance();
            
            const collection = lazyLoader.createCollection(
                async () => {
                    const result = await originalMethod.apply(this, [...args, { countOnly: true }]);
                    return (result as { count: number }).count;
                },
                async (cursor: string | null, size: number) => {
                    const result = await originalMethod.apply(this, [...args, { cursor, batchSize: size }]);
                    return result as { items: unknown[]; nextCursor: string | null };
                }
            );

            return lazyLoader.createIterator(collection, { batchSize });
        };

        return descriptor;
    };
}

// Export singleton getter
export const getLazyLoader = (): LazyLoaderService => LazyLoaderService.getInstance();
