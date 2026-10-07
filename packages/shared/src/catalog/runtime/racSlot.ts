/**
 * ADR-256 Decision 4 — a part's named slot (RAC `slot`) against the context it renders in.
 *
 * Four paths: ① an explicit detach (`slot: false` in the document = RAC `slot={null}`) leaves the
 * parent's context; ② a slot name the provider's `slots` table has passes as is; ③ an unset slot
 * keeps RAC's default slot (`DEFAULT_SLOT`) by passing nothing; ④ a context without a `slots` table
 * takes the slot prop as is (RAC merges it). Only a slotted context without a default slot (unset)
 * or with an unknown name renders the part detached and reports it as not connected — RAC would
 * throw there. The authored value stays in the document, so moving the part under a provider that
 * has the name connects it again.
 *
 * Preview reads the live RAC context (`resolveRacSlot`); Properties predicts it from the provider
 * table generated from the installed RAC's run (`catalogRacSlotProvider`).
 */
import { DEFAULT_SLOT } from "react-aria-components";
import {
  RAC_SLOT_PROVIDERS,
  type RacSlotContextKey,
  type RacSlotProvision,
} from "../generated/racSlotProviders";

export type RacSlotResolution =
  /** No provider of the consumer context above: nothing to connect (the element as is, no slot). */
  | { readonly kind: "none" }
  | { readonly kind: "detached" }
  | { readonly kind: "named"; readonly slot: string }
  | { readonly kind: "default" }
  | { readonly kind: "plain"; readonly slot?: string }
  | { readonly kind: "unconnected"; readonly slot?: string };

/** The authored slot: a name, the explicit detach (`false`), or unset (an empty name is unset). */
function authoredSlot(authored: unknown): string | false | undefined {
  if (authored === false || authored === null) return false;
  return typeof authored === "string" && authored !== "" ? authored : undefined;
}

function resolve(
  slots: { names: readonly string[]; hasDefault: boolean } | undefined,
  authored: unknown,
  provided = true,
): RacSlotResolution {
  const value = authoredSlot(authored);
  if (value === false) return { kind: "detached" };
  if (!provided) return { kind: "none" };
  if (!slots) return value ? { kind: "plain", slot: value } : { kind: "plain" };
  if (value)
    return slots.names.includes(value)
      ? { kind: "named", slot: value }
      : { kind: "unconnected", slot: value };
  return slots.hasDefault ? { kind: "default" } : { kind: "unconnected" };
}

/** Resolve against a live RAC context value (`useContext(TextContext)` …). */
export function resolveRacSlot(
  contextValue: unknown,
  authored: unknown,
): RacSlotResolution {
  if (contextValue === null || contextValue === undefined)
    return resolve(undefined, authored, false);
  const table =
    typeof contextValue === "object"
      ? (contextValue as { slots?: unknown }).slots
      : undefined;
  if (!table || typeof table !== "object") return resolve(undefined, authored);
  return resolve(
    {
      names: Object.keys(table),
      hasDefault: DEFAULT_SLOT in (table as object),
    },
    authored,
  );
}

/** The `slot` prop a RAC part takes for a resolution (`null` = detached). */
export function racSlotProps(resolution: RacSlotResolution): {
  slot?: string | null;
} {
  switch (resolution.kind) {
    case "named":
      return { slot: resolution.slot };
    case "plain":
      return resolution.slot ? { slot: resolution.slot } : {};
    case "default":
    case "none":
      return {};
    default:
      return { slot: null };
  }
}

/** The consumer context a catalog type reads its slot from. */
const CONSUMER_OF_TYPE: Readonly<Record<string, RacSlotContextKey>> = {
  Text: "Text",
  Description: "Text",
  Heading: "Heading",
  Button: "Button",
  DateInput: "DateField",
  Checkbox: "Checkbox",
};

/** Catalog types whose children render where a RAC part (named in the table) provides. */
const PROVIDER_ALIAS: Readonly<Record<string, string>> = {
  DisclosureContent: "DisclosurePanel",
  DisclosureHeader: "Disclosure",
};

export function catalogRacSlotConsumer(
  type: string,
): RacSlotContextKey | undefined {
  return CONSUMER_OF_TYPE[type];
}

export interface CatalogRacSlotProvider {
  /** The RAC part that provides (the catalog type, or the RAC part it stands for). */
  readonly provider: string;
  readonly provision: RacSlotProvision;
}

/**
 * The nearest ancestor that provides the part's consumer context (nearest first). A part that
 * clears the context ends the search (no provider — the slot passes as is).
 */
export function catalogRacSlotProvider(
  type: string,
  ancestorTypes: readonly string[],
): CatalogRacSlotProvider | undefined {
  const key = CONSUMER_OF_TYPE[type];
  if (!key) return undefined;
  for (const ancestor of ancestorTypes) {
    const provider = PROVIDER_ALIAS[ancestor] ?? ancestor;
    const provision = RAC_SLOT_PROVIDERS[provider]?.[key];
    if (!provision) continue;
    return provision.cleared ? undefined : { provider, provision };
  }
  return undefined;
}

/** Predict the resolution Properties shows (the same four paths as the Preview). */
export function predictRacSlot(
  type: string,
  ancestorTypes: readonly string[],
  authored: unknown,
): RacSlotResolution & { readonly provider?: string } {
  const found = catalogRacSlotProvider(type, ancestorTypes);
  const slots = found?.provision.slots
    ? {
        names: found.provision.slots,
        hasDefault: found.provision.hasDefault === true,
      }
    : undefined;
  return {
    ...resolve(slots, authored, found !== undefined),
    ...(found ? { provider: found.provider } : {}),
  };
}
