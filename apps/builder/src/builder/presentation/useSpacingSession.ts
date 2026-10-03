/**
 * ADR-222 — the Canvas spacing drag the Styles panel follows (padding sides · gap).
 *
 * The panel overlays the drag's value on the active target's spacing fields and highlights them;
 * the shown value is never the stored one (dirty / reset read the document as before). No drag =
 * null — the panel reads the document. The ADR-248 Canvas publishes the drag through
 * `catalogRuntime/spacingLive` (the old presentation spacing session is gone with the old Canvas).
 */

import { useSyncExternalStore } from "react";
import {
  getCatalogSpacingLive,
  subscribeCatalogSpacingLive,
} from "../catalogRuntime/spacingLive";
import type { SpacingProperty } from "../workspace/canvas/interaction/spacingTypes";

export interface SpacingSessionView {
  /** The record being edited (the panel's selected identity). */
  readonly nodeId: string;
  /** The properties the drag edits (the panel highlights these). */
  readonly properties: readonly SpacingProperty[];
  /** The drag's current px value per property. */
  readonly values: Readonly<Partial<Record<SpacingProperty, number>>>;
}

let cachedView: SpacingSessionView | null = null;
let cachedLive: ReturnType<typeof getCatalogSpacingLive> = null;

function readView(): SpacingSessionView | null {
  const live = getCatalogSpacingLive();
  if (!live) {
    cachedView = null;
    cachedLive = null;
    return null;
  }
  if (cachedView && cachedLive === live) return cachedView;
  cachedLive = live;
  cachedView = {
    nodeId: live.identity,
    properties: live.properties,
    values: live.values,
  };
  return cachedView;
}

/** The active spacing drag's view — null when none. `getSnapshot` is reference-stable per drag state. */
export function useSpacingSession(): SpacingSessionView | null {
  return useSyncExternalStore(
    subscribeCatalogSpacingLive,
    readView,
    () => null,
  );
}

/** The drag's px value for this node's property while the drag owns it, else null. */
export function readSessionSpacingValue(
  view: SpacingSessionView | null,
  nodeId: string | null,
  property: SpacingProperty,
): number | null {
  if (!view || !nodeId || view.nodeId !== nodeId) return null;
  if (!view.properties.includes(property)) return null;
  return view.values[property] ?? null;
}
