import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  CatalogReader,
  EditTarget,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { EditContract } from "@composition/shared";
import {
  catalogEditContract,
  catalogSemanticPatchCommand,
} from "./editContract";
import type { CatalogReadModel } from "./readModel";

/** The fields a property copy carries: semantic values (not the typed data binding). */
const copyable = (field: EditContract["fields"][number]) =>
  field.kind !== "binding";

/**
 * ADR-248 Phase 4e-5: Properties copy (⌘⌥C) — the target's own semantic values (what it sets
 * over its definition), the old "copy properties" of a selected element's props.
 */
export function catalogCopiedProperties(
  contract: EditContract,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of contract.fields)
    if (
      copyable(field) &&
      field.isOverridden &&
      field.currentValue !== undefined
    )
      out[field.key] = field.currentValue;
  return out;
}

/**
 * Properties paste (⌘⌥V) as one step on the targets: only the keys the first target's contract
 * offers (another type's props are left out), unchanged values skipped; `undefined` = nothing
 * applies.
 */
export function catalogPastePropertiesCommand(
  graph: CatalogReader,
  readModel: Pick<CatalogReadModel, "propSource">,
  targets: readonly EditTarget[],
  data: Readonly<Record<string, unknown>>,
): CatalogCommand | undefined {
  const first = targets[0];
  if (!first) return undefined;
  const accepted = new Set(
    catalogEditContract(graph, readModel, first)
      .fields.filter(copyable)
      .map((field) => field.key),
  );
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data))
    if (accepted.has(key) && value !== undefined) patch[key] = value;
  return catalogSemanticPatchCommand(
    targets,
    patch,
    (key) => readModel.propSource(first, key).value,
  );
}
