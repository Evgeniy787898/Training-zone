import type { Response } from 'express';

export type SseEventPayload = Record<string, unknown> | string | number | boolean | null;

export interface SseStreamOptions {
    keepAliveMs?: number;
}

export class SseStream {
    private closed = false;
    private keepAlive?: NodeJS.Timeout;

    constructor(private readonly res: Response, options?: SseStreamOptions) {
        const keepAliveMs = Math.max(1000, options?.keepAliveMs ?? 15000);
        this.keepAlive = setInterval(() => {
            if (this.closed) {
                this.stopKeepAlive();
                return;
            }
            this.res.write(':heartbeat\n\n');
        }, keepAliveMs);
        this.keepAlive.unref();
    }

    public send(event: string, data: SseEventPayload): void {
        if (this.closed) {
            return;
        }
        const payload = typeof data === 'string' ? data : JSON.stringify(data ?? {});
        const lines = payload.split(/\r?\n/);
        const eventLine = event ? `event: ${event}\n` : '';
        const dataLines = lines.map((line) => `data: ${line}`).join('\n');
        this.res.write(`${eventLine}${dataLines}\n\n`);
    }

    public close(details?: SseEventPayload): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.stopKeepAlive();
        if (details) {
            this.send('close', details);
        }
        this.res.end();
    }

    public isClosed(): boolean {
        return this.closed;
    }

    private stopKeepAlive(): void {
        if (this.keepAlive) {
            clearInterval(this.keepAlive);
            this.keepAlive = undefined;
        }
    }
}

export const createSseStream = (res: Response, options?: SseStreamOptions): SseStream => {
    if (!res.headersSent) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
    }
    if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
    }
    return new SseStream(res, options);
};
