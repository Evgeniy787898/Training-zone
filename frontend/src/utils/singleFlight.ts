export interface SingleFlightRunner<TResult> {
  run(key: string, factory: () => Promise<TResult>): Promise<TResult>;
  clear(key?: string): void;
}

/**
 * Tracks in-flight async operations and deduplicates concurrent calls
 * that use the same cache key. Useful for API requests where we don't
 * want to send multiple identical queries while the first one is still
 * pending. Each key keeps only one promise that is automatically
 * removed once it settles.
 */
export function createSingleFlight<TResult>(): SingleFlightRunner<TResult> {
  const flights = new Map<string, Promise<TResult>>();

  return {
    run(key: string, factory: () => Promise<TResult>) {
      const existing = flights.get(key);
      if (existing) {
        return existing;
      }

      const promise = factory().finally(() => {
        const current = flights.get(key);
        if (current === promise) {
          flights.delete(key);
        }
      });

      flights.set(key, promise);
      return promise;
    },
    clear(targetKey?: string) {
      if (typeof targetKey === 'string') {
        flights.delete(targetKey);
      } else {
        flights.clear();
      }
    },
  };
}
