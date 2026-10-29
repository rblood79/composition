/**
 * ADR-291 G3 — the view request serializer (`collections/view/serialize.ts`, ~1.9 KB gz) for the
 * filter section: loaded when a connection shows an API collection's request (the endpoint has a
 * query format), so the Properties panel on the first screen does not carry it.
 */
import { useEffect, useSyncExternalStore } from "react";

type ViewSerializer =
  typeof import("../../../../../../../packages/shared/src/collections/view/serialize");

let loaded: ViewSerializer | undefined;
let loading: Promise<ViewSerializer> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The serializer once loaded; `wanted` starts the load (an API collection's request is shown). */
export function useViewSerializer(wanted: boolean): ViewSerializer | undefined {
  const serializer = useSyncExternalStore(subscribe, () => loaded);
  useEffect(() => {
    if (!wanted || loaded) return;
    loading ??= import(
      "../../../../../../../packages/shared/src/collections/view/serialize"
    ).then((module) => {
      loaded = module;
      for (const listener of [...listeners]) listener();
      return module;
    });
  }, [wanted]);
  return serializer;
}
