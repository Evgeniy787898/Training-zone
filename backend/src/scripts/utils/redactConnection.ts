export const redactConnection = (connectionString: string | undefined): string => {
    if (!connectionString) {
        return '[redacted]';
    }
    try {
        const url = new URL(connectionString);
        if (url.username) {
            url.username = '[redacted]';
        }
        if (url.password) {
            url.password = '[redacted]';
        }
        return url.toString();
    } catch {
        return '[redacted]';
    }
};
