import type { CatalogCapabilityTarget } from "../document/types";
import type { CatalogConsumerNode } from "./compositionRoot";

/** What the target resolution reads of a composition root (the Builder's and the Preview's). */
export interface CatalogTargetRecords {
  recordsOfSource(sourceId: string): readonly string[];
  readonly domInputs: ReadonlyMap<string, CatalogConsumerNode>;
}

/**
 * Why a rule's target names no record from the record that fired it: `unset` (the place was
 * removed), out of context (the place is in another row or instance than the firing record), or
 * ambiguous (a design violation — tests assert it never happens).
 */
export type CatalogTargetUnresolved =
  | "TARGET_UNSET"
  | "TARGET_OUT_OF_CONTEXT"
  | "TARGET_AMBIGUOUS";

export type CatalogTargetResolution =
  | { recordId: string }
  | { error: CatalogTargetUnresolved };

const sourcesOf = (record: CatalogConsumerNode): readonly string[] =>
  record.collapsedSourceIds
    ? [record.sourceId, ...record.collapsedSourceIds]
    : [record.sourceId];

/** A record and its ancestors (the `parentId` chain, nearest first). */
function chainOf(
  records: ReadonlyMap<string, CatalogConsumerNode>,
  id: string,
): CatalogConsumerNode[] {
  const chain: CatalogConsumerNode[] = [];
  const seen = new Set<string>();
  for (
    let record = records.get(id);
    record && !seen.has(record.id);
    record = records.get(record.parentId)
  ) {
    seen.add(record.id);
    chain.push(record);
  }
  return chain;
}

/**
 * ADR-283 Decision 2 — the one record a capability target names from the record that fired the
 * rule (the Preview's rule and the panel's 「this rule changes」 read this): of the records drawing
 * the referenced place, the one (b) inside the instance steps the reference names (`address` ·
 * `local` instances — a record on its chain draws that step), (c) for `local`, inside the origin
 * the firing record is drawn in (the nearest record on its chain drawing the origin's root), and
 * whose every data row record (`rowIndex` — the reference never names a row) is on the firing
 * record's chain. The same row's sibling has another instance path but the same row record
 * (breakdown §1b — a path comparison drops it).
 */
export function resolveCapabilityTarget(
  root: CatalogTargetRecords,
  firingRecordId: string,
  ref: CatalogCapabilityTarget,
  /**
   * The root of the origin whose template holds the rule's owner (`catalogOriginRootOf`): a
   * `local` place — and a node of that same template named by id — is the one drawn in the origin
   * the firing record is drawn in. (Without it a `local` with no instance step anchors at its own
   * first step, which is then that root.)
   */
  originRoot?: string,
): CatalogTargetResolution {
  if ("unset" in ref) return { error: "TARGET_UNSET" };
  const records = root.domInputs;
  const firing = chainOf(records, firingRecordId);
  const firingIds = new Set(firing.map((record) => record.id));
  const steps =
    "address" in ref ? ref.address : "local" in ref ? ref.local : undefined;
  const leaf = steps
    ? steps.templatePath.at(-1)!
    : (ref as { nodeId: string }).nodeId;
  const anchorSource =
    originRoot ??
    ("local" in ref && !ref.local.instances.length
      ? ref.local.templatePath[0]
      : undefined);
  const anchor =
    anchorSource === undefined
      ? undefined
      : firing.find((record) => sourcesOf(record).includes(anchorSource));
  if ("local" in ref && !anchor) return { error: "TARGET_OUT_OF_CONTEXT" };
  let found = root.recordsOfSource(leaf).filter((id) => {
    const chain = chainOf(records, id);
    if ("local" in ref && !chain.includes(anchor!)) return false;
    for (const step of steps?.instances ?? [])
      if (!chain.some((record) => sourcesOf(record).includes(step)))
        return false;
    return chain.every(
      (record) => record.rowIndex === undefined || firingIds.has(record.id),
    );
  });
  // (A node of the owner's own template named by id: the one in the firing record's origin. A
  // page node is drawn outside it — kept.)
  if ("nodeId" in ref && anchor && found.length > 1) {
    const inside = found.filter((id) =>
      chainOf(records, id).includes(anchor),
    );
    if (inside.length) found = inside;
  }
  if (found.length === 1) return { recordId: found[0]! };
  return { error: found.length ? "TARGET_AMBIGUOUS" : "TARGET_OUT_OF_CONTEXT" };
}

/**
 * The root of the origin whose template holds `nodeId` (owner chain top: a project component's,
 * or an unlocked library origin's copy — ADR-282), `undefined` for a page node.
 */
export function catalogOriginRootOf(
  reader: {
    getEntry(id: string): { kind: string } | undefined;
    ownerOf(id: string): string | undefined;
  },
  nodeId: string,
): string | undefined {
  const seen = new Set<string>();
  for (
    let cursor = reader.ownerOf(nodeId);
    cursor && !seen.has(cursor);
    cursor = reader.ownerOf(cursor)
  ) {
    seen.add(cursor);
    const owner = reader.getEntry(cursor) as
      | { kind: string; templateRootId?: string }
      | undefined;
    if (owner?.kind === "definition" || owner?.kind === "definitionOverride")
      return owner.templateRootId;
    if (owner?.kind !== "node") return undefined;
  }
  return undefined;
}
