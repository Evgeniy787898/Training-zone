/**
 * Evolution Cache Service
 * Centralized 3-tier caching for 360 scan frames:
 * 1. Memory cache (instant) - persists during session
 * 2. IndexedDB cache (fast) - persists across sessions
 * 3. Network (slow) - fallback
 */

const DB_NAME = 'evolution-cache';
const STORE_NAME = 'frames';
const DB_VERSION = 1;

// In-memory cache (session-level)
const memoryCache = new Map<string, string>();

let dbInstance: IDBDatabase | null = null;

/**
 * Open IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    });
}

export interface CacheStats {
    memory: number;
    indexedDB: number;
    network: number;
}

export const evolutionCacheService = {
    /**
     * Get blob URL from cache (memory first, then IndexedDB)
     */
    async get(key: string): Promise<string | null> {
        // 1. Memory cache (instant)
        if (memoryCache.has(key)) {
            return memoryCache.get(key)!;
        }

        // 2. IndexedDB cache
        try {
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onsuccess = () => {
                    const result = request.result;
                    if (result?.blob) {
                        const url = URL.createObjectURL(result.blob);
                        memoryCache.set(key, url); // Promote to memory cache
                        resolve(url);
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = () => resolve(null);
            });
        } catch {
            return null;
        }
    },

    /**
     * Store blob in both memory cache and IndexedDB
     */
    async set(key: string, blob: Blob): Promise<string> {
        const url = URL.createObjectURL(blob);
        memoryCache.set(key, url);

        // Async store in IndexedDB (don't wait)
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ key, blob, timestamp: Date.now() });
        } catch (e) {
            console.warn('[EvolutionCache] IndexedDB write failed:', e);
        }

        return url;
    },

    /**
     * Store URL directly in memory cache (for already-created blob URLs)
     */
    setMemory(key: string, url: string): void {
        memoryCache.set(key, url);
    },

    /**
     * Check if key exists in memory cache
     */
    hasMemory(key: string): boolean {
        return memoryCache.has(key);
    },

    /**
     * Clear cache for a specific scan type
     */
    async clearByScanType(scanType: string): Promise<void> {
        // Clear memory cache
        for (const key of memoryCache.keys()) {
            if (key.startsWith(scanType + ':')) {
                memoryCache.delete(key);
            }
        }

        // Clear IndexedDB cache
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    if (cursor.key.toString().startsWith(scanType + ':')) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        } catch (e) {
            console.warn('[EvolutionCache] Clear failed:', e);
        }
    },

    /**
     * Clear all evolution caches
     */
    async clearAll(): Promise<void> {
        memoryCache.clear();

        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
        } catch (e) {
            console.warn('[EvolutionCache] Clear all failed:', e);
        }
    },

    /**
     * Get cache statistics
     */
    getStats(): { memorySize: number } {
        return {
            memorySize: memoryCache.size
        };
    },

    /**
     * Revoke all blob URLs (call on unmount)
     */
    revokeAll(): void {
        for (const url of memoryCache.values()) {
            URL.revokeObjectURL(url);
        }
        memoryCache.clear();
    }
};

export default evolutionCacheService;
