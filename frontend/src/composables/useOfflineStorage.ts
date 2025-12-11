/**
 * Offline-First Storage (FE-V02)
 * 
 * IndexedDB-based offline storage for workouts:
 * - Local workout storage
 * - Background sync queue
 * - Conflict resolution UI hooks
 */

import { ref, computed, onMounted } from 'vue';

// Database configuration
const DB_NAME = 'training-zone-offline';
const DB_VERSION = 1;
const STORES = {
    workouts: 'workouts',
    syncQueue: 'sync-queue',
} as const;

// Sync queue item
export interface SyncQueueItem {
    id: string;
    type: 'create' | 'update' | 'delete';
    entity: 'workout' | 'exercise' | 'progress';
    data: any;
    timestamp: number;
    retries: number;
    lastError?: string;
}

// Offline workout
export interface OfflineWorkout {
    id: string;
    profileId: string;
    date: string;
    exercises: Array<{
        exerciseKey: string;
        sets: number;
        reps: number;
        weight?: number;
        notes?: string;
    }>;
    duration: number;
    createdAt: number;
    synced: boolean;
    syncedAt?: number;
}

// Database instance
let db: IDBDatabase | null = null;

/**
 * Open IndexedDB database
 */
const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[offline] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('[offline] Database opened');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Workouts store
            if (!database.objectStoreNames.contains(STORES.workouts)) {
                const workoutStore = database.createObjectStore(STORES.workouts, { keyPath: 'id' });
                workoutStore.createIndex('date', 'date', { unique: false });
                workoutStore.createIndex('synced', 'synced', { unique: false });
                workoutStore.createIndex('profileId', 'profileId', { unique: false });
            }

            // Sync queue store
            if (!database.objectStoreNames.contains(STORES.syncQueue)) {
                const syncStore = database.createObjectStore(STORES.syncQueue, { keyPath: 'id' });
                syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                syncStore.createIndex('type', 'type', { unique: false });
            }

            console.log('[offline] Database upgraded');
        };
    });
};

/**
 * Save workout offline
 */
export const saveWorkoutOffline = async (workout: OfflineWorkout): Promise<void> => {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORES.workouts, 'readwrite');
        const store = tx.objectStore(STORES.workouts);

        const request = store.put(workout);

        request.onsuccess = () => {
            console.log('[offline] Workout saved:', workout.id);
            resolve();
        };

        request.onerror = () => {
            console.error('[offline] Failed to save workout:', request.error);
            reject(request.error);
        };
    });
};

/**
 * Get all offline workouts
 */
export const getOfflineWorkouts = async (profileId?: string): Promise<OfflineWorkout[]> => {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORES.workouts, 'readonly');
        const store = tx.objectStore(STORES.workouts);

        const request = profileId
            ? store.index('profileId').getAll(profileId)
            : store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

/**
 * Get unsynced workouts
 */
export const getUnsyncedWorkouts = async (): Promise<OfflineWorkout[]> => {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORES.workouts, 'readonly');
        const store = tx.objectStore(STORES.workouts);
        const index = store.index('synced');

        const request = index.getAll(IDBKeyRange.only(0)); // 0 = false (not synced)

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};

/**
 * Mark workout as synced
 */
export const markWorkoutSynced = async (workoutId: string): Promise<void> => {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORES.workouts, 'readwrite');
        const store = tx.objectStore(STORES.workouts);

        const getRequest = store.get(workoutId);

        getRequest.onsuccess = () => {
            const workout = getRequest.result;
            if (workout) {
                workout.synced = true;
                workout.syncedAt = Date.now();

                const putRequest = store.put(workout);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                resolve();
            }
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
};

/**
 * Add item to sync queue
 */
export const addToSyncQueue = async (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> => {
    const database = await openDatabase();

    const queueItem: SyncQueueItem = {
        ...item,
        id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        retries: 0,
    };

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORES.syncQueue, 'readwrite');
        const store = tx.objectStore(STORES.syncQueue);

        const request = store.add(queueItem);

        request.onsuccess = () => {
            console.log('[offline] Added to sync queue:', queueItem.id);
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
};

/**
 * Get sync queue items
 */
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORES.syncQueue, 'readonly');
        const store = tx.objectStore(STORES.syncQueue);

        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => reject(request.error);
    });
};

/**
 * Remove from sync queue
 */
export const removeFromSyncQueue = async (itemId: string): Promise<void> => {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORES.syncQueue, 'readwrite');
        const store = tx.objectStore(STORES.syncQueue);

        const request = store.delete(itemId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Vue composable for offline storage
 */
export const useOfflineStorage = () => {
    const isOnline = ref(navigator.onLine);
    const syncInProgress = ref(false);
    const pendingSyncCount = ref(0);
    const lastSyncTime = ref<number | null>(null);

    // Update online status
    const updateOnlineStatus = () => {
        isOnline.value = navigator.onLine;
        if (isOnline.value) {
            // Trigger sync when back online
            syncPendingChanges();
        }
    };

    // Sync pending changes
    const syncPendingChanges = async () => {
        if (syncInProgress.value || !isOnline.value) return;

        syncInProgress.value = true;
        console.log('[offline] Starting sync...');

        try {
            const unsynced = await getUnsyncedWorkouts();
            pendingSyncCount.value = unsynced.length;

            for (const workout of unsynced) {
                try {
                    // TODO: Call actual API
                    console.log('[offline] Would sync workout:', workout.id);
                    await markWorkoutSynced(workout.id);
                    pendingSyncCount.value--;
                } catch (error) {
                    console.error('[offline] Failed to sync workout:', workout.id, error);
                }
            }

            lastSyncTime.value = Date.now();
        } catch (error) {
            console.error('[offline] Sync failed:', error);
        } finally {
            syncInProgress.value = false;
        }
    };

    // Setup event listeners
    onMounted(() => {
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Initial sync check
        getSyncQueue().then(items => {
            pendingSyncCount.value = items.length;
        });
    });

    return {
        isOnline,
        syncInProgress,
        pendingSyncCount,
        lastSyncTime,
        hasPendingSync: computed(() => pendingSyncCount.value > 0),
        syncPendingChanges,
        saveWorkoutOffline,
        getOfflineWorkouts,
        getUnsyncedWorkouts,
    };
};

export default {
    useOfflineStorage,
    saveWorkoutOffline,
    getOfflineWorkouts,
    getUnsyncedWorkouts,
    markWorkoutSynced,
    addToSyncQueue,
    getSyncQueue,
    removeFromSyncQueue,
};
