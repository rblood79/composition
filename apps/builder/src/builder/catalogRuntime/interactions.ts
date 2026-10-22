import { isCapabilityTarget, type ExposureInput } from "@composition/shared";
import { setNodeInteractions } from "../../../../../packages/shared/src/catalog/commands";
import {
  catalogInteractionOverridesAt,
  effectiveInteractionsOf,
  type CatalogInteractionStatus,
} from "../../../../../packages/shared/src/catalog/resolution/effectiveInteractions";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import {
  definitionTypeName,
  sameAddress,
} from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  EditTarget,
  EntryId,
  InstanceAddress,
  InteractionEntry,
  NodeId,
  Scalar,
  DataCollectionId,
  DataEndpointId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  catalogPropBaseValue,
  catalogTargetDefinitionId,
} from "./editContract";
import { readPropSource } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogEmptyVariableValue,
  catalogVisibleVariableEntries,
  type CatalogVariableReader,
  type CatalogVariableType,
} from "./stateVariables";

/**
 * ADR-248 Phase 4e-4e: the Interactions panel over the catalog document. A rule is an interaction
 * record owned by the selected node (an instance descendant: its instance node at the address);
 * the panel writes the owner's list as a whole (`setNodeInteractions`, one step). The document
 * holds only complete rules — a Do choice starts from a valid action (the first page, variable or
 * target), and a choice with nothing to point at is not offered.
 */

export type CatalogInteractionAction = InteractionEntry["action"];
export type CatalogActionChoice = CatalogInteractionAction["opcode"];

export interface CatalogInteractionOwner {
  ownerId: NodeId;
  address?: InstanceAddress;
}

export const catalogInteractionOwner = (
  target: EditTarget,
): CatalogInteractionOwner =>
  target.kind === "node"
    ? { ownerId: target.id }
    : { ownerId: target.ownerId, address: target.address };

const sameOwnerAddress = (
  a: InstanceAddress | undefined,
  b: InstanceAddress | undefined,
) => a === b || (!!a && !!b && sameAddress(a, b));

/** The component type the registry keys triggers and capabilities by (`Button`, `Tabs`, …). */
export function catalogTargetTypeName(
  graph: CatalogVariableReader,
  target: EditTarget,
): string {
  try {
    return definitionTypeName(graph, catalogTargetDefinitionId(graph, target));
  } catch {
    return "";
  }
}

/** The props RAC stops a change by (ADR-281 Decision 1 — the panel judges What RAC accepts by them). */
const EXPOSURE_PROPS = [
  "isDisabled",
  "isReadOnly",
  "isPending",
  "selectionMode",
] as const;

/**
 * ADR-281 Decision 1: what the Interactions panel judges a node's When · Do choices by — its
 * declared value of each restricting prop (else what it shows without one: the inherited value or
 * the contract default), as the Preview hands them to RAC.
 */
export function catalogExposureInput(
  graph: Parameters<typeof catalogPropBaseValue>[0],
  target: EditTarget,
): ExposureInput {
  const props: Record<string, unknown> = {};
  try {
    for (const key of EXPOSURE_PROPS) {
      const value =
        readPropSource(graph, target, key).value ??
        catalogPropBaseValue(graph, target, key);
      if (value !== undefined) props[key] = value;
    }
  } catch {
    // (A target the graph no longer holds — nothing restricts.)
  }
  return { props };
}

/** The owner's rules in project order. */
export function catalogInteractionsOf(
  graph: CatalogVariableReader,
  owner: CatalogInteractionOwner,
): InteractionEntry[] {
  const owned: InteractionEntry[] = [];
  for (const id of graph.referrersOf(owner.ownerId)) {
    const entry = graph.getEntry(id);
    if (
      entry?.kind === "interaction" &&
      entry.ownerId === owner.ownerId &&
      sameOwnerAddress(entry.address, owner.address)
    )
      owned.push(entry);
  }
  if (owned.length < 2) return owned;
  const project = graph.getEntry(graph.projectId);
  const order = new Map<string, number>(
    project?.kind === "project"
      ? project.interactionIds.map((id, index) => [id, index])
      : [],
  );
  return owned.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export interface CatalogPageOption {
  id: EntryId<"page">;
  name: string;
  route: string;
}

/** Navigate targets: the project's pages in order. */
export function catalogPageOptions(
  graph: CatalogVariableReader,
): CatalogPageOption[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  return project.pageIds.flatMap((id) => {
    const page = graph.getEntry(id);
    return page?.kind === "page"
      ? [{ id: page.id, name: page.name, route: page.route }]
      : [];
  });
}

export interface CatalogTargetOption {
  id: NodeId;
  type: string;
  name?: string;
  /** A page root (the page body): listed, but not a Do choice's starting target. */
  pageRoot?: true;
}

/** Capability targets: the page's own nodes (depth first) whose type has a capability. */
export function catalogCapabilityTargets(
  graph: CatalogVariableReader,
  pageId: EntryId<"page"> | undefined,
  excludeId?: NodeId,
): CatalogTargetOption[] {
  const page = pageId ? graph.getEntry(pageId) : undefined;
  if (page?.kind !== "page") return [];
  const options: CatalogTargetOption[] = [];
  const visit = (id: NodeId, pageRoot: boolean) => {
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return;
    if (id !== excludeId) {
      const type = catalogTargetTypeName(graph, { kind: "node", id });
      if (type && isCapabilityTarget(type))
        options.push({
          id,
          type,
          ...(node.name ? { name: node.name } : {}),
          ...(pageRoot ? { pageRoot: true as const } : {}),
        });
    }
    for (const child of node.children) visit(child, false);
  };
  for (const root of page.children) visit(root, true);
  return options;
}

export interface CatalogVisibleVariable {
  /** A page/element variable id, or a project variable's reference (`data:variable:<id>`). */
  id: EntryId<"stateVariable"> | `data:variable:${string}`;
  name: string;
  type: CatalogVariableType;
  group: "project" | "page" | "element";
}

/**
 * The variables a setState rule on the owner can set: its own, then its ancestors' (nearest first),
 * then the project variables (the data store's scalar ones, H1). Named RAC states are left out.
 */
export function catalogVisibleVariables(
  graph: CatalogVariableReader,
  ownerId: NodeId,
  projectVariables: readonly { id: string; name: string; type: string }[] = [],
): CatalogVisibleVariable[] {
  return [
    // (A named RAC state follows its component and is read only — no rule sets it.)
    ...catalogVisibleVariableEntries(graph, ownerId)
      .filter((variable) => !variable.source)
      .map((variable) => ({
      id: variable.id,
      name: variable.name,
      type: variable.valueType as CatalogVariableType,
      group: (graph.getEntry(variable.ownerId)?.kind === "page"
        ? "page"
        : "element") as CatalogVisibleVariable["group"],
    })),
    ...projectVariables
      .filter((variable) =>
        ["string", "number", "boolean"].includes(variable.type),
      )
      .map((variable) => ({
        id: `data:variable:${variable.id}` as const,
        name: variable.name,
        type: variable.type as CatalogVariableType,
        group: "project" as const,
      })),
  ];
}

/** The ops a variable type takes (the first is the default). */
export function catalogStateOps(
  type: CatalogVariableType | undefined,
): ("set" | "toggle" | "increment" | "reset")[] {
  if (type === "boolean") return ["toggle", "set", "reset"];
  if (type === "number") return ["increment", "set", "reset"];
  return ["set", "reset"];
}

/** A setState action for the variable and op; `set` always carries a value of the variable's type. */
export function catalogSetStateAction(
  variable: CatalogVisibleVariable,
  op: "set" | "toggle" | "increment" | "reset",
  value?: Scalar,
): CatalogInteractionAction {
  const ops = catalogStateOps(variable.type);
  const next = ops.includes(op) ? op : ops[0]!;
  if (next === "set")
    return {
      opcode: "setState",
      variableId: variable.id,
      op: next,
      value:
        typeof value === variable.type
          ? value
          : catalogEmptyVariableValue(variable.type),
    };
  if (next === "increment" && typeof value === "number")
    return { opcode: "setState", variableId: variable.id, op: next, value };
  return { opcode: "setState", variableId: variable.id, op: next };
}

export interface CatalogActionContext {
  pages: readonly CatalogPageOption[];
  currentPageId: EntryId<"page"> | undefined;
  variables: readonly CatalogVisibleVariable[];
  targets: readonly CatalogTargetOption[];
  /** ADR-281 Decision 5 — the project's API endpoints (the data store's, H1). */
  endpoints?: readonly CatalogEndpointOption[];
  /** The project's collections a rule can append to (the data store's, H1). */
  collections?: readonly CatalogCollectionOption[];
}

export interface CatalogCollectionOption {
  id: DataCollectionId;
  name: string;
}

export interface CatalogEndpointOption {
  id: DataEndpointId;
  name: string;
  method: string;
}

/** The action a Do choice starts from, or undefined when it has nothing to point at. */
/**
 * A list-data action (`append` · `update` · `remove`) starts from what its When gives: a Form's
 * `formData` as the value, a row's `key` (an action) or a selection's `keys` as the key.
 */
export function catalogListDataEventDefaults(
  action: CatalogInteractionAction,
  eventArgs: readonly string[],
): CatalogInteractionAction {
  const has = (name: string) => eventArgs.includes(name);
  if (action.opcode === "append")
    return has("formData") ? { ...action, value: "!event.formData" } : action;
  if (action.opcode === "update")
    return {
      ...action,
      ...(has("key") ? { key: "!event.key" } : {}),
      ...(has("formData") ? { value: "!event.formData" } : {}),
    };
  if (action.opcode === "remove")
    return has("key")
      ? { ...action, keys: "!event.key" }
      : has("keys")
        ? { ...action, keys: "!event.keys" }
        : action;
  return action;
}

export function catalogDefaultAction(
  choice: CatalogActionChoice,
  context: CatalogActionContext,
): CatalogInteractionAction | undefined {
  if (choice === "navigate") {
    const page =
      context.pages.find((option) => option.id !== context.currentPageId) ??
      context.pages[0];
    return page ? { opcode: "navigate", pageId: page.id } : undefined;
  }
  if (choice === "toast") return { opcode: "toast", message: "" };
  if (choice === "setState") {
    const variable = context.variables[0];
    return variable
      ? catalogSetStateAction(variable, catalogStateOps(variable.type)[0]!)
      : undefined;
  }
  if (choice === "callEndpoint") {
    // (A body goes with a method that carries one — a GET endpoint is offered last.)
    const endpoint =
      context.endpoints?.find((option) => option.method !== "GET") ??
      context.endpoints?.[0];
    return endpoint
      ? { opcode: "callEndpoint", endpointId: endpoint.id }
      : undefined;
  }
  if (
    choice === "append" ||
    choice === "update" ||
    choice === "remove" ||
    choice === "reload" ||
    choice === "loadMore" ||
    choice === "setFilterText"
  ) {
    const collection = context.collections?.[0];
    return collection ? { opcode: choice, collectionId: collection.id } : undefined;
  }
  if (choice === "capability") {
    const target =
      context.targets.find((option) => !option.pageRoot) ?? context.targets[0];
    return target
      ? { opcode: "capability", targetId: target.id, capabilityId: "hide" }
      : undefined;
  }
  return undefined;
}

export function catalogNewInteraction(
  owner: CatalogInteractionOwner,
  trigger: string,
  action: CatalogInteractionAction,
  newId: NewId,
): InteractionEntry {
  return {
    kind: "interaction",
    id: newId("interaction") as EntryId<"interaction">,
    ownerId: owner.ownerId,
    ...(owner.address ? { address: owner.address } : {}),
    trigger,
    action,
  };
}

export const catalogInteractionsCommand = (
  owner: CatalogInteractionOwner,
  entries: readonly InteractionEntry[],
  label: string,
): CatalogCommand =>
  setNodeInteractions({
    ownerId: owner.ownerId,
    ...(owner.address ? { address: owner.address } : {}),
    entries,
    label,
  });

/** ADR-281 Decision 4 — a component's rule as one instance position sees it. */
export interface CatalogInheritedInteraction {
  rule: InteractionEntry;
  status: CatalogInteractionStatus;
}

/**
 * The position an owner stands at in its component (the instance root: its template root; a
 * descendant: the end of its template path), or undefined for a node that is not a project
 * component's instance.
 */
function inheritedPosition(
  graph: CatalogVariableReader,
  owner: CatalogInteractionOwner,
): { sourceId: NodeId; address: InstanceAddress } | undefined {
  if (owner.address) {
    const sourceId = owner.address.templatePath.at(-1);
    return sourceId?.startsWith("project:node:")
      ? { sourceId: sourceId as NodeId, address: owner.address }
      : undefined;
  }
  const node = graph.getEntry(owner.ownerId);
  if (node?.kind !== "node") return undefined;
  const definition = graph.getEntry(node.definitionId as never);
  if (
    definition?.kind !== "definition" ||
    definition.mode !== "composite" ||
    !definition.templateRootId?.startsWith("project:node:")
  )
    return undefined;
  const sourceId = definition.templateRootId as NodeId;
  return {
    sourceId,
    address: { instances: [owner.ownerId], templatePath: [sourceId] },
  };
}

/**
 * ADR-281 Decision 4: the rules an instance position inherits from its component's template node,
 * each with what this instance does with it — the same `effectiveInteractionsOf` the Preview reads.
 */
export function catalogInheritedInteractionsOf(
  graph: CatalogVariableReader,
  owner: CatalogInteractionOwner,
): CatalogInheritedInteraction[] {
  const position = inheritedPosition(graph, owner);
  if (!position) return [];
  const get = (id: string) => graph.getEntry(id as never);
  return effectiveInteractionsOf(
    get,
    catalogInteractionsOf(graph, { ownerId: position.sourceId }),
    catalogInteractionOverridesAt(get, position.address),
  );
}

/** The `upsertDescendant` op writing an instance position's map (empty map = cleared). */
function overrideMapOp(
  address: InstanceAddress,
  map: Readonly<Record<string, "off" | EntryId<"interaction">>>,
) {
  const empty = !Object.keys(map).length;
  return {
    kind: "upsertDescendant" as const,
    id: address.instances[0] as NodeId,
    override: {
      kind: "patch" as const,
      address,
      ...(empty
        ? {}
        : {
            interactions: map as Readonly<
              Record<EntryId<"interaction">, "off" | EntryId<"interaction">>
            >,
          }),
    },
    ...(empty ? { clear: ["interactions" as const] } : {}),
  };
}

/**
 * Turn an inherited rule off (or back on) at this instance position — one history step. Turning it
 * on drops the position's entry (a replacement rule it pointed at stays the owner's own).
 */
export const catalogInheritedRuleEnabledCommand =
  (
    owner: CatalogInteractionOwner,
    ruleId: EntryId<"interaction">,
    enabled: boolean,
  ): CatalogCommand =>
  (reader) => {
    const position = inheritedPosition(reader as CatalogVariableReader, owner);
    if (!position) throw new Error("NOT_AN_INSTANCE_POSITION");
    const get = (id: string) => reader.getEntry(id as never);
    const map: Record<string, "off" | EntryId<"interaction">> = {
      ...catalogInteractionOverridesAt(get, position.address),
    };
    if (enabled) delete map[ruleId];
    else map[ruleId] = "off";
    return {
      label: enabled ? "Turn inherited rule on" : "Turn inherited rule off",
      ops: [overrideMapOp(position.address, map)],
    };
  };

/**
 * 「이 instance 에서 바꾸기」 — a copy of the inherited rule as the owner's own rule, mapped to run
 * instead of it at this position (one history step). The copy is then edited as any own rule.
 */
export const catalogReplaceInheritedRuleCommand =
  (
    owner: CatalogInteractionOwner,
    rule: InteractionEntry,
    newId: NewId,
  ): CatalogCommand =>
  (reader) => {
    const position = inheritedPosition(reader as CatalogVariableReader, owner);
    if (!position) throw new Error("NOT_AN_INSTANCE_POSITION");
    const copy = catalogNewInteraction(owner, rule.trigger, rule.action, newId);
    const own = catalogInteractionsOf(reader as CatalogVariableReader, owner);
    const planned = catalogInteractionsCommand(
      owner,
      [...own, copy],
      "Replace inherited rule",
    )(reader);
    const get = (id: string) => reader.getEntry(id as never);
    return {
      label: "Replace inherited rule",
      ops: [
        ...planned.ops,
        overrideMapOp(position.address, {
          ...catalogInteractionOverridesAt(get, position.address),
          [rule.id]: copy.id,
        }),
      ],
    };
  };

