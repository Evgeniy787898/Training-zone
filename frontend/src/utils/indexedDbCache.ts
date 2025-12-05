/**
 * IndexedDB cache для больших данных (изображения, бинарные данные)
 * Используется для хранения данных которые не помещаются в localStorage
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  staleTime?: number;
}

class IndexedDBCache {
  private dbName = 'tzona_cache';
  private dbVersion = 1;
  private storeName = 'cache';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Инициализация IndexedDB
   */
  private async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        console.warn('IndexedDB not supported, falling back to memory cache');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Сохранение данных в IndexedDB
   */
  async set<T>(key: string, data: T, ttl: number, staleTime?: number): Promise<void> {
    await this.init();
    
    if (!this.db) {
      console.warn('IndexedDB not available, skipping cache set');
      return;
    }

    const entry: CacheEntry<T> & { key: string } = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      staleTime,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получение данных из IndexedDB
   */
  async get<T>(key: string, allowStale = true): Promise<T | null> {
    await this.init();
    
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as (CacheEntry<T> & { key: string }) | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        const age = Date.now() - entry.timestamp;
        
        // Проверка свежести данных
        if (age < entry.ttl) {
          resolve(entry.data);
          return;
        }

        // Проверка stale данных
        if (allowStale) {
          const staleTime = entry.staleTime || entry.ttl * 2;
          if (age < staleTime) {
            resolve(entry.data);
            return;
          }
        }

        // Данные слишком старые, удаляем
        this.delete(key).catch(() => {});
        resolve(null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Удаление данных из IndexedDB
   */
  async delete(key: string): Promise<void> {
    await this.init();
    
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Очистка устаревших записей
   */
  async cleanup(): Promise<void> {
    await this.init();
    
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor();
      const now = Date.now();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        
        if (cursor) {
          const entry = cursor.value as CacheEntry<any> & { key: string };
          const staleTime = entry.staleTime || entry.ttl * 2;
          
          if (now - entry.timestamp >= staleTime) {
            cursor.delete();
          }
          
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Очистка всего кеша
   */
  async clear(): Promise<void> {
    await this.init();
    
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDbCache = new IndexedDBCache();

// Автоматическая очистка каждые 10 минут
if (typeof window !== 'undefined') {
  setInterval(() => {
    indexedDbCache.cleanup().catch(() => {});
  }, 10 * 60 * 1000);
}
