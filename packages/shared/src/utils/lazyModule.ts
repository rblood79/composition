export interface LazyModule<T> {
  readonly getSnapshot: () => T | undefined;
  readonly load: () => Promise<T>;
  /** Notify once on load, or immediately if already loaded. Returns a cancellation function. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** A demand-loaded module shared by React and non-React consumers. */
export function createLazyModule<T extends object>(
  importer: () => Promise<T>,
): LazyModule<T> {
  let loaded: T | undefined;
  let loading: Promise<T> | undefined;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => loaded,
    load: () => {
      // Keep the same promise, including a rejected import, until the page is reloaded.
      loading ??= importer().then((module) => {
        loaded = module;
        const pending = [...listeners];
        listeners.clear();
        for (const listener of pending) listener();
        return module;
      });
      return loading;
    },
    subscribe: (listener) => {
      if (loaded !== undefined) listener();
      else listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
