/**
 * ADR-256 Decision 4 — the DOM side of a part's named slot: the RAC consumer context it reads
 * (`racSlot.ts` resolves the authored name against it) and the scope that renders the part with
 * the resolved `slot`.
 */
import {
  cloneElement,
  useContext,
  type Context,
  type CSSProperties,
  type ReactElement,
} from "react";
import * as RAC from "react-aria-components";
import { ActionBarContext } from "../../components/ActionBarContext";
import { resolveRacSlot, type RacSlotResolution } from "./racSlot";

import {
  CATALOG_NATIVE_SLOT_CONTEXT_NAMES,
  type CatalogSlotContextKey,
} from "../racSlotContract";
import { CATALOG_COMPONENT_SLOT_CONTEXTS } from "../../components/catalogSlotContexts";

/** Native contexts and the catalog controllers that implement S2-only elements. */
export const RAC_SLOT_CONTEXTS: Readonly<
  Record<CatalogSlotContextKey, Context<unknown>>
> = {
  ...Object.fromEntries(
    Object.entries(CATALOG_NATIVE_SLOT_CONTEXT_NAMES).map(([key, name]) => [
      key,
      (RAC as unknown as Record<string, Context<unknown>>)[name],
    ]),
  ),
  ...CATALOG_COMPONENT_SLOT_CONTEXTS,
  ActionBar: ActionBarContext,
} as Readonly<Record<CatalogSlotContextKey, Context<unknown>>>;

/**
 * ADR-256 Decision 4 — resolves a part's authored RAC slot against the live context it renders in
 * (`racSlot.ts`), then renders. Props the DOM pass adds to the binding's element (`slot` — a
 * collection item role · `id` — the HTML id) reach the rendered element.
 */
export function RacSlotScope({
  context,
  authored,
  render,
  slot,
  ...rest
}: {
  context: keyof typeof RAC_SLOT_CONTEXTS;
  authored: unknown;
  render: (
    resolution: RacSlotResolution,
    inherited?: Record<string, unknown> | null,
  ) => ReactElement | null;
  slot?: string;
  [key: string]: unknown;
}): ReactElement | null {
  const value = useContext(RAC_SLOT_CONTEXTS[context]);
  const resolution = resolveRacSlot(value, slot ?? authored);
  const nativeSlot =
    resolution.kind === "named" || resolution.kind === "plain"
      ? resolution.slot
      : resolution.kind === "default" || resolution.kind === "none"
        ? undefined
        : null;
  const inherited = RAC.useSlottedContext(
    RAC_SLOT_CONTEXTS[context] as Context<
      RAC.ContextValue<Record<string, unknown>, HTMLElement>
    >,
    nativeSlot,
  );
  const element = render(resolution, inherited);
  return element && Object.keys(rest).length
    ? cloneElement(element, overScopeProps(element, rest))
    : element;
}

/**
 * The DOM pass decorates the scope as it would the binding's element (`withCatalogStateStyles` ·
 * `withRuntime` read the element's own `style` · handlers to go over them). The scope has none, so
 * what it was given goes over the rendered element's own: a style merges (a RAC style function
 * keeps its values), a handler runs after the element's.
 */
export function overScopeProps(
  element: ReactElement,
  given: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const own = element.props as Record<string, unknown>;
  const out: Record<string, unknown> = { ...given };
  for (const [key, value] of Object.entries(given)) {
    const mine = own[key];
    if (key === "style" && mine && value && typeof value === "object") {
      const extra = value as CSSProperties;
      out.style =
        typeof mine === "function"
          ? (values: never) => ({
              ...(mine as (values: never) => CSSProperties)(values),
              ...extra,
            })
          : { ...(mine as CSSProperties), ...extra };
    } else if (typeof mine === "function" && typeof value === "function")
      out[key] = (...args: unknown[]) => {
        (mine as (...a: unknown[]) => void)(...args);
        (value as (...a: unknown[]) => void)(...args);
      };
  }
  return out;
}
