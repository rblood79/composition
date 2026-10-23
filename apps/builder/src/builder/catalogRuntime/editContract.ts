import { deriveOptions } from "../../../../../packages/shared/src/catalog/outputs/editFields";
import { readPropSource } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  getCatalogEntry,
  resolveComponentRule,
  type EditContract,
  type PropContract,
  type ResolvedField,
} from "@composition/shared";
import type { DataBindingValue } from "@composition/shared";
import {
  setFields,
  setTableCellSpan,
} from "../../../../../packages/shared/src/catalog/commands";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
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
import { normalizeColorControlPatch } from "../../../../../packages/shared/src/catalog/document/colorValue";
import { RULE_TYPE_PROP_CONTRACTS } from "../../../../../packages/shared/src/catalog/document/itemLinks";
import { componentPropertiesOf } from "../../../../../packages/shared/src/catalog/document/componentProperties";
import { catalogOwnedFieldContent } from "./fieldContent";
import { REUSABLE_PROPS_SCHEMAS } from "../components/reusablePropsSchemas";
import {
  catalogBindingRef,
  catalogBindingValue,
  catalogTargetBinding,
} from "./dataBinding";
import { catalogBindingCommand } from "./dataBindingCommand";
import type { CatalogReadModel } from "./readModel";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";

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
export function catalogSemanticContracts(
  definitionId: DefinitionId,
  type: string,
): Readonly<Record<string, PropContract>> {
  if (definitionId.startsWith(ORIGIN_PREFIX)) {
    const schema =
      REUSABLE_PROPS_SCHEMAS[definitionId.slice(ORIGIN_PREFIX.length)];
    if (schema) return schema as Readonly<Record<string, PropContract>>;
  }
  const entry = getCatalogEntry(type);
  return entry?.kind === "primitive"
    ? (entry.binding.props.accepts ?? {})
    : (RULE_TYPE_PROP_CONTRACTS[type] ?? {});
}

/** The semantic prop keys a definition offers (no data binding) — a node about to be created. */
export function catalogDefinitionPropKeys(
  graph: CatalogReader,
  definitionId: DefinitionId,
): Set<string> {
  const contracts = catalogSemanticContracts(
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
  const node = { type };
  const ownedContent = catalogOwnedFieldContent(graph, target, type);
  const fields: ResolvedField[] = Object.entries(
    catalogSemanticContracts(definitionId, type),
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
    const baseValue = reading.inherited.value ?? contract.default;
    const part = ownedContent.get(key);
    const value = part
      ? readPropSource(graph, part.target, part.key).value
      : reading.value;
    const isOverridden = part
      ? JSON.stringify(value) !== JSON.stringify(baseValue)
      : reading.own !== undefined;
    return {
      key,
      kind: contract.kind,
      label: contract.label ?? key,
      section: contract.section ?? "content",
      origin: "semantic",
      isOverridden,
      baseValue,
      currentValue: isOverridden ? value : baseValue,
      min: contract.min,
      max: contract.max,
      step: contract.step,
      options: deriveOptions(contract, rule, node, key),
      itemsManager: contract.itemsManager,
      visibleWhen: contract.visibleWhen,
      editorHidden: contract.editorHidden,
    };
  });
  const contract: EditContract = {
    type,
    fields: [
      ...catalogComponentPropertyFields(graph, readModel, target, definitionId),
      ...fields,
    ],
  };
  if (definitionId.startsWith("project:"))
    PROPERTY_DEPENDENCIES.set(
      contract,
      catalogComponentPropertyDependencies(graph, definitionId),
    );
  return contract;
}

/** ADR-261 Decision 4: what a contract's property fields read besides the target (by contract). */
const PROPERTY_DEPENDENCIES = new WeakMap<EditContract, readonly string[]>();
export function catalogEditContractDependencies(
  contract: EditContract,
): readonly string[] {
  return PROPERTY_DEPENDENCIES.get(contract) ?? [];
}

/**
 * ADR-261 Decision 4 — a user component instance's property fields (Figma's instance properties):
 * text → a text field, boolean → a switch, labelled with the property's name, first in Content.
 * The base value is what the origin node shows (the default — nothing stored); the instance's own
 * write is the override.
 */
function catalogComponentPropertyFields(
  graph: CatalogReader,
  readModel: Pick<CatalogReadModel, "propSource">,
  target: EditTarget,
  definitionId: DefinitionId,
): ResolvedField[] {
  if (!definitionId.startsWith("project:")) return [];
  const properties = componentPropertiesOf(graph.getEntry(definitionId));
  if (!properties) return [];
  // (Review m3: the instance's own child list at a position — its first structural edit made the
  // template children there its own copies, values kept — leaves the property no layer below it.
  // pen.dev: what is in the slot is the instance's. Its field is not offered then.)
  const owner = target.kind === "node" ? graph.getEntry(target.id) : undefined;
  const cut = new Set(
    owner?.kind === "node"
      ? owner.descendantOverrides
          .filter(
            (item) =>
              // (Phase 5: a swapped nested instance — its replacement — is the instance's own too.)
              item.kind !== "patch" && item.address.instances.length === 1,
          )
          .map((item) => item.address.templatePath.at(-1)!)
      : [],
  );
  const reachable = (id: string) => {
    for (
      let cursor = graph.ownerOf(id);
      cursor && cut.size;
      cursor = graph.ownerOf(cursor)
    )
      if (cut.has(cursor as never)) return false;
    return true;
  };
  // (Phase 5: an instance swap property is no root prop — its own section picks the component.)
  return properties.flatMap((property): ResolvedField[] => {
    if (property.kind === "instance") return [];
    const reading = readModel.propSource(target, property.key);
    const [first] = property.targets;
    const origin = graph.getEntry(first.id);
    const baseValue =
      property.kind === "text"
        ? readPropSource(graph, { kind: "node", id: first.id }, first.prop!)
            .value
        : origin?.kind !== "node" || origin.enabled !== false;
    const isOverridden = reading.own !== undefined;
    return [{
      key: property.key,
      kind: property.kind === "text" ? "string" : "boolean",
      label: property.name,
      section: "content",
      origin: "semantic",
      isOverridden,
      // (A nested instance's value from its origin's template shows as its base.)
      baseValue: reading.inherited.value ?? baseValue,
      currentValue: reading.value ?? baseValue,
      ...(property.targets.some((item) => reachable(item.id))
        ? {}
        : { editorHidden: true }),
    }];
  });
}

/**
 * ADR-261 Decision 4: the entries a component instance's property fields read besides the
 * target — its definition (the property list) and the driven origin nodes (the defaults).
 */
function catalogComponentPropertyDependencies(
  graph: CatalogReader,
  definitionId: DefinitionId,
): string[] {
  const properties = componentPropertiesOf(graph.getEntry(definitionId));
  return [
    definitionId,
    ...(properties ?? []).flatMap((property) =>
      property.targets.map((item) => item.id),
    ),
  ];
}

/**
 * What a target's prop shows without its own write — the inherited value, else the contract's
 * default (the Properties field's `baseValue`).
 */
export function catalogPropBaseValue(
  graph: CatalogReader,
  target: EditTarget,
  key: string,
): unknown {
  const inherited = readPropSource(graph, target, key).inherited.value;
  if (inherited !== undefined) return inherited;
  const definitionId = catalogTargetDefinitionId(graph, target);
  return catalogSemanticContracts(
    definitionId,
    definitionTypeName(graph, definitionId),
  )[key]?.default;
}

/**
 * A Properties patch as one command: each changed key is set on the targets (`undefined` removes
 * the own write, back to the inherited value). Unchanged keys are left out; `undefined` = nothing
 * changes. With `base`, a value equal to every target's base (`catalogPropBaseValue`) removes the
 * own write too — a value set back leaves no override.
 */
export function catalogSemanticPatchCommand(
  targets: readonly EditTarget[],
  patch: Readonly<Record<string, unknown>>,
  current: (key: string) => unknown,
  base?: (target: EditTarget, key: string) => unknown,
): CatalogCommand | undefined {
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const props: Record<string, PropWrites[string]> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (same(current(key), value)) continue;
    props[key] =
      value === undefined ||
      (base && targets.every((target) => same(base(target, key), value)))
        ? { kind: "remove" }
        : { kind: "set", value: value as AuthoredValue };
  }
  if (!Object.keys(props).length || !targets.length) return undefined;
  return setFields({ targets, props, label: "Edit properties" });
}

/**
 * ADR-257 Phase 2 — a table Cell's column span: the span command per owned Cell (the row keeps one
 * cell per column — the cells to the right are taken, new empty ones left). Undefined when a
 * target is not an owned Cell (the plain prop write).
 */
export function catalogCellSpanCommand(
  graph: CatalogGraph,
  targets: readonly EditTarget[],
  value: unknown,
  current: (key: string) => unknown,
  newId?: NewId,
): CatalogCommand | undefined {
  if (!targets.length) return undefined;
  const cells = targets.flatMap((target) => {
    if (target.kind !== "node") return [];
    const entry = graph.getEntry(target.id);
    return entry?.kind === "node" &&
      definitionTypeName(graph, entry.definitionId) === "Cell"
      ? [target.id]
      : [];
  });
  if (cells.length !== targets.length) return undefined;
  const span = value === undefined ? 1 : Number(value);
  if (JSON.stringify(current("colSpan") ?? 1) === JSON.stringify(span))
    return undefined;
  const buildCell = newId
    ? () => {
        const definitionId = catalogPaletteDefinitionId(graph.library, "Cell");
        const cell = {
          kind: "node" as const,
          id: newId("node") as (typeof cells)[number],
          definitionId,
          children: [],
          props: definitionId.startsWith("lib:")
            ? catalogCreationProps(
                graph.library,
                definitionId as `lib:definition:${string}`,
                "Cell",
              )
            : {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        };
        return { entries: [cell], rootId: cell.id };
      }
    : undefined;
  const commands = cells.map((cell) =>
    setTableCellSpan({ cell, span, buildCell }),
  );
  return commands.length === 1
    ? commands[0]
    : () => composeCommands(graph, "Edit column span", commands);
}

/** ADR-258 Decision 8 — the props a Color control's color space · channels · value live in. */
const COLOR_CONTROL_KEYS = [
  "colorSpace",
  "channel",
  "xChannel",
  "yChannel",
  "defaultValue",
] as const;

/**
 * ADR-258 Decision 8 — a props patch on ColorArea · ColorSlider targets, widened per target
 * (`normalizeColorControlPatch` against that target's own effective props) so one write keeps the
 * color space and the channels a combination RAC accepts. Targets whose widened patch is the same
 * share one command. `undefined` when no target is a Color control or the patch touches none of
 * its keys (the plain patch).
 */
export function catalogColorControlPatchCommand(
  graph: CatalogGraph,
  targets: readonly EditTarget[],
  patch: Readonly<Record<string, unknown>>,
  currentOf: (target: EditTarget, key: string) => unknown,
): CatalogCommand | undefined {
  if (!COLOR_CONTROL_KEYS.some((key) => key in patch)) return undefined;
  const types = targets.map((target) => {
    if (target.kind !== "node") return "";
    const entry = graph.getEntry(target.id);
    if (entry?.kind !== "node") return "";
    try {
      return definitionTypeName(graph, entry.definitionId);
    } catch {
      return "";
    }
  });
  if (!types.some((type) => type === "ColorArea" || type === "ColorSlider"))
    return undefined;
  const groups = new Map<
    string,
    { targets: EditTarget[]; patch: Record<string, unknown> }
  >();
  targets.forEach((target, index) => {
    const props = Object.fromEntries(
      COLOR_CONTROL_KEYS.map((key) => [key, currentOf(target, key)]),
    );
    const widened = normalizeColorControlPatch(types[index]!, props, patch);
    const id = JSON.stringify(
      Object.entries(widened).map(([key, value]) => [key, value ?? null]),
    );
    const group = groups.get(id) ?? { targets: [], patch: widened };
    group.targets.push(target);
    groups.set(id, group);
  });
  const commands = [...groups.values()].flatMap((group) => {
    const first = group.targets[0]!;
    const command = catalogSemanticPatchCommand(
      group.targets,
      group.patch,
      (key) => currentOf(first, key),
      (target, key) => catalogPropBaseValue(graph, target, key),
    );
    return command ? [command] : [];
  });
  if (commands.length < 2) return commands[0];
  return () => composeCommands(graph, "Edit properties", commands);
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
  /** New cells when a Cell's `colSpan` narrows (ADR-257 Phase 2) — refused without. */
  newId?: NewId,
  /** Each target's own effective prop (ADR-258 Decision 8 — the color patch is widened per target). */
  currentOf: (target: EditTarget, key: string) => unknown = (_, key) =>
    current(key),
): CatalogCommand | undefined {
  const props: Record<string, unknown> = {};
  const commands: CatalogCommand[] = [];
  // ADR-257 Phase 2: a table Cell's `colSpan` keeps its row aligned (`setTableCellSpan`).
  const spanCommand =
    "colSpan" in patch
      ? catalogCellSpanCommand(graph, targets, patch.colSpan, current, newId)
      : undefined;
  if (spanCommand) commands.push(spanCommand);
  for (const [key, value] of Object.entries(patch)) {
    if (key === "colSpan" && spanCommand) continue;
    if (!bindingKeys.has(key)) {
      props[key] = value;
      continue;
    }
    const ref = catalogBindingRef(value as DataBindingValue | undefined);
    if (ref === null) return () => fail("UNSUPPORTED_BINDING", key);
    const first = targets[0];
    const before = first ? catalogTargetBinding(graph, first) : undefined;
    if (JSON.stringify(before) === JSON.stringify(ref)) continue;
    commands.push(catalogBindingCommand(targets, ref, newId));
  }
  const propCommand =
    catalogColorControlPatchCommand(graph, targets, props, currentOf) ??
    catalogSemanticPatchCommand(targets, props, current, (target, key) =>
      catalogPropBaseValue(graph, target, key),
    );
  if (propCommand) commands.push(propCommand);
  // Prefix/wrapper edits materialize the template parts. Keep this panel's semantic edit atomic
  // with the actual content writes, including resets and already-saved materialized fields.
  for (const target of targets) {
    const parts = catalogOwnedFieldContent(graph, target);
    for (const [key, value] of Object.entries(props)) {
      const part = parts.get(key);
      if (!part) continue;
      const next =
        value === undefined ? catalogPropBaseValue(graph, target, key) : value;
      if (
        JSON.stringify(readPropSource(graph, part.target, part.key).value) ===
        JSON.stringify(next)
      )
        continue;
      commands.push(
        setFields({
          targets: [part.target],
          props: {
            [part.key]: { kind: "set", value: (next ?? "") as AuthoredValue },
          },
        }),
      );
    }
  }
  if (commands.length < 2) return commands[0];
  return () => composeCommands(graph, "Edit properties", commands);
}
