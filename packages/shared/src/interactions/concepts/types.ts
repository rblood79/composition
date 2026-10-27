/**
 * @fileoverview ADR-280 Phase 1 — the shape of an interaction concept and of a component's spec.
 *
 * A **concept** is one section of the RAC documentation as code: a state with the callback that
 * reports its change (`X` / `defaultX` / `onXChange` — react-stately `useControlledState`), the
 * events that section lists, the props that restrict a change (RAC's `isDisabled` ·
 * `isReadOnly` …) and the Do-axis capabilities that write the state. Each concept file pins its
 * names to the installed RAC d.ts with `satisfies`; `componentInteractionSpecs.ts` maps catalog
 * types to concepts, and `deriveRegistry` turns the two into `CAPABILITY_REGISTRY`.
 *
 * @see docs/adr/completed/280-interactions-rac-surface-registry-controlled-runtime.md Decision 1 · 2
 */
import type { CapabilityParam } from "../capabilityRegistry";

/** The value a concept's state holds (the controlled helper's empty value is per type). */
export type ValueTypeId =
  | "boolean"
  | "string"
  | "number"
  | "key"
  | "keys"
  | "strings"
  | "date"
  | "dateRange"
  | "color"
  | "sort";

/** A concept's state triple (RAC `X` / `defaultX` / `onXChange`). */
export interface ConceptState {
  prop: string;
  defaultProp?: string;
  callback: string;
  valueType: ValueTypeId;
}

/** A capability a concept offers: it writes the concept's state prop (or is imperative). */
export interface ConceptCapability {
  labelKey: string;
  /** The written value: a literal, `"!self"` (toggle) or `"!param"` (the rule's value). */
  value: unknown;
  param?: CapabilityParam;
  /** DOM-ref special case (Form submit · reset) — no prop. */
  imperative?: true;
  /** A key-set operation over the current state (Decision 8). */
  op?: "add" | "remove";
}

export interface InteractionConcept {
  /** The concept (RAC documentation section) — `multiSelection`, `open`, … */
  id: string;
  /** The RAC documentation section the concept transcribes (shown in `racRef`). */
  racDoc: string;
  /** The installed d.ts type its names satisfy (shown in `racRef`). */
  racType: string;
  /** When axis — RAC callbacks the Interactions panel offers. */
  events: readonly string[];
  /**
   * RAC callbacks derived but not offered (keyboard — user decision Q3; hover · focus · the press
   * side events S2 removed — the panel policy is ADR B).
   */
  hiddenEvents?: readonly string[];
  state?: ConceptState;
  /** Props that restrict a change of the state (Decision 8's guards read them). */
  conditions: readonly string[];
  /** Do axis — keyed by the capability name the registry has always used. */
  capabilities?: Readonly<Record<string, ConceptCapability>>;
  /**
   * ADR-281 Decision 2 — the names a rule reads an event's arguments by (`!event.<name>`), per
   * event, in RAC's parameter order (the installed d.ts parameter names). `value` always names the
   * first argument too.
   */
  args?: Readonly<Record<string, readonly string[]>>;
  /**
   * ADR-284 Phase 5 — the callbacks take one event object and `args` name its fields (a
   * collection's drag and drop: `e.keys` · `e.target`), not the callback's parameters.
   */
  argFields?: true;
  /** ADR-281 Decision 1 — the panel group (RAC documentation section); default = `id`. */
  group?: string;
  /**
   * The selection mode RAC uses when the prop is unset (a Select is single by default) — a key set
   * operation replaces in single mode.
   */
  selectionDefault?: "single";
}

/**
 * Who owns a concept on a node (ADR-280 Decision 3 · Phase 0 probe P1 ~ P4): `self` — the node's
 * own RAC component; `trigger` — an elementless trigger node owning its overlay's open state;
 * `group` — a group owning its items' state; `item` — a collection item (press · hover · focus
 * only, the state is its collection's).
 */
export type OwnerKind = "self" | "trigger" | "group" | "item";

/** One concept on a component. */
export interface ConceptUse {
  concept: InteractionConcept;
  owner?: OwnerKind;
  /**
   * Capabilities that RAC has but the Preview does not deliver yet (ADR-158 G1 — not offered).
   * `true` = all of the concept's.
   */
  deferred?: readonly string[] | true;
  /** Capabilities left out for this component (not a RAC prop of it). */
  omit?: readonly string[];
  /** Per-component label keys (a ToggleButton is turned on, a Checkbox checked). */
  labels?: Readonly<Record<string, string>>;
  /** Per-component param (a RadioGroup's value is one of its radios). */
  params?: Readonly<Record<string, CapabilityParam>>;
}

/** A catalog type's interaction spec — the only hand input of the registry (Decision 1). */
export interface ComponentInteractionSpec {
  concepts: readonly ConceptUse[];
}
