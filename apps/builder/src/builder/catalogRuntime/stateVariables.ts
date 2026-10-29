import { parseDateValue } from "../../../../../packages/shared/src/state/dateValue";
import {
  addRecord,
  removeRecords,
  updateRecord,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import {
  normalizeImplicitStateValue,
  resolveImplicitStateSources,
} from "../../../../../packages/shared/src/state/implicitState";
import type { VariableDefType } from "../../../../../packages/shared/src/state/variable.types";
import type {
  CatalogReader,
  DefinitionId,
  EntryId,
  NodeId,
  Scalar,
  StateVariableEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import { renameVariable } from "../../../../../packages/shared/src/catalog/commands/variables";
import { variableDefaultForType } from "../../../../../packages/shared/src/catalog/runtime/variableTypeChange";
import {
  variableNameTaken,
  variableReferenceCount,
} from "../../../../../packages/shared/src/catalog/runtime/variableReferences";
import type { ProjectVariableEntry } from "../../../../../packages/shared/src/catalog/document/types";
import { catalogSettingsPage } from "./pageSettings";

/** The graph reads the State section needs (`CatalogGraph` is one). */
export interface CatalogVariableReader extends CatalogReader {
  ownerOf(id: string): string | undefined;
  referrersOf(id: string): ReadonlySet<string>;
}

export type CatalogVariableOwnerId = EntryId<"page"> | NodeId;
/**
 * `object` · `array` hold what a rule's reference writes (a selected row); they start empty.
 * `date` is an ISO date text (shared `state/dateValue.ts`), `""` = none.
 */
export type CatalogVariableType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "object"
  | "array";
export const CATALOG_VARIABLE_TYPES: readonly CatalogVariableType[] = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
];

/** A variable whose value is structured — no literal default, a rule's reference fills it. */
export const catalogStructuredVariableType = (type: string) =>
  type === "object" || type === "array";

/**
 * The owner a node's State section edits: a page root's (and a page body's, also inside a layout
 * slot) variables belong to its page.
 */
export function catalogVariableOwner(
  graph: CatalogVariableReader,
  nodeId: NodeId,
): CatalogVariableOwnerId {
  return catalogSettingsPage(graph, nodeId) ?? nodeId;
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

/** The variables a node sees: its owner's own, then its ancestors' (nearest first). */
export function catalogVisibleVariableEntries(
  graph: CatalogVariableReader,
  nodeId: NodeId,
): StateVariableEntry[] {
  const owner = catalogVariableOwner(graph, nodeId);
  return [
    ...catalogOwnVariables(graph, owner),
    ...catalogAncestorVariables(graph, owner),
  ];
}

/**
 * A variable with the same name on the owner's chain — an ancestor, the owner itself or a
 * descendant (names stay unique wherever one owner can see the other) — or a project variable
 * (the end of every chain — ADR-288 R8). The `renameVariable` command makes the same judgment.
 */
export function catalogVariableNameConflict(
  graph: CatalogVariableReader,
  ownerId: CatalogVariableOwnerId,
  name: string,
  excludeId?: string,
): StateVariableEntry | ProjectVariableEntry | undefined {
  return variableNameTaken(
    graph,
    { kind: "stateVariable", ownerId, ...(excludeId ? { id: excludeId } : {}) },
    name,
  );
}

/**
 * How many places use the variable: the interactions that set it (they go with it on delete)
 * and the `{{ name }}` templates the runtime resolves to it (ADR-288 — the rename's judgment).
 */
export function catalogVariableUsageCount(
  graph: CatalogVariableReader,
  variableId: string,
): number {
  let count = 0;
  for (const id of graph.referrersOf(variableId))
    if (graph.getEntry(id)?.kind === "interaction") count++;
  return count + variableReferenceCount(graph, variableId);
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
  // (A structured variable's `""` is nothing yet — the runtime reads `null`.)
  return type === "number" ? 0 : type === "boolean" ? false : "";
}

/** A default-value input for its type, or undefined when it does not parse (never a silent 0). */
export function catalogParseVariableValue(
  type: CatalogVariableType,
  raw: string,
): Scalar | undefined {
  if (type === "string") return raw;
  if (catalogStructuredVariableType(type)) return "";
  if (type === "boolean") return raw.trim() === "true";
  if (type === "date") {
    const text = raw.trim();
    return text === "" || parseDateValue(text) ? text : undefined;
  }
  const text = raw.trim();
  if (text === "") return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** The page a node is on (a named RAC state's owner); none for a component's template. */
export function catalogNodePage(
  graph: CatalogVariableReader,
  nodeId: NodeId,
): EntryId<"page"> | undefined {
  for (let id = graph.ownerOf(nodeId); id; id = graph.ownerOf(id))
    if (graph.getEntry(id)?.kind === "page") return id as EntryId<"page">;
  return undefined;
}

/** A RAC state a node can name (the old implicit state), and the variable that names it. */
export interface CatalogStateSource {
  prop: string;
  type: VariableDefType;
  variable?: StateVariableEntry;
}

/**
 * The RAC states a node's component has (Tabs' selected key, a collection's selected keys, a
 * Switch's selection …) with the variables naming them — none off a page.
 */
export function catalogNodeStateSources(
  graph: CatalogVariableReader,
  nodeId: NodeId,
  /** The node's component type when the caller has it (its edit contract's) — no document read. */
  type?: string,
): CatalogStateSource[] {
  // (The Design panel reads this on every render of a selection — ADR-246 ratchet: once per node
  // and revision, the type first and once per definition, so a node without RAC states costs one
  // entry read.)
  const last = lastSources;
  if (
    last &&
    last.graph === graph &&
    last.revision === graph.revision &&
    last.nodeId === nodeId
  )
    return last.result;
  const result = nodeStateSources(graph, nodeId, type);
  lastSources = { graph, revision: graph.revision, nodeId, result };
  return result;
}

let lastSources:
  | {
      graph: CatalogVariableReader;
      revision: number;
      nodeId: NodeId;
      result: CatalogStateSource[];
    }
  | undefined;

function nodeStateSources(
  graph: CatalogVariableReader,
  nodeId: NodeId,
  type: string | undefined,
): CatalogStateSource[] {
  let sources: ReturnType<typeof resolveImplicitStateSources>;
  if (type !== undefined) sources = resolveImplicitStateSources(type);
  else {
    const node = graph.getEntry(nodeId);
    if (node?.kind !== "node") return [];
    sources = implicitSourcesOf(graph, node.definitionId as DefinitionId);
  }
  if (!sources.length || !catalogNodePage(graph, nodeId)) return [];
  const named = new Map<string, StateVariableEntry>();
  for (const id of graph.referrersOf(nodeId)) {
    const entry = graph.getEntry(id);
    if (entry?.kind === "stateVariable" && entry.source?.nodeId === nodeId)
      named.set(entry.source.prop, entry);
  }
  return sources.map((source) => ({
    prop: source.prop,
    type: source.type,
    ...(named.has(source.prop) ? { variable: named.get(source.prop)! } : {}),
  }));
}

/** A definition's RAC states, per library (a definition's root type does not change). */
const sourcesByDefinition = new WeakMap<
  object,
  Map<string, ReturnType<typeof resolveImplicitStateSources>>
>();
function implicitSourcesOf(
  graph: CatalogVariableReader,
  definitionId: DefinitionId,
): ReturnType<typeof resolveImplicitStateSources> {
  let cache = sourcesByDefinition.get(graph.library);
  if (!cache) sourcesByDefinition.set(graph.library, (cache = new Map()));
  let sources = cache.get(definitionId);
  if (!sources) {
    try {
      sources = resolveImplicitStateSources(
        definitionTypeName(graph, definitionId),
      );
    } catch {
      sources = [];
    }
    cache.set(definitionId, sources);
  }
  return sources;
}

/** A named RAC state's value as a stored default (keys as strings; a number else 0). */
function sourceDefault(
  type: VariableDefType,
  raw: unknown,
): Scalar | readonly string[] {
  // (RAC's selection is a Set — the observer's conversion, `normalizeImplicitStateValue`.)
  const value = normalizeImplicitStateValue(type, raw);
  if (type === "array")
    return Array.isArray(value) ? value.map(String) : [];
  if (type === "number")
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (type === "boolean") return value === true;
  return value === undefined || value === null ? "" : String(value);
}

/**
 * ADR-248 Phase 4e-4: the State section's commands — each one history step. Changing the type
 * keeps a default that fits the new type and empties one that does not (ADR-288 — the same rule
 * as a project variable's); delete also removes the interactions that set the variable.
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
  /** ADR-288 — the rename rewrites every `{{ old }}` that read this variable (one step). */
  rename: (variable: StateVariableEntry, name: string): CatalogCommand =>
    renameVariable({ variableId: variable.id, name }),
  /** ADR-288 결정 1 — a default that fits the new type stays (converted), else the type's empty. */
  setType: (
    variable: StateVariableEntry,
    type: CatalogVariableType,
  ): CatalogCommand =>
    updateRecord({
      entry: {
        ...variable,
        valueType: type,
        defaultValue: variableDefaultForType(
          type,
          variable.defaultValue,
          "state",
        ) as Scalar,
      },
      label: "Edit variable",
    }),
  setDefault: (variable: StateVariableEntry, value: Scalar): CatalogCommand =>
    updateRecord({
      entry: { ...variable, defaultValue: value },
      label: "Edit variable",
    }),
  /**
   * A structured variable's JSON default (2026-10-29 — the State section edits it like the
   * project's): `undefined` empties it (`""`); the stored type follows the value (an array →
   * `array`, an object → `object`) in the same step.
   */
  setJsonDefault: (
    variable: StateVariableEntry,
    value: unknown,
  ): CatalogCommand =>
    updateRecord({
      entry: {
        ...variable,
        valueType:
          value === undefined
            ? variable.valueType
            : Array.isArray(value)
              ? "array"
              : "object",
        defaultValue: (value === undefined
          ? ""
          : value) as StateVariableEntry["defaultValue"],
      },
      label: "Edit variable",
    }),
  /**
   * Name a node's RAC state (the old implicit state): a variable of the node's page that follows
   * the state at run time, read only; its default is the component's value now.
   */
  nameSource: (
    pageId: EntryId<"page">,
    nodeId: NodeId,
    source: Pick<CatalogStateSource, "prop" | "type">,
    value: unknown,
    name: string,
    newId: NewId,
  ): CatalogCommand =>
    addRecord({
      entry: {
        kind: "stateVariable",
        id: newId("stateVariable") as EntryId<"stateVariable">,
        ownerId: pageId,
        name,
        valueType:
          source.type === "array"
            ? "string[]"
            : (source.type as CatalogVariableType),
        defaultValue: sourceDefault(source.type, value),
        source: { nodeId, prop: source.prop },
      },
      label: "Name state",
    }),
  remove: (variableId: EntryId<"stateVariable">): CatalogCommand =>
    removeRecords({ ids: [variableId], label: "Delete variable" }),
};
