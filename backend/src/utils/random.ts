export const randomChoice = <T>(items: readonly T[]): T | null => {
    if (!items || items.length === 0) {
        return null;
    }

    const index = Math.floor(Math.random() * items.length);
    return items[index] ?? null;
};
