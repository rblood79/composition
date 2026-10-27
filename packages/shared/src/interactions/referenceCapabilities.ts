/**
 * @fileoverview ADR-287 Decision 1 · 2 — the Do of every prop the reference API table gives a
 * component, derived from the catalog binding's `accepts` (the D2 source: S2 → design-data → v3 →
 * composition extension, kept equal to the installed types by `d2S2Alignment.static.test.ts`).
 * Nothing here is written by hand per component: a prop's kind decides its Do. The reference tables
 * are the gate's oracle (`__tests__/referenceCapabilities.static.test.ts`), not an input.
 *
 * - `number` · `string` · `icon` → 「<prop> 정하기」 (`!param` — a number · text · icon input)
 * - `boolean` → on · off · toggle (`true` · `false` · `!self`)
 * - `enum` · `variant` · `size` · `fillStyle` → 「<prop> 정하기」 with a `choice` input — the choices
 *   are the catalog's own (`deriveOptions` — `accepts.options`, or the rule's variants · sizes), read
 *   where the panel shows them; nothing is copied here.
 *
 * A concept's prop (ADR-280 — `value` of a TextField, `isSelected` of a Checkbox) is the concept's:
 * not derived again. The registry merges concept ⊕ derived ⊕ the common three.
 */
import { componentCatalog } from "../catalog/componentCatalog";
import type { InspectorFieldKind, PropContract } from "../catalog/types";
import { COLLECTION_ITEM_OWNERS } from "../catalog/document/collectionItems";
import type { CapabilityDef, CapabilityParam } from "./capabilityRegistry";

/**
 * Props that are not a Do, by name (ADR-287 Decision 2 · breakdown §1a): events (the When axis),
 * identity · DOM plumbing, and mount-only props (RAC reads `default*` · `autoFocus` once — a later
 * write changes nothing).
 */
export const EXCLUDED_PROP_PATTERNS: readonly RegExp[] = [
  /^on[A-Z]/,
  /^aria-/,
  /^data-/,
  /^UNSAFE_/,
  /^default[A-Z]/,
  /^(id|slot|name|className|style|styles|autoFocus|dataBinding|loadingState)$/,
];

/** The kinds a Do can write, and the input each asks for (the rest — data · objects — are not). */
const PARAM_KIND: Partial<
  Record<InspectorFieldKind, CapabilityParam["kind"] | "boolean">
> = {
  number: "number",
  string: "text",
  icon: "icon",
  boolean: "boolean",
  enum: "choice",
  variant: "choice",
  size: "choice",
  fillStyle: "choice",
};

/**
 * `isSelected` of a collection item is its owner's selection (ADR-280 — the owner's controlled
 * `selectedKeys`): the item does not write it. A standalone Card's own `isSelected` stays.
 */
const OWNER_STATE_PROPS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.keys(COLLECTION_ITEM_OWNERS)
      .filter((type) => type !== "Card")
      .map((type) => [type, ["isSelected"]]),
  );

/**
 * ADR-287 user decision 1 (2026-10-28) — a node's own disabled · read-only state. Its Do manages that
 * state, so the node's own value does not refuse it (a release must pass); an ancestor's does (a
 * frame's `disableAll` wins — release it there). Input Do keep `"isDisabled"` (own and inherited).
 */
const OWN_STATE_GUARDS: Readonly<Record<string, readonly string[]>> = {
  isDisabled: ["inherited:isDisabled"],
  isReadOnly: ["inherited:isReadOnly"],
};

/**
 * ADR-276 — a Button's · ToggleButton's text is its `label` (bound to the template's Text part), not
 * a `children` string: the reference's `children` Do writes `label` (R1 forwards it to the Text).
 * Writing `children` there renders the string next to the template's parts.
 */
const STORED_AS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Button: { children: "label" },
  ToggleButton: { children: "label" },
};

const capital = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** The panel's label key for a derived Do — a dictionary name where one exists (`setValue`). */
function labelKeyOf(id: string, generic: string): string {
  return id === "setValue" ? "capabilities.setValue" : generic;
}

export function isExcludedProp(prop: string): boolean {
  return EXCLUDED_PROP_PATTERNS.some((pattern) => pattern.test(prop));
}

/** One accepted prop's Do (none for an excluded prop or a kind a Do does not write). */
export function capabilitiesOfProp(
  type: string,
  prop: string,
  contract: PropContract,
): Record<string, CapabilityDef> {
  if (contract.editorHidden || isExcludedProp(prop)) return {};
  if (OWNER_STATE_PROPS[type]?.includes(prop)) return {};
  const kind = PARAM_KIND[contract.kind];
  if (!kind) return {};
  const racRef = `catalog binding ${type}.accepts.${prop} (${contract.kind}) — ADR-287 reference API`;
  const guards = OWN_STATE_GUARDS[prop];
  const stored = STORED_AS[type]?.[prop];
  const common = {
    prop: stored ?? prop,
    racRef,
    ...(stored ? { referenceProp: prop } : {}),
    ...(guards ? { guards } : {}),
  };
  if (kind === "boolean")
    return {
      [`${prop}On`]: {
        ...common,
        labelKey: "capabilities.propOn",
        value: true,
      },
      [`${prop}Off`]: {
        ...common,
        labelKey: "capabilities.propOff",
        value: false,
      },
      [`toggle${capital(prop)}`]: {
        ...common,
        labelKey: "capabilities.toggleProp",
        value: "!self",
      },
    };
  const id = `set${capital(prop)}`;
  return {
    [id]: {
      ...common,
      labelKey: labelKeyOf(id, "capabilities.setProp"),
      value: "!param",
      param: { kind, labelKey: "capabilities.paramValue" },
    },
  };
}

/**
 * The derived Do of one type: every accepted prop's, minus the props a concept already writes
 * (`conceptProps`) and the ids a concept already uses (`conceptIds` — the concept wins).
 */
export function deriveReferenceCapabilities(
  type: string,
  accepts: Readonly<Record<string, PropContract>>,
  conceptProps: ReadonlySet<string>,
  conceptIds: ReadonlySet<string>,
): Record<string, CapabilityDef> {
  const out: Record<string, CapabilityDef> = {};
  for (const [prop, contract] of Object.entries(accepts)) {
    if (conceptProps.has(prop)) continue;
    for (const [id, def] of Object.entries(
      capabilitiesOfProp(type, prop, contract),
    ))
      if (!conceptIds.has(id)) out[id] = Object.freeze(def);
  }
  return out;
}

/** Every catalog type's binding `accepts` (a primitive binding — the D2 surface of that type). */
export function catalogAccepts(): ReadonlyMap<
  string,
  Readonly<Record<string, PropContract>>
> {
  const out = new Map<string, Readonly<Record<string, PropContract>>>();
  for (const entry of componentCatalog)
    if (entry.kind === "primitive")
      out.set(entry.type, entry.binding.props.accepts);
  return out;
}
