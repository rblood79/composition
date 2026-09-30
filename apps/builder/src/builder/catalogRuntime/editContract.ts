import {
  deriveOptions,
  getCatalogEntry,
  resolveComponentRule,
  type EditContract,
  type PropContract,
  type ResolvedField,
} from "@composition/shared";
import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  definitionTypeName,
  templateDefinitionId,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  AuthoredValue,
  CatalogReader,
  DefinitionId,
  EditTarget,
  PropWrites,
} from "../../../../../packages/shared/src/catalog/document/types";
import { REUSABLE_PROPS_SCHEMAS } from "../components/reusablePropsSchemas";
import type { CatalogReadModel } from "./readModel";

const ORIGIN_PREFIX = "lib:definition:origin-";

/** The definition an edit target shows (a node's own, or its template position's). */
export function catalogTargetDefinitionId(
  graph: CatalogReader,
  target: EditTarget,
): DefinitionId {
  if (target.kind === "descendant") {
    const path = target.address.templatePath;
    return templateDefinitionId(graph, path[path.length - 1]);
  }
  const node = graph.getEntry(target.id);
  if (node?.kind !== "node") throw new Error(`NODE_REQUIRED:${target.id}`);
  return node.definitionId;
}

/** The semantic props an edited definition offers: a reusable origin's own contract, else the
 * catalog accepts of the type it shows (the old contract's (A′) / (A) / (A″) paths). */
function semanticContracts(
  definitionId: DefinitionId,
  type: string,
): Readonly<Record<string, PropContract>> {
  if (definitionId.startsWith(ORIGIN_PREFIX)) {
    const schema =
      REUSABLE_PROPS_SCHEMAS[definitionId.slice(ORIGIN_PREFIX.length)];
    if (schema) return schema as Readonly<Record<string, PropContract>>;
  }
  const entry = getCatalogEntry(type);
  return entry?.kind === "primitive" ? (entry.binding.props.accepts ?? {}) : {};
}

/**
 * ADR-248 Phase 4e-4: the Properties panel's edit contract of a catalog edit target — the semantic
 * fields of the definition it shows, each with its value source from the read model (`own` = the
 * target's own write; the base value is what shows without it). Same field shape as the old
 * `resolveEditContract`, so the generic field renderer is unchanged.
 */
export function catalogEditContract(
  graph: CatalogReader,
  readModel: Pick<CatalogReadModel, "propSource">,
  target: EditTarget,
): EditContract {
  const definitionId = catalogTargetDefinitionId(graph, target);
  const type = definitionTypeName(graph, definitionId);
  const rule = resolveComponentRule(type);
  const node = { id: "", type, props: {} } as Parameters<
    typeof deriveOptions
  >[2];
  const fields: ResolvedField[] = Object.entries(
    semanticContracts(definitionId, type),
  ).map(([key, contract]) => {
    const reading = readModel.propSource(target, key);
    const isOverridden = reading.own !== undefined;
    const baseValue = reading.inherited.value ?? contract.default;
    return {
      key,
      kind: contract.kind,
      label: contract.label ?? key,
      section: contract.section ?? "content",
      origin: "semantic",
      isOverridden,
      baseValue,
      currentValue: isOverridden ? reading.value : baseValue,
      min: contract.min,
      max: contract.max,
      step: contract.step,
      options: deriveOptions(contract, rule, node, key),
      itemsManager: contract.itemsManager,
      visibleWhen: contract.visibleWhen,
      editorHidden: contract.editorHidden,
    };
  });
  return { type, fields };
}

/**
 * A Properties patch as one command: each changed key is set on the targets (`undefined` removes
 * the own write, back to the inherited value). Unchanged keys are left out; `undefined` = nothing
 * changes.
 */
export function catalogSemanticPatchCommand(
  targets: readonly EditTarget[],
  patch: Readonly<Record<string, unknown>>,
  current: (key: string) => unknown,
): CatalogCommand | undefined {
  const props: Record<string, PropWrites[string]> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (JSON.stringify(current(key)) === JSON.stringify(value)) continue;
    props[key] =
      value === undefined
        ? { kind: "remove" }
        : { kind: "set", value: value as AuthoredValue };
  }
  if (!Object.keys(props).length || !targets.length) return undefined;
  return setFields({ targets, props, label: "Edit properties" });
}
