export const toInteger = (value: unknown): number | null => {
    if (value === null || value === undefined) {
        return null;
    }

    const num = Number(value);
    if (!Number.isFinite(num)) {
        return null;
    }

    return Math.round(num);
};
