export const clampNumber = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) {
        return min;
    }
    if (min > max) {
        [min, max] = [max, min];
    }
    return Math.min(Math.max(value, min), max);
};
