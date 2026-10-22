import {
  descendantPatchOf,
  type CatalogEntry,
  type DescendantPatchFields,
  type EntryId,
  type InstanceAddress,
  type InteractionEntry,
  type NodeId,
  type TemplateId,
} from "../document/types";

/**
 * ADR-281 Decision 4 — an origin's rule in its instances. A rule on a component's template node
 * runs wherever the node is drawn; an instance changes it at the position with its patch's
 * `interactions` map — `"off"` (it does not run here) or the instance's own rule at the same
 * address (it runs instead). The Interactions panel (`catalogInheritedInteractionsOf`) and the
 * Preview (`recordsOfOwner`) both read `effectiveInteractionsOf` — one answer for what the user
 * sees and what runs.
 */
type Get = (id: string) => CatalogEntry | undefined;
export type CatalogInteractionOverrides = NonNullable<
  DescendantPatchFields["interactions"]
>;
export type CatalogInteractionStatus =
  "on" | "off" | { replacedBy: EntryId<"interaction"> };

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** The map an instance writes at one of its positions (the panel's selected position). */
export function catalogInteractionOverridesAt(
  get: Get,
  address: InstanceAddress,
): CatalogInteractionOverrides | undefined {
  const owner = get(address.instances[0]!);
  if (owner?.kind !== "node") return undefined;
  const found = owner.descendantOverrides.find(
    (item) =>
      sameIds(item.address.instances, address.instances) &&
      sameIds(item.address.templatePath, address.templatePath),
  );
  return descendantPatchOf(found)?.interactions;
}

/**
 * The maps a drawn record's instance chain writes at its source — the record's `instancePath` from
 * the outside in, each authored instance's patch whose address reaches the source; the outer
 * instance wins (ADR-260 Decision 11's order).
 */
export function catalogRecordInteractionOverrides(
  get: Get,
  instancePath: readonly (NodeId | TemplateId)[],
  sourceId: string,
): CatalogInteractionOverrides | undefined {
  let out: Record<string, "off" | EntryId<"interaction">> | undefined;
  for (let index = 0; index < instancePath.length; index += 1) {
    const owner = get(instancePath[index]!);
    if (owner?.kind !== "node" || !owner.descendantOverrides.length) continue;
    const chain = instancePath.slice(index);
    for (const item of owner.descendantOverrides) {
      const map = descendantPatchOf(item)?.interactions;
      if (
        !map ||
        item.address.templatePath.at(-1) !== sourceId ||
        !sameIds(item.address.instances, chain)
      )
        continue;
      for (const [ruleId, value] of Object.entries(map))
        if (!out || !(ruleId in out)) (out ??= {})[ruleId] = value;
    }
  }
  return out;
}

/** What each of an origin's rules does at a position with these overrides. */
export function effectiveInteractionsOf(
  get: Get,
  rules: readonly InteractionEntry[],
  overrides: CatalogInteractionOverrides | undefined,
): { rule: InteractionEntry; status: CatalogInteractionStatus }[] {
  return rules.map((rule) => {
    const value = overrides?.[rule.id];
    if (!value) return { rule, status: "on" as const };
    if (value === "off") return { rule, status: "off" as const };
    // (A replacement rule that is gone leaves the origin's running — a dangling key changes nothing.)
    return get(value)?.kind === "interaction"
      ? { rule, status: { replacedBy: value } }
      : { rule, status: "on" as const };
  });
}
