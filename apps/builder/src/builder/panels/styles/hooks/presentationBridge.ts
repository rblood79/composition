import type { StylesPresentationBridge } from "../stylesHostContext";

/**
 * ADR-248 4e-7: the presentation hooks reach the old editor presentation channel only through the
 * host's bridge. Without one (the catalog Builder) there is no selection to own, no session, and
 * no target — the hooks fall to the host's preview path.
 */
export function presentationSelection(
  bridge: StylesPresentationBridge | undefined,
): {
  selectedElementId: string | null;
} {
  return { selectedElementId: bridge?.readSelectedElementId() ?? null };
}

export function subscribePresentationSelection(
  bridge: StylesPresentationBridge | undefined,
  listener: () => void,
): () => void {
  return bridge ? bridge.subscribeSelection(listener) : () => {};
}

/** The pilot runtime — only reached after a bridge resolved a target. */
export function presentationRuntime(
  bridge: StylesPresentationBridge | undefined,
): StylesPresentationBridge["runtime"] {
  if (!bridge) throw new Error("No editor presentation channel");
  return bridge.runtime;
}
