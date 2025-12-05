import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import type { TraceContext, TraceInit } from '../types/trace.js';

const storage = new AsyncLocalStorage<TraceContext>();

export const createTraceId = (): string => crypto.randomUUID();

export const ensureTraceId = (candidate?: string | null): string => {
    if (candidate && candidate.trim()) {
        return candidate.trim();
    }
    return createTraceId();
};

const normalizeContext = (init?: TraceInit): TraceContext => ({
    traceId: ensureTraceId(init?.traceId),
    resource: init?.resource,
});

export const runWithTrace = <T>(init: TraceInit | string | null | undefined, handler: () => T): T => {
    const context = typeof init === 'string' ? { traceId: init } : init ?? {};
    const normalized = normalizeContext(context);
    return storage.run(normalized, handler);
};

export const getTraceContext = (): TraceContext | null => storage.getStore() ?? null;

export const getTraceId = (): string | null => storage.getStore()?.traceId ?? null;

export const setTraceContext = (updates: TraceInit): void => {
    const current = storage.getStore();
    if (!current) {
        storage.enterWith(normalizeContext(updates));
        return;
    }
    storage.enterWith({
        traceId: ensureTraceId(updates.traceId ?? current.traceId),
        resource: updates.resource ?? current.resource,
    });
};

export const bindTrace = <T extends (...args: any[]) => any>(fn: T): T => {
    const current = storage.getStore();
    if (!current) {
        return fn;
    }
    return ((...args: any[]) => storage.run(current, () => fn(...args))) as T;
};
