/**
 * @fileoverview ADR-281 Decision 1 — what the Interactions panel offers: the registry's When groups
 * and Do capabilities that RAC accepts now, judged from the props a node declares (and what its
 * ancestors pass down). The registry stays whole (ADR-280); this only filters it.
 *
 * - When: a group whose concept RAC stops (`isDisabled` · `isReadOnly` · `isPending` ·
 *   `selectionMode: "none"` — RAC fires none of its events) is left out.
 * - Do: a capability `declaredRefusal` refuses (the dispatcher's own first check) is left out, and
 *   so are a `selectionMode: "none"` target's selection Do (ADR-287 decision 3 — panel only).
 * - Hidden events (RAC callbacks S2 removed — press side events · hover · focus) open with the
 *   panel's "all of RAC" toggle. Keyboard never (user decision Q3).
 * - A name a rule already uses is always offered — hiding never deletes a rule.
 */
import {
  CAPABILITY_REGISTRY,
  resolveCapabilities,
  type CapabilityDef,
  type TriggerGroup,
} from "./capabilityRegistry";
import { declaredRefusal, type CapabilityContext } from "./constraints";

/** Concepts never offered on the When axis (keyboard — user decision Q3, 2026-10-22). */
export const NEVER_OFFERED_GROUPS: readonly string[] = ["keyboard"];

export interface ExposureInput {
  /** The node's declared props (what the Properties panel shows). */
  props: Readonly<Record<string, unknown>>;
  /** What its ancestors pass down (ADR-281 Decision 3 — page root · frame). */
  inherited?: CapabilityContext["inherited"];
}

/** Why RAC fires none of a group's events with these props, else `undefined`. */
export function groupRefusal(
  group: TriggerGroup,
  input: ExposureInput,
): string | undefined {
  const { props, inherited } = input;
  const declared = declaredRefusal(group.conditions, props, inherited);
  if (declared) return declared;
  if (group.conditions.includes("isPending") && props.isPending === true)
    return "isPending";
  if (
    group.conditions.includes("selectionMode") &&
    props.selectionMode === "none"
  )
    return "selectionMode: none";
  return undefined;
}

export interface ExposedGroup {
  id: string;
  events: readonly string[];
  /** Set when RAC fires none of the group's events now (only a used name keeps it listed). */
  refusedBy?: string;
}

/** The type's When groups the panel lists (`used` — the rule's own trigger stays). */
export function exposedTriggerGroups(
  type: string,
  input: ExposureInput,
  options: { showHidden?: boolean; used?: string } = {},
): ExposedGroup[] {
  const out: ExposedGroup[] = [];
  for (const group of CAPABILITY_REGISTRY[type]?.groups ?? []) {
    if (NEVER_OFFERED_GROUPS.includes(group.id)) {
      if (options.used && group.hiddenEvents.includes(options.used))
        out.push({ id: group.id, events: [options.used], refusedBy: "Q3" });
      continue;
    }
    const names = [
      ...group.events,
      ...group.hiddenEvents.filter(
        (name) => options.showHidden || name === options.used,
      ),
    ];
    if (!names.length) continue;
    const refusedBy = groupRefusal(group, input);
    if (!refusedBy) out.push({ id: group.id, events: names });
    else if (options.used && names.includes(options.used))
      out.push({ id: group.id, events: [options.used], refusedBy });
  }
  return out;
}

/** The group a trigger belongs to on a type (`undefined` = not one of its events). */
export function triggerGroupOf(
  type: string,
  trigger: string,
): TriggerGroup | undefined {
  return CAPABILITY_REGISTRY[type]?.groups?.find(
    (group) =>
      group.events.includes(trigger) || group.hiddenEvents.includes(trigger),
  );
}

/** Whether a trigger is one of a type's hidden events (the toggle opens it). */
export function isHiddenTrigger(type: string, trigger: string): boolean {
  const group = triggerGroupOf(type, trigger);
  return !!group && group.hiddenEvents.includes(trigger);
}

/** The type's Do capabilities RAC accepts now (`used` — the rule's own stays). */
export function exposedCapabilities(
  type: string,
  input: ExposureInput,
  used?: string,
): Readonly<Record<string, CapabilityDef>> {
  const all = resolveCapabilities(type);
  return Object.fromEntries(
    Object.entries(all).filter(
      ([name, def]) =>
        name === used ||
        (!declaredRefusal(
          def.guards ?? [],
          input.props,
          input.inherited,
          def.op,
        ) &&
          !hiddenBySelectionMode(def, input)),
    ),
  );
}

/**
 * ADR-287 user decision 3 (gap B) — a target whose `selectionMode` is `"none"` offers none of its
 * selection Do (select · deselect · clear): the panel hides all three and says so. Only the panel —
 * the dispatcher still runs a deselect · clear (`declaredRefusal` refuses an added key only).
 */
export function hiddenBySelectionMode(
  def: CapabilityDef,
  input: ExposureInput,
): boolean {
  return (
    (def.guards ?? []).includes("selectionMode") &&
    input.props.selectionMode === "none"
  );
}

/** Whether `selectionMode: "none"` hides any of a type's Do (the panel's notice). */
export function selectionDoHidden(type: string, input: ExposureInput): boolean {
  return Object.values(resolveCapabilities(type)).some((def) =>
    hiddenBySelectionMode(def, input),
  );
}

/** Why RAC refuses a capability on a target with these props, else `undefined`. */
export function capabilityRefusal(
  type: string,
  capability: string,
  input: ExposureInput,
): string | undefined {
  const def = resolveCapabilities(type)[capability];
  return def
    ? declaredRefusal(def.guards ?? [], input.props, input.inherited, def.op)
    : undefined;
}

/** The argument names a rule can read from a type's event (`!event.<name>`). */
export function eventArgsOf(type: string, trigger: string): readonly string[] {
  return CAPABILITY_REGISTRY[type]?.eventArgs?.[trigger] ?? [];
}
