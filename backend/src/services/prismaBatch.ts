import { batchOperationDefaults } from '../config/constants.js';

export type BatchHandler<T> = (item: T, index: number) => Promise<void>;

export type BatchOptions = {
    chunkSize?: number;
    signal?: AbortSignal | null;
};

const ensureChunkSize = (value?: number) => {
    if (!value || Number.isNaN(value) || value < 1) {
        return batchOperationDefaults.chunkSize;
    }
    return Math.floor(value);
};

const throwIfAborted = (signal?: AbortSignal | null) => {
    if (signal?.aborted) {
        throw signal.reason ?? new Error('Batch execution aborted');
    }
};

export async function runPrismaBatch<T>(items: readonly T[], handler: BatchHandler<T>, options?: BatchOptions): Promise<void> {
    if (!items.length) {
        return;
    }

    const chunkSize = ensureChunkSize(options?.chunkSize ?? batchOperationDefaults.chunkSize);
    const signal = options?.signal;

    for (let index = 0; index < items.length; index += chunkSize) {
        throwIfAborted(signal);
        const chunk = items.slice(index, index + chunkSize);
        await Promise.all(
            chunk.map((item, chunkIndex) => {
                throwIfAborted(signal);
                return handler(item, index + chunkIndex);
            }),
        );
    }
}
