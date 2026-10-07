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
import { resolveRacSlot, type RacSlotResolution } from "./racSlot";

/** The RAC consumer contexts a catalog part reads its slot from (`racSlot.ts`). */
const RAC_SLOT_CONTEXTS: Readonly<
  Record<"Text" | "Heading" | "Button" | "Checkbox", Context<unknown>>
> = {
  Text: RAC.TextContext as Context<unknown>,
  Heading: RAC.HeadingContext as Context<unknown>,
  Button: RAC.ButtonContext as Context<unknown>,
  // (A Checkbox is RAC `CheckboxField` — ADR-256 Phase 5f: a collection item's `selection`.)
  Checkbox: RAC.CheckboxFieldContext as Context<unknown>,
};

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
  render: (resolution: RacSlotResolution) => ReactElement;
  slot?: string;
  [key: string]: unknown;
}): ReactElement {
  const element = render(
    resolveRacSlot(
      useContext(RAC_SLOT_CONTEXTS[context]),
      slot ?? authored,
    ),
  );
  return Object.keys(rest).length
    ? cloneElement(element, overScopeProps(element, rest))
    : element;
}

/**
 * The DOM pass decorates the scope as it would the binding's element (`withCatalogStateStyles` ·
 * `withRuntime` read the element's own `style` · handlers to go over them). The scope has none, so
 * what it was given goes over the rendered element's own: a style merges (a RAC style function
 * keeps its values), a handler runs after the element's.
 */
function overScopeProps(
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
