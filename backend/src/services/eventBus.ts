/**
 * Event Bus (ARCH-V02)
 * 
 * Real-time event-driven communication:
 * - Pub/Sub pattern for decoupled modules
 * - Type-safe event definitions
 * - WebSocket-ready for frontend subscription
 * - Redis Pub/Sub integration ready
 */

// Event types
export type EventType =
    | 'workout:started'
    | 'workout:completed'
    | 'workout:exercise:done'
    | 'achievement:unlocked'
    | 'streak:updated'
    | 'ai:advice:ready'
    | 'ai:advice:error'
    | 'profile:updated'
    | 'settings:changed'
    | 'notification:new'
    | 'sync:started'
    | 'sync:completed'
    | 'error:global';

// Event payload definitions
export interface EventPayloads {
    'workout:started': { sessionId: string; profileId: string };
    'workout:completed': { sessionId: string; profileId: string; duration: number; exerciseCount: number };
    'workout:exercise:done': { exerciseKey: string; reps: number; sets: number };
    'achievement:unlocked': { achievementId: string; name: string; icon: string };
    'streak:updated': { profileId: string; streakDays: number; isRecord: boolean };
    'ai:advice:ready': { requestId: string; advice: string };
    'ai:advice:error': { requestId: string; error: string };
    'profile:updated': { profileId: string; field: string };
    'settings:changed': { key: string; value: unknown };
    'notification:new': { id: string; title: string; type: 'info' | 'success' | 'warning' | 'error' };
    'sync:started': { target: string };
    'sync:completed': { target: string; success: boolean };
    'error:global': { message: string; code?: string };
}

// Event handler type
export type EventHandler<T extends EventType> = (
    payload: EventPayloads[T],
    meta: EventMeta
) => void | Promise<void>;

// Event metadata
export interface EventMeta {
    timestamp: number;
    source: string;
    eventId: string;
}

// Subscription info
interface Subscription {
    id: string;
    type: EventType;
    handler: EventHandler<any>;
    once: boolean;
}

// Generate unique ID
const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * Event Bus class
 */
class EventBus {
    private subscriptions: Map<EventType, Subscription[]> = new Map();
    private history: Array<{ type: EventType; payload: any; meta: EventMeta }> = [];
    private maxHistory = 100;
    private source: string;

    constructor(source: string = 'app') {
        this.source = source;
    }

    /**
     * Subscribe to an event type
     */
    on<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
        const subscription: Subscription = {
            id: generateId(),
            type,
            handler,
            once: false,
        };

        const subs = this.subscriptions.get(type) || [];
        subs.push(subscription);
        this.subscriptions.set(type, subs);

        console.debug(`[event-bus] Subscribed to ${type} (id: ${subscription.id})`);

        // Return unsubscribe function
        return () => this.off(type, subscription.id);
    }

    /**
     * Subscribe to an event once
     */
    once<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
        const subscription: Subscription = {
            id: generateId(),
            type,
            handler,
            once: true,
        };

        const subs = this.subscriptions.get(type) || [];
        subs.push(subscription);
        this.subscriptions.set(type, subs);

        return () => this.off(type, subscription.id);
    }

    /**
     * Unsubscribe from an event
     */
    off(type: EventType, subscriptionId: string): boolean {
        const subs = this.subscriptions.get(type);
        if (!subs) return false;

        const index = subs.findIndex(s => s.id === subscriptionId);
        if (index === -1) return false;

        subs.splice(index, 1);
        console.debug(`[event-bus] Unsubscribed from ${type} (id: ${subscriptionId})`);
        return true;
    }

    /**
     * Emit an event
     */
    emit<T extends EventType>(type: T, payload: EventPayloads[T]): void {
        const meta: EventMeta = {
            timestamp: Date.now(),
            source: this.source,
            eventId: generateId(),
        };

        // Add to history
        this.history.push({ type, payload, meta });
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        console.debug(`[event-bus] Emitting ${type}`, { payload, meta });

        // Get subscribers
        const subs = this.subscriptions.get(type) || [];
        const toRemove: string[] = [];

        // Call handlers
        for (const sub of subs) {
            try {
                sub.handler(payload, meta);
                if (sub.once) {
                    toRemove.push(sub.id);
                }
            } catch (error) {
                console.error(`[event-bus] Handler error for ${type}:`, error);
            }
        }

        // Remove once handlers
        for (const id of toRemove) {
            this.off(type, id);
        }
    }

    /**
     * Get event history
     */
    getHistory(type?: EventType): Array<{ type: EventType; payload: any; meta: EventMeta }> {
        if (type) {
            return this.history.filter(e => e.type === type);
        }
        return [...this.history];
    }

    /**
     * Clear all subscriptions
     */
    clear(): void {
        this.subscriptions.clear();
        console.debug('[event-bus] Cleared all subscriptions');
    }

    /**
     * Get subscription count
     */
    getSubscriptionCount(type?: EventType): number {
        if (type) {
            return this.subscriptions.get(type)?.length || 0;
        }
        let count = 0;
        for (const subs of this.subscriptions.values()) {
            count += subs.length;
        }
        return count;
    }
}

// Global event bus instance
export const eventBus = new EventBus('app');

// Helper hooks for common events
export const emitWorkoutStarted = (sessionId: string, profileId: string) =>
    eventBus.emit('workout:started', { sessionId, profileId });

export const emitWorkoutCompleted = (
    sessionId: string,
    profileId: string,
    duration: number,
    exerciseCount: number
) => eventBus.emit('workout:completed', { sessionId, profileId, duration, exerciseCount });

export const emitAchievementUnlocked = (achievementId: string, name: string, icon: string) =>
    eventBus.emit('achievement:unlocked', { achievementId, name, icon });

export const emitStreakUpdated = (profileId: string, streakDays: number, isRecord: boolean) =>
    eventBus.emit('streak:updated', { profileId, streakDays, isRecord });

export const emitNotification = (
    id: string,
    title: string,
    type: 'info' | 'success' | 'warning' | 'error'
) => eventBus.emit('notification:new', { id, title, type });

export default eventBus;
