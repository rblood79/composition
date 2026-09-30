import {
  addRecord,
  removeRecords,
  updateRecord,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  EntryId,
  NodeId,
  Scalar,
  StateVariableEntry,
} from "../../../../../packages/shared/src/catalog/document/types";

/** The graph reads the State section needs (`CatalogGraph` is one). */
export interface CatalogVariableReader extends CatalogReader {
  ownerOf(id: string): string | undefined;
  referrersOf(id: string): ReadonlySet<string>;
}

export type CatalogVariableOwnerId = EntryId<"page"> | NodeId;
export type CatalogVariableType = "string" | "number" | "boolean";
export const CATALOG_VARIABLE_TYPES: readonly CatalogVariableType[] = [
  "string",
  "number",
  "boolean",
];

/** The owner a node's State section edits: a page body's variables belong to its page. */
export function catalogVariableOwner(
  graph: CatalogVariableReader,
  nodeId: NodeId,
): CatalogVariableOwnerId {
  const owner = graph.ownerOf(nodeId);
  return owner && graph.getEntry(owner)?.kind === "page"
    ? (owner as EntryId<"page">)
    : nodeId;
}

/** The owner itself, then its node ancestors up to the page (the visibility chain). */
function ownerChain(
  graph: CatalogVariableReader,
  ownerId: string,
): readonly string[] {
  const chain: string[] = [];
  for (let id: string | undefined = ownerId; id; id = graph.ownerOf(id)) {
    const entry = graph.getEntry(id);
    if (entry?.kind !== "node" && entry?.kind !== "page") break;
    chain.push(id);
    if (entry.kind === "page") break;
  }
  return chain;
}

function variablesOwnedBy(
  graph: CatalogVariableReader,
  ownerId: string,
): StateVariableEntry[] {
  const variables: StateVariableEntry[] = [];
  for (const id of graph.referrersOf(ownerId)) {
    const entry = graph.getEntry(id);
    if (entry?.kind === "stateVariable" && entry.ownerId === ownerId)
      variables.push(entry);
  }
  return variables;
}

/** The owner's own variables. */
export function catalogOwnVariables(
  graph: CatalogVariableReader,
  ownerId: CatalogVariableOwnerId,
): StateVariableEntry[] {
  return variablesOwnedBy(graph, ownerId);
}

/** Variables the owner sees from its ancestors (nearest first). */
export function catalogAncestorVariables(
  graph: CatalogVariableReader,
  ownerId: CatalogVariableOwnerId,
): StateVariableEntry[] {
  return ownerChain(graph, ownerId)
    .slice(1)
    .flatMap((id) => variablesOwnedBy(graph, id));
}

/**
 * A variable with the same name on the owner's chain — an ancestor, the owner itself or a
 * descendant (names stay unique wherever one owner can see the other). Reads only variables.
 */
export function catalogVariableNameConflict(
  graph: CatalogVariableReader,
  ownerId: CatalogVariableOwnerId,
  name: string,
  excludeId?: string,
): StateVariableEntry | undefined {
  const target = name.trim();
  if (!target) return undefined;
  const chain = new Set(ownerChain(graph, ownerId));
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return undefined;
  for (const id of project.stateVariableIds) {
    if (id === excludeId) continue;
    const entry = graph.getEntry(id);
    if (entry?.kind !== "stateVariable" || entry.name.trim() !== target)
      continue;
    if (
      chain.has(entry.ownerId) ||
      ownerChain(graph, entry.ownerId).includes(ownerId)
    )
      return entry;
  }
  return undefined;
}

/** Interactions that set the variable (the delete confirmation's count; they go with it). */
export function catalogVariableUsageCount(
  graph: CatalogVariableReader,
  variableId: string,
): number {
  let count = 0;
  for (const id of graph.referrersOf(variableId))
    if (graph.getEntry(id)?.kind === "interaction") count++;
  return count;
}

/** `state1`, `state2`, … — the first name no variable on the chain uses. */
export function catalogNextVariableName(
  graph: CatalogVariableReader,
  ownerId: CatalogVariableOwnerId,
): string {
  for (let n = 1; ; n++) {
    const name = `state${n}`;
    if (!catalogVariableNameConflict(graph, ownerId, name)) return name;
  }
}

export function catalogEmptyVariableValue(type: CatalogVariableType): Scalar {
  return type === "number" ? 0 : type === "boolean" ? false : "";
}

/** A default-value input for its type, or undefined when it does not parse (never a silent 0). */
export function catalogParseVariableValue(
  type: CatalogVariableType,
  raw: string,
): Scalar | undefined {
  if (type === "string") return raw;
  if (type === "boolean") return raw.trim() === "true";
  const text = raw.trim();
  if (text === "") return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * ADR-248 Phase 4e-4: the State section's commands — each one history step. Changing the type
 * resets the default to the new type's empty value; delete also removes the interactions that set
 * the variable.
 */
export const catalogVariableCommands = {
  add: (
    ownerId: CatalogVariableOwnerId,
    name: string,
    newId: NewId,
  ): CatalogCommand =>
    addRecord({
      entry: {
        kind: "stateVariable",
        id: newId("stateVariable") as EntryId<"stateVariable">,
        ownerId,
        name,
        valueType: "string",
        defaultValue: "",
      },
    }),
  rename: (variable: StateVariableEntry, name: string): CatalogCommand =>
    updateRecord({ entry: { ...variable, name }, label: "Rename variable" }),
  setType: (
    variable: StateVariableEntry,
    type: CatalogVariableType,
  ): CatalogCommand =>
    updateRecord({
      entry: {
        ...variable,
        valueType: type,
        defaultValue: catalogEmptyVariableValue(type),
      },
      label: "Edit variable",
    }),
  setDefault: (variable: StateVariableEntry, value: Scalar): CatalogCommand =>
    updateRecord({
      entry: { ...variable, defaultValue: value },
      label: "Edit variable",
    }),
  remove: (variableId: EntryId<"stateVariable">): CatalogCommand =>
    removeRecords({ ids: [variableId], label: "Delete variable" }),
};
