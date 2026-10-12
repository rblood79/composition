import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
} from "react";

import type { CatalogStateKey } from "../document/types";
import {
  CatalogShowWhenGate,
  CatalogStateFrame,
  CatalogValueGate,
} from "./stateFrames.components";

/**
 * ADR-256 Decision 7 (Phase 4) — the DOM side of `showWhen`. A RAC part that gives state keys passes
 * its render props (the values its `children` function receives) down as a frame; a conditioned
 * node reads its owner's frame. An owner with no frame here (its state is a document prop — a
 * Group's `isInvalid`, a Disclosure's runtime expansion) is read from its record, as the Canvas
 * reads it.
 */
interface StateFrame {
  readonly ownerId: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly parent: StateFrame | null;
}

export const CatalogStateFrameContext = createContext<StateFrame | null>(null);

/** A RAC `children` function that passes the part's render props down as its frame. */
export function catalogStateChildren(
  ownerId: string,
  children: () => ReactNode[],
): (values: Readonly<Record<string, unknown>>) => ReactElement {
  return (values) =>
    createElement(CatalogStateFrame, { ownerId, values }, ...children());
}

/** One resolved condition of a node: its owner (absent = not linked), key, negation, record value. */
export interface CatalogDomStateCondition {
  readonly ownerId: string | undefined;
  readonly key: CatalogStateKey;
  readonly not: boolean;
  /** The owner's value from its record (an owner that passes no frame). */
  readonly recordValue: boolean;
}

export function catalogShowWhenGate(
  key: string,
  conditions: readonly CatalogDomStateCondition[],
  element: ReactElement,
): ReactElement {
  return createElement(CatalogShowWhenGate, {
    key,
    conditions,
    children: element,
  });
}

export function catalogValueGate(
  key: string,
  owners: Readonly<Record<string, string | undefined>>,
  render: (
    read: (key: string) => { found: boolean; value: unknown },
  ) => ReactElement | null,
): ReactElement {
  return createElement(CatalogValueGate, { key, owners, render });
}

/** A part whose state is not a RAC `children` function's (a controlled value): its frame around it. */
export function catalogStateFrame(
  key: string,
  ownerId: string,
  values: Readonly<Record<string, unknown>>,
  element: ReactElement,
): ReactElement {
  return createElement(CatalogStateFrame, { key, ownerId, values }, element);
}
