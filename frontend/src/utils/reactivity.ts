import { shallowRef, watchEffect, type ShallowRef } from 'vue';

export type StableShallowRef<T> = {
  state: ShallowRef<T>;
  sync: (next: T) => void;
};

export function createStableShallowRef<T>(initialValue: T): StableShallowRef<T> {
  const state = shallowRef(initialValue) as ShallowRef<T>;
  const sync = (next: T) => {
    if (!Object.is(state.value, next)) {
      state.value = next;
    }
  };
  return { state, sync };
}

export function createStableComputed<T>(getter: () => T, equals: (a: T, b: T) => boolean = Object.is): Readonly<ShallowRef<T>> {
  const state = shallowRef(getter()) as ShallowRef<T>;

  watchEffect(() => {
    const next = getter();
    if (!equals(state.value, next)) {
      state.value = next;
    }
  });

  return state;
}

export function shallowArrayEqual<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export function shallowArrayEqualBy<T>(
  a: readonly T[] | undefined,
  b: readonly T[] | undefined,
  equals: (left: T, right: T) => boolean,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!equals(a[i], b[i])) return false;
  }
  return true;
}
