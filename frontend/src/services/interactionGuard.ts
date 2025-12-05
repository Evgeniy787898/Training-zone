type InteractionState = {
  lockedUntil: number;
  inFlight: boolean;
};

interface InteractionGuardOptions {
  cooldownMs?: number;
}

export const createInteractionGuard = (options: InteractionGuardOptions = {}) => {
  const cooldownMs = Number.isFinite(options.cooldownMs) ? Math.max(0, options.cooldownMs ?? 0) : 0;
  const states = new Map<string, InteractionState>();

  const run = async <T>(key: string, action: () => Promise<T> | T): Promise<T | null> => {
    const now = Date.now();
    const current = states.get(key);
    if (current?.inFlight || (current && current.lockedUntil > now)) {
      return null;
    }

    states.set(key, { inFlight: true, lockedUntil: now + cooldownMs });

    try {
      return await action();
    } finally {
      const next = states.get(key);
      if (next) {
        states.set(key, { inFlight: false, lockedUntil: next.lockedUntil });
      }
    }
  };

  return { run };
};
