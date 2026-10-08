import {
  createContext,
  createElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { CatalogStateKey } from "../document/types";

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
const CatalogStateFrameContext = createContext<StateFrame | null>(null);

function CatalogStateFrame({
  ownerId,
  values,
  children,
}: {
  ownerId: string;
  values: Readonly<Record<string, unknown>>;
  children?: ReactNode;
}): ReactElement {
  const parent = useContext(CatalogStateFrameContext);
  return createElement(
    CatalogStateFrameContext.Provider,
    { value: { ownerId, values, parent } },
    children,
  );
}

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

/** A conditioned node: drawn while every condition holds (RAC's state where the owner gives it). */
function CatalogShowWhenGate({
  conditions,
  children,
}: {
  conditions: readonly CatalogDomStateCondition[];
  children: ReactElement;
}): ReactElement | null {
  const frames = useContext(CatalogStateFrameContext);
  const holds = conditions.every((condition) => {
    if (!condition.ownerId) return false;
    let frame = frames;
    while (frame && frame.ownerId !== condition.ownerId) frame = frame.parent;
    const value = frame
      ? frame.values[condition.key] === true
      : condition.recordValue;
    return value !== condition.not;
  });
  return holds ? children : null;
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

/**
 * ADR-256 Decision 12 — a node bound to its owners' render props values (`{valueText}` ·
 * `{percentage}%`): drawn by `render` with each key's value from its owner's frame — `found: false`
 * where the owner passes none (the record's value stands).
 */
function CatalogValueGate({
  owners,
  render,
}: {
  owners: Readonly<Record<string, string | undefined>>;
  render: (
    read: (key: string) => { found: boolean; value: unknown },
  ) => ReactElement | null;
}): ReactElement | null {
  const frames = useContext(CatalogStateFrameContext);
  return render((key) => {
    const ownerId = owners[key];
    let frame = ownerId ? frames : null;
    while (frame && frame.ownerId !== ownerId) frame = frame.parent;
    return frame
      ? { found: true, value: frame.values[key] }
      : { found: false, value: undefined };
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
