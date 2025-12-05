import { isPlainObject } from './object.js';

const pruneValue = (value: unknown): unknown => {
    if (value === null || value === undefined) {
        return undefined;
    }

    if (Array.isArray(value)) {
        let mutated = false;
        const next = value.map((item, index) => {
            const sanitized = pruneValue(item);

            if (sanitized !== item) {
                mutated = true;
            }

            // Arrays keep their length to avoid re-indexing client data.
            return sanitized ?? null;
        });

        return mutated ? next : value;
    }

    if (isPlainObject(value)) {
        let mutated = false;
        const result: Record<string, unknown> = {};

        for (const [key, raw] of Object.entries(value)) {
            if (raw === null || raw === undefined) {
                mutated = true;
                continue;
            }

            const sanitized = pruneValue(raw);

            if (sanitized !== raw) {
                mutated = true;
            }

            if (sanitized !== undefined) {
                result[key] = sanitized;
            }
        }

        if (!mutated) {
            return value;
        }

        return result;
    }

    return value;
};

export const removeNullFields = <T>(value: T): T => {
    const sanitized = pruneValue(value);
    return sanitized === undefined ? (undefined as T) : (sanitized as T);
};
