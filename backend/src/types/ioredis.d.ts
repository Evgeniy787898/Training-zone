declare module 'ioredis' {
  export default class Redis {
    constructor(connection: string, options?: Record<string, unknown>);
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
    del(key: string): Promise<number>;
    quit(): Promise<void>;
  }
}
