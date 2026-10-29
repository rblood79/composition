import { useEffect, useSyncExternalStore } from "react";
import type { LazyModule } from "../utils/lazyModule";

/** Subscribe without loading; only a committed consumer that wants the module starts it. */
export function useLazyModule<T>(
  module: LazyModule<T>,
  wanted = true,
): T | undefined {
  const loaded = useSyncExternalStore(
    module.subscribe,
    module.getSnapshot,
    module.getSnapshot,
  );
  useEffect(() => {
    if (wanted) void module.load();
  }, [module, wanted]);
  return loaded;
}
