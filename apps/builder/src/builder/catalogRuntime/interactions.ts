import { isCapabilityTarget } from "@composition/shared";
import { setNodeInteractions } from "../../../../../packages/shared/src/catalog/commands";
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
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogTargetDefinitionId } from "./editContract";
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
 * then the project variables (the data store's scalar ones, H1).
 */
export function catalogVisibleVariables(
  graph: CatalogVariableReader,
  ownerId: NodeId,
  projectVariables: readonly { id: string; name: string; type: string }[] = [],
): CatalogVisibleVariable[] {
  return [
    ...catalogVisibleVariableEntries(graph, ownerId).map((variable) => ({
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
}

/** The action a Do choice starts from, or undefined when it has nothing to point at. */
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
