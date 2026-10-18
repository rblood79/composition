import {
  createElement,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  catalogForwardHandlers,
  CatalogDomStateCondition,
  CatalogStateFrameContext,
} from "./stateFrames.runtime";

export function CatalogStateFrame({
  ownerId,
  values,
  children,
  ...handlers
}: {
  ownerId: string;
  values: Readonly<Record<string, unknown>>;
  children?: ReactNode;
} & Record<string, unknown>): ReactElement {
  const parent = useContext(CatalogStateFrameContext);
  return createElement(
    CatalogStateFrameContext.Provider,
    { value: { ownerId, values, parent } },
    // (The handlers the binding's top element got go to the RAC element it frames.)
    isValidElement(children)
      ? catalogForwardHandlers(children, handlers)
      : children,
  );
}

/** A conditioned node: drawn while every condition holds (RAC's state where the owner gives it). */
export function CatalogShowWhenGate({
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

/**
 * ADR-256 Decision 12 — a node bound to its owners' render props values (`{valueText}` ·
 * `{percentage}%`): drawn by `render` with each key's value from its owner's frame — `found: false`
 * where the owner passes none (the record's value stands).
 */
export function CatalogValueGate({
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
