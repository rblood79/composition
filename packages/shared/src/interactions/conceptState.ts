import { COMPONENT_INTERACTION_SPECS } from "./componentInteractionSpecs";
import type { ComponentInteractionSpec, ValueTypeId } from "./concepts/types";

/** A RAC state of a component type (`X` · `defaultX` of the concept whose change is `callback`). */
export interface ConceptStateProp {
  readonly prop: string;
  readonly defaultProp?: string;
  /** The value the change reports (a single selection's `key`, a list's `keys` …). */
  readonly valueType: ValueTypeId;
}

const BY_CALLBACK = (() => {
  const out = new Map<string, Map<string, ConceptStateProp>>();
  for (const [type, spec] of Object.entries(
    COMPONENT_INTERACTION_SPECS as Readonly<
      Record<string, ComponentInteractionSpec>
    >,
  )) {
    const map = new Map<string, ConceptStateProp>();
    for (const use of spec.concepts) {
      const state = use.concept.state;
      if (!state?.callback || use.owner === "item" || use.owner === "trigger")
        continue;
      if (!map.has(state.callback))
        map.set(state.callback, {
          prop: state.prop,
          ...(state.defaultProp ? { defaultProp: state.defaultProp } : {}),
          valueType: state.valueType,
        });
    }
    out.set(type, map);
  }
  return out;
})();

/**
 * ADR-284 Phase 6 — the state prop a component's change `callback` reports (`onSelectionChange` →
 * `selectedKeys`): the controlled pair a variable is wired to (`selectedKeys={cycles}
 * onSelectionChange={setCycles}`), from the concepts — not a hand table.
 */
export function conceptStateOf(
  type: string,
  callback: string,
): ConceptStateProp | undefined {
  return BY_CALLBACK.get(type)?.get(callback);
}

/** The change callback of a component type's state prop (`selectedKeys` → `onSelectionChange`). */
export function conceptCallbackOf(
  type: string,
  prop: string,
): string | undefined {
  for (const [callback, state] of BY_CALLBACK.get(type) ?? [])
    if (state.prop === prop) return callback;
  return undefined;
}

/**
 * The state props a component type's concepts own (`selectedKeys` · `isSelected` · `value` …) —
 * RAC state a variable may drive (`PropVar`), whether or not the panel offers it as a fixed value.
 */
export function conceptStatePropsOf(type: string): ReadonlySet<string> {
  return new Set(
    [...(BY_CALLBACK.get(type)?.values() ?? [])].map((state) => state.prop),
  );
}
