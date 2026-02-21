/**
 * Redis Cache Service
 * Provides caching layer for frequently accessed data
 * 
 * PERFORMANCE FEATURES:
 * - Reduces database queries for frequently accessed data
 * - Automatic cache invalidation
 * - TTL-based expiration
 * - Cache statistics tracking
 * - Graceful fallback when Redis is unavailable
 */

import Redis from 'ioredis';

// ============================================
// Cache Configuration
// ============================================

const CACHE_CONFIG = {
    // Default TTL for cached items
    defaultTTL: 300, // 5 minutes
    
    // TTL by data type
    ttl: {
        user: 3600,           // 1 hour
        project: 600,         // 10 minutes
        task: 300,            // 5 minutes
        learning: 1800,       // 30 minutes
        embeddings: 3600,     // 1 hour
        patterns: 7200,       // 2 hours
        health: 30,           // 30 seconds
    },
    
    // Key prefixes for namespacing
    prefixes: {
        user: 'cache:user:',
        project: 'cache:project:',
        task: 'cache:task:',
        learning: 'cache:learning:',
        embeddings: 'cache:embed:',
        patterns: 'cache:pattern:',
        health: 'cache:health:',
    },
    
    // Maximum retries for Redis operations
    maxRetries: 3,
};

// ============================================
// Cache Statistics
// ============================================

interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
}

const stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
};

// ============================================
// Redis Cache Service
// ============================================

export class RedisCacheService {
    private redis: Redis | null = null;
    private connected: boolean = false;
    private reconnectAttempts: number = 0;

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        const redisUrl = process.env.REDIS_URL;
        
        if (!redisUrl) {
            console.log('[CACHE] Redis URL not configured, caching disabled');
            return;
        }

        try {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: CACHE_CONFIG.maxRetries,
                retryStrategy: (times: number) => {
                    if (times > 10) {
                        console.warn('[CACHE] Redis connection failed after 10 retries');
                        return null;
                    }
                    return Math.min(times * 100, 3000);
                },
                lazyConnect: true,
            });

            this.redis.on('connect', () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                console.log('[CACHE] Redis connected');
            });

            this.redis.on('error', (err) => {
                console.warn('[CACHE] Redis error:', err.message);
                this.connected = false;
                stats.errors++;
            });

            this.redis.on('close', () => {
                this.connected = false;
                console.log('[CACHE] Redis connection closed');
            });

            await this.redis.connect();
            await this.redis.ping();
            
        } catch (error) {
            console.warn('[CACHE] Failed to connect to Redis:', error);
            this.redis = null;
            this.connected = false;
        }
    }

    // ============================================
    // Core Cache Operations
    // ============================================

    async get<T>(key: string): Promise<T | null> {
        if (!this.redis || !this.connected) {
            stats.misses++;
            return null;
        }

        try {
            const data = await this.redis.get(key);
            
            if (data) {
                stats.hits++;
                return JSON.parse(data) as T;
            }
            
            stats.misses++;
            return null;
        } catch (error) {
            stats.errors++;
            console.warn(`[CACHE] Get error for key ${key}:`, error);
            return null;
        }
    }

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
        if (!this.redis || !this.connected) {
            return false;
        }

        try {
            const ttl = ttlSeconds || CACHE_CONFIG.defaultTTL;
            const data = JSON.stringify(value);
            
            await this.redis.setex(key, ttl, data);
            stats.sets++;
            
            return true;
        } catch (error) {
            stats.errors++;
            console.warn(`[CACHE] Set error for key ${key}:`, error);
            return false;
        }
    }

    async delete(key: string): Promise<boolean> {
        if (!this.redis || !this.connected) {
            return false;
        }

        try {
            await this.redis.del(key);
            stats.deletes++;
            return true;
        } catch (error) {
            stats.errors++;
            console.warn(`[CACHE] Delete error for key ${key}:`, error);
            return false;
        }
    }

    async deletePattern(pattern: string): Promise<number> {
        if (!this.redis || !this.connected) {
            return 0;
        }

        try {
            const keys = await this.redis.keys(pattern);
            
            if (keys.length === 0) {
                return 0;
            }

            const deleted = await this.redis.del(...keys);
            stats.deletes += deleted;
            return deleted;
        } catch (error) {
            stats.errors++;
            console.warn(`[CACHE] Delete pattern error for ${pattern}:`, error);
            return 0;
        }
    }

    // ============================================
    // Typed Cache Methods
    // ============================================

    async getUser(userId: string): Promise<Record<string, unknown> | null> {
        const key = `${CACHE_CONFIG.prefixes.user}${userId}`;
        return this.get<Record<string, unknown>>(key);
    }

    async setUser(userId: string, user: Record<string, unknown>): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.user}${userId}`;
        return this.set(key, user, CACHE_CONFIG.ttl.user);
    }

    async invalidateUser(userId: string): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.user}${userId}`;
        return this.delete(key);
    }

    async getProject(projectId: string): Promise<Record<string, unknown> | null> {
        const key = `${CACHE_CONFIG.prefixes.project}${projectId}`;
        return this.get<Record<string, unknown>>(key);
    }

    async setProject(projectId: string, project: Record<string, unknown>): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.project}${projectId}`;
        return this.set(key, project, CACHE_CONFIG.ttl.project);
    }

    async invalidateProject(projectId: string): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.project}${projectId}`;
        return this.delete(key);
    }

    async getTask(taskId: string): Promise<Record<string, unknown> | null> {
        const key = `${CACHE_CONFIG.prefixes.task}${taskId}`;
        return this.get<Record<string, unknown>>(key);
    }

    async setTask(taskId: string, task: Record<string, unknown>): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.task}${taskId}`;
        return this.set(key, task, CACHE_CONFIG.ttl.task);
    }

    async invalidateTask(taskId: string): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.task}${taskId}`;
        return this.delete(key);
    }

    async getEmbeddings(hash: string): Promise<unknown[] | null> {
        const key = `${CACHE_CONFIG.prefixes.embeddings}${hash}`;
        return this.get<unknown[]>(key);
    }

    async setEmbeddings(hash: string, embeddings: unknown[]): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.embeddings}${hash}`;
        return this.set(key, embeddings, CACHE_CONFIG.ttl.embeddings);
    }

    async getPattern(patternId: string): Promise<Record<string, unknown> | null> {
        const key = `${CACHE_CONFIG.prefixes.patterns}${patternId}`;
        return this.get<Record<string, unknown>>(key);
    }

    async setPattern(patternId: string, pattern: Record<string, unknown>): Promise<boolean> {
        const key = `${CACHE_CONFIG.prefixes.patterns}${patternId}`;
        return this.set(key, pattern, CACHE_CONFIG.ttl.patterns);
    }

    // ============================================
    // Cache-Aside Pattern Helper
    // ============================================

    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttlSeconds?: number
    ): Promise<T> {
        // Try cache first
        const cached = await this.get<T>(key);
        
        if (cached !== null) {
            return cached;
        }

        // Fetch from source
        const data = await fetchFn();
        
        // Cache the result
        await this.set(key, data, ttlSeconds);
        
        return data;
    }

    // ============================================
    // Health & Statistics
    // ============================================

    isConnected(): boolean {
        return this.connected;
    }

    getReconnectAttempts(): number {
        return this.reconnectAttempts;
    }

    getStats(): CacheStats & { hitRate: number; reconnectAttempts: number } {
        const total = stats.hits + stats.misses;
        const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
        
        return {
            ...stats,
            hitRate: Math.round(hitRate * 100) / 100,
            reconnectAttempts: this.reconnectAttempts,
        };
    }

    async healthCheck(): Promise<{
        connected: boolean;
        latency?: number;
        error?: string;
    }> {
        if (!this.redis) {
            return {
                connected: false,
                error: 'Redis client not initialized',
            };
        }

        try {
            const start = Date.now();
            await this.redis.ping();
            const latency = Date.now() - start;
            
            this.connected = true;
            return { connected: true, latency };
        } catch (error) {
            this.connected = false;
            return {
                connected: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async flush(): Promise<boolean> {
        if (!this.redis || !this.connected) {
            return false;
        }

        try {
            await this.redis.flushdb();
            console.log('[CACHE] Cache flushed');
            return true;
        } catch (error) {
            console.warn('[CACHE] Flush error:', error);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
            this.redis = null;
            this.connected = false;
            console.log('[CACHE] Disconnected');
        }
    }
}

// ============================================
// Singleton Instance
// ============================================

let cacheInstance: RedisCacheService | null = null;

export function getCacheService(): RedisCacheService {
    if (!cacheInstance) {
        cacheInstance = new RedisCacheService();
    }
    return cacheInstance;
}

export async function closeCacheService(): Promise<void> {
    if (cacheInstance) {
        await cacheInstance.disconnect();
        cacheInstance = null;
    }
}
