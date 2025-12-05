import type { FieldSelectionOptions, FieldSelectionResult } from '../types/fields.js';
import { isPlainObject } from '../utils/object.js';

export const resolveFieldSelection = <T extends string>({
    requested,
    allowed,
    defaults,
}: FieldSelectionOptions<T>): FieldSelectionResult<T> => {
    const allowedSet = new Set(allowed);
    const requestedFields = requested?.filter((field): field is T => allowedSet.has(field as T));
    const fields = requestedFields && requestedFields.length > 0
        ? requestedFields
        : defaults && defaults.length > 0
            ? defaults
            : allowed;

    return {
        fields,
        requested: requestedFields && requestedFields.length > 0 ? requestedFields : undefined,
    };
};

export const filterRecordFields = <T extends Record<string, unknown>>(record: T, selection: FieldSelectionResult<string>) => {
    if (!record || !isPlainObject(record)) {
        return record;
    }

    const filtered: Record<string, unknown> = {};
    for (const field of selection.fields) {
        if (field in record) {
            filtered[field] = record[field];
        }
    }
    return filtered as Partial<T>;
};

export const filterCollectionFields = <T extends Record<string, unknown>>(
    collection: readonly T[],
    selection: FieldSelectionResult<string>,
): Partial<T>[] => {
    if (!Array.isArray(collection)) {
        return [];
    }
    return collection.map((item) => filterRecordFields(item, selection));
};
