/**
 * @fileoverview ADR-280 Phase 1 — the capability registry derived from the RAC concepts and the
 * component specs (Decision 1). Runs once at module load; the result is frozen.
 *
 * Rules (breakdown §2b):
 * - events = the concepts' events; an `item` owner's events and a concept's hidden events go to
 *   `hiddenEvents` (derived, not offered — ADR B decides the panel).
 * - capabilities = each state concept's capabilities on its state prop, minus `omit`; `deferred` ones are listed by
 *   key only (ADR-158 G1 — not offered until the Preview delivers them).
 * - racRef = the concept file, its d.ts type and the RAC document section.
 * - guards = the concept's conditions (Decision 8 reads them).
 * - eventArgs = the concepts' `args` · groups = one per concept (`group` ?? id), events first-come
 *   (ADR-281 — the panel's When groups and `!event` argument choices).
 */
import type {
  CapabilityDef,
  ComponentCapability,
  TriggerGroup,
} from "./capabilityRegistry";
import type {
  ComponentInteractionSpec,
  ConceptUse,
  InteractionConcept,
} from "./concepts/types";

function racRefOf(concept: InteractionConcept): string {
  return `concepts/${concept.id}.ts satisfies ${concept.racType} · ${concept.racDoc}`;
}

function capabilitiesOf(use: ConceptUse): {
  capabilities: Record<string, CapabilityDef>;
  deferred: string[];
} {
  const { concept } = use;
  const capabilities: Record<string, CapabilityDef> = {};
  const deferred: string[] = [];
  const omit = new Set(use.omit ?? []);
  for (const [name, capability] of Object.entries(concept.capabilities ?? {})) {
    if (omit.has(name)) continue;
    if (
      use.deferred === true ||
      (Array.isArray(use.deferred) && use.deferred.includes(name))
    ) {
      deferred.push(name);
      continue;
    }
    const param = use.params?.[name] ?? capability.param;
    capabilities[name] = {
      labelKey: use.labels?.[name] ?? capability.labelKey,
      prop: capability.imperative ? "" : (concept.state?.prop ?? ""),
      value: capability.value,
      racRef: racRefOf(concept),
      ...(param ? { param } : {}),
      ...(capability.imperative ? { imperative: true } : {}),
      ...(capability.op ? { op: capability.op } : {}),
      ...(concept.conditions.length ? { guards: concept.conditions } : {}),
    };
  }
  return { capabilities, deferred };
}

function componentOf(spec: ComponentInteractionSpec): ComponentCapability {
  const events: string[] = [];
  const hiddenEvents: string[] = [];
  const capabilities: Record<string, CapabilityDef> = {};
  const deferred: string[] = [];
  const add = (list: string[], names: readonly string[] | undefined) => {
    for (const name of names ?? []) if (!list.includes(name)) list.push(name);
  };
  const eventArgs: Record<string, readonly string[]> = {};
  const groups: { id: string; events: string[]; hiddenEvents: string[]; conditions: string[] }[] =
    [];
  const grouped = new Set<string>();
  for (const use of spec.concepts) {
    if (use.owner === "item") {
      add(hiddenEvents, use.concept.events);
    } else {
      add(events, use.concept.events);
    }
    add(hiddenEvents, use.concept.hiddenEvents);
    const own = capabilitiesOf(use);
    Object.assign(capabilities, own.capabilities);
    add(deferred, own.deferred);
    const concept: InteractionConcept = use.concept;
    for (const [event, names] of Object.entries(concept.args ?? {}))
      eventArgs[event] ??= names;
    if (use.owner === "item") continue;
    const id = concept.group ?? concept.id;
    let group = groups.find((item) => item.id === id);
    if (!group) {
      group = { id, events: [], hiddenEvents: [], conditions: [] };
      groups.push(group);
    }
    const fresh = (names: readonly string[] | undefined) =>
      (names ?? []).filter((name) => !grouped.has(name));
    const shown = fresh(concept.events);
    const hidden = fresh(concept.hiddenEvents);
    add(group.events, shown);
    add(group.hiddenEvents, hidden);
    add(group.conditions, concept.conditions);
    for (const name of [...shown, ...hidden]) grouped.add(name);
  }
  const frozenGroups: TriggerGroup[] = groups
    .filter((group) => group.events.length || group.hiddenEvents.length)
    .map((group) =>
      Object.freeze({
        id: group.id,
        events: Object.freeze(group.events),
        hiddenEvents: Object.freeze(group.hiddenEvents),
        conditions: Object.freeze(group.conditions),
      }),
    );
  return Object.freeze({
    events: Object.freeze(events),
    capabilities: Object.freeze(capabilities),
    ...(hiddenEvents.length
      ? {
          hiddenEvents: Object.freeze(
            hiddenEvents.filter((name) => !events.includes(name)),
          ),
        }
      : {}),
    ...(deferred.length ? { deferred: Object.freeze(deferred) } : {}),
    ...(Object.keys(eventArgs).length
      ? { eventArgs: Object.freeze(eventArgs) }
      : {}),
    ...(frozenGroups.length ? { groups: Object.freeze(frozenGroups) } : {}),
  });
}

/** The registry of every spec'd catalog type (module load once — `CAPABILITY_REGISTRY`). */
export function deriveRegistry(
  specs: Readonly<Record<string, ComponentInteractionSpec>>,
): Readonly<Record<string, ComponentCapability>> {
  const registry: Record<string, ComponentCapability> = {};
  for (const [type, spec] of Object.entries(specs))
    registry[type] = componentOf(spec);
  return Object.freeze(registry);
}
