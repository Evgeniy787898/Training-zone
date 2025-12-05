export const shortenText = (text: string | null | undefined, limit = 120): string => {
    if (!text) {
        return '';
    }

    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= limit) {
        return trimmed;
    }

    const truncated = trimmed.slice(0, Math.max(0, limit - 1)).trim();
    return `${truncated}…`;
};
