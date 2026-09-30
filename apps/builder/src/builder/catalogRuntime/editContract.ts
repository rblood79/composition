import {
  deriveOptions,
  getCatalogEntry,
  resolveComponentRule,
  type EditContract,
  type PropContract,
  type ResolvedField,
} from "@composition/shared";
import type { DataBindingValue } from "@composition/shared";
import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  definitionTypeName,
  fail,
  templateDefinitionId,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  AuthoredValue,
  CatalogReader,
  DefinitionId,
  EditTarget,
  PropWrites,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { REUSABLE_PROPS_SCHEMAS } from "../components/reusablePropsSchemas";
import {
  catalogBindingCommand,
  catalogBindingRef,
  catalogBindingValue,
  catalogTargetBinding,
} from "./dataBinding";
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

/** The semantic prop keys a definition offers (no data binding) — a node about to be created. */
export function catalogDefinitionPropKeys(
  graph: CatalogReader,
  definitionId: DefinitionId,
): Set<string> {
  const contracts = semanticContracts(
    definitionId,
    definitionTypeName(graph, definitionId),
  );
  return new Set(
    Object.entries(contracts)
      .filter(([, contract]) => contract.kind !== "binding")
      .map(([key]) => key),
  );
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
    if (contract.kind === "binding") {
      // The data binding is the node's typed `binding`, not a prop (a template position has none
      // of its own and cannot take one).
      const value = catalogBindingValue(catalogTargetBinding(graph, target));
      return {
        key,
        kind: contract.kind,
        label: contract.label ?? key,
        section: contract.section ?? "content",
        origin: "semantic",
        isOverridden: value !== undefined,
        baseValue: undefined,
        currentValue: value,
        visibleWhen: contract.visibleWhen,
        editorHidden: contract.editorHidden || target.kind !== "node",
      };
    }
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

/**
 * The Properties patch as one step: binding keys (`bindingKeys`, the contract's `binding` fields)
 * write the targets' typed binding, the rest their props. A picker value the document cannot hold
 * refuses the step (`UNSUPPORTED_BINDING`); `undefined` = nothing changes.
 */
export function catalogPropertiesPatchCommand(
  graph: CatalogGraph,
  targets: readonly EditTarget[],
  patch: Readonly<Record<string, unknown>>,
  current: (key: string) => unknown,
  bindingKeys: ReadonlySet<string>,
): CatalogCommand | undefined {
  const props: Record<string, unknown> = {};
  const commands: CatalogCommand[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!bindingKeys.has(key)) {
      props[key] = value;
      continue;
    }
    const ref = catalogBindingRef(value as DataBindingValue | undefined);
    if (ref === null) return () => fail("UNSUPPORTED_BINDING", key);
    const first = targets[0];
    const before = first ? catalogTargetBinding(graph, first) : undefined;
    if (JSON.stringify(before) === JSON.stringify(ref)) continue;
    commands.push(catalogBindingCommand(targets, ref));
  }
  const propCommand = catalogSemanticPatchCommand(targets, props, current);
  if (propCommand) commands.push(propCommand);
  if (commands.length < 2) return commands[0];
  return () => composeCommands(graph, "Edit properties", commands);
}
