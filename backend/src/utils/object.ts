export const isPlainObject = <T extends Record<string, unknown> = Record<string, unknown>>(
    value: unknown,
): value is T => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    if (Array.isArray(value) || value instanceof Date || Buffer.isBuffer(value)) {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};
