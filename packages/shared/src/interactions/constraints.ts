/**
 * @fileoverview ADR-280 Decision 8 — a capability's result from the current RAC state, and the
 * RAC constraints that refuse it. Pure functions: the dispatcher resolves the value, reads the
 * current state, computes the result here, checks it here, then writes the whole result.
 *
 * A rule is an authored input, so it gets the restrictions RAC puts on the user's input
 * (`isDisabled` · `isReadOnly` · `disallowEmptySelection` · `selectionMode` · `disabledKeys`). RAC
 * itself clamps a range (Phase 0 probe P6) — no range guard.
 */
import type { CapabilityDef } from "./capabilityRegistry";

/** A key set as written to a controlled prop — `"all"` or the keys. */
type KeySet = "all" | string[];

/** RAC's `Selection` · an array · one key → the key list (`"all"` stays). */
export function toKeySet(value: unknown): KeySet {
  if (value === "all") return "all";
  if (value instanceof Set) return [...value].map(String);
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

export interface CapabilityContext {
  /** The target's props as RAC sees them (declared + runtime override). */
  props: Readonly<Record<string, unknown>>;
  /** The current value of the capability's prop (`catalogRuntimeStateOf`). */
  current: unknown;
  /** Restrictions an enclosing RAC group passes down (CheckboxGroup `isDisabled` …). */
  inherited?: Readonly<{ isDisabled?: boolean; isReadOnly?: boolean }>;
  /** Every item key of a collection (to spell out `"all"`), and its disabled ones. */
  itemKeys?: readonly string[];
  disabledKeys?: readonly string[];
}

/**
 * The value a set operation leaves (`op` — add · remove a key, `selectionMode: "single"` replaces).
 * A capability without `op` writes its resolved value as is.
 */
export function applyCapabilityOp(
  def: CapabilityDef,
  value: unknown,
  context: CapabilityContext,
): unknown {
  if (!def.op) return value;
  const keys = toKeySet(value);
  const added = keys === "all" ? [...(context.itemKeys ?? [])] : keys;
  const currentSet = toKeySet(context.current);
  const current =
    currentSet === "all" ? [...(context.itemKeys ?? [])] : currentSet;
  if (def.op === "add") {
    if (keys === "all") return "all";
    if ((context.props.selectionMode ?? def.selectionDefault) === "single")
      return added.slice(-1);
    return [...current, ...added.filter((key) => !current.includes(key))];
  }
  return current.filter((key) => !added.includes(key));
}

/**
 * ADR-281 Decision 1 — the restriction the declared props alone put on a change (whatever value a
 * rule writes): `isDisabled` · `isReadOnly` (own or inherited) · `selectionMode: "none"` for an
 * added key. The dispatcher checks it first (below); the Interactions panel hides what it refuses
 * — one answer for both.
 */
export function declaredRefusal(
  guards: readonly string[],
  props: Readonly<Record<string, unknown>>,
  inherited?: CapabilityContext["inherited"],
  op?: CapabilityDef["op"],
): string | undefined {
  if (
    guards.includes("isDisabled") &&
    (props.isDisabled === true || inherited?.isDisabled === true)
  )
    return "isDisabled";
  if (
    guards.includes("isReadOnly") &&
    (props.isReadOnly === true || inherited?.isReadOnly === true)
  )
    return "isReadOnly";
  if (
    guards.includes("selectionMode") &&
    op === "add" &&
    props.selectionMode === "none"
  )
    return "selectionMode: none";
  return undefined;
}

/** Why RAC would refuse this change, else `undefined`. */
export function checkCapabilityConstraints(
  def: CapabilityDef,
  value: unknown,
  next: unknown,
  context: CapabilityContext,
): string | undefined {
  const guards = def.guards ?? [];
  const { props } = context;
  const declared = declaredRefusal(guards, props, context.inherited, def.op);
  if (declared) return declared;
  const keyed = def.op !== undefined || Array.isArray(next);
  if (guards.includes("disabledKeys") && (def.op === "add" || !keyed)) {
    const disabled = new Set([
      ...toKeySet(props.disabledKeys === "all" ? [] : props.disabledKeys),
      ...(context.disabledKeys ?? []),
    ]);
    const asked = def.op ? toKeySet(value) : toKeySet(next);
    if (asked !== "all" && asked.some((key) => disabled.has(key)))
      return "disabledKeys";
  }
  if (
    guards.includes("disallowEmptySelection") &&
    props.disallowEmptySelection === true &&
    Array.isArray(next) &&
    next.length === 0
  )
    return "disallowEmptySelection";
  return undefined;
}
