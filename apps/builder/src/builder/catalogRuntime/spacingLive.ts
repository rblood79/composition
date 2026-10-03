/**
 * The Canvas spacing drag the Styles panel follows (ADR-222): while a padding / gap handle is
 * dragged, the panel shows the drag's value on the sides being edited and highlights them. The
 * old app published this through the presentation spacing session (`setActiveSpacingSession`);
 * the catalog Canvas publishes the same view here. Session state, not document state — nothing
 * is written until the release commits the step.
 */
import type { SpacingProperty } from "../workspace/canvas/interaction/spacingTypes";

export interface CatalogSpacingLive {
  /** The record being edited (the Styles panel's selected identity). */
  readonly identity: string;
  readonly properties: readonly SpacingProperty[];
  /** The drag's current px value per property. */
  readonly values: Readonly<Partial<Record<SpacingProperty, number>>>;
}

let live: CatalogSpacingLive | null = null;
const listeners = new Set<() => void>();

export function getCatalogSpacingLive(): CatalogSpacingLive | null {
  return live;
}

export function setCatalogSpacingLive(next: CatalogSpacingLive | null): void {
  if (live === next) return;
  live = next;
  for (const listener of [...listeners]) listener();
}

export function subscribeCatalogSpacingLive(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
