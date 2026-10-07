import {
  collectPropsStateRefs,
  hasStateTemplateSyntax,
  resolveStateTemplateProps,
  type RuntimeScope,
  type StateTemplateEnv,
  type VariableDef,
  type VariableDefType,
  type VisibleVariable,
} from "@composition/shared";
import type { CatalogGraph } from "../document/graph";
import type { EntryId, StateVariableEntry, ValueType } from "../document/types";

/** A project variable's reference in the catalog document (`data:variable:<id>`). */
const PROJECT_VARIABLE = "data:variable:";

/**
 * Where `{{ name }}` values come from (ADR-214 over the catalog document). The Canvas reads the
 * defaults (no `read`); the Preview reads its runtime values.
 */
export interface CatalogStateSource {
  /** The project variables (the data store's, H1) in their shared definition shape. */
  projectVariables(): readonly VariableDef[];
  /** A variable's runtime value in a scope; `undefined` = its default. */
  read?(variableId: string, scope: RuntimeScope): unknown;
}

/** One variable a record sees, with the scope its value lives in. */
export interface CatalogVisibleState {
  /** The `stateVariable` record id, or a project variable's `data:variable:<id>`. */
  id: string;
  name: string;
  type: VariableDefType;
  defaultValue?: unknown;
  scope: RuntimeScope;
}

/** The part of a record the chain reads. */
export interface CatalogStateRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly parentId: string;
  readonly collapsedSourceIds?: readonly string[];
}

function ownedVariables(
  graph: CatalogGraph,
  ownerId: string,
): StateVariableEntry[] {
  const out: StateVariableEntry[] = [];
  for (const id of graph.referrersOf(ownerId)) {
    const entry = graph.getEntry(id);
    if (entry?.kind === "stateVariable" && entry.ownerId === ownerId)
      out.push(entry);
  }
  return out;
}

/** A catalog value type in the shared variable model (structured values are arrays). */
function variableType(type: ValueType): VariableDefType {
  return type === "string[]" || type === "items"
    ? "array"
    : type === "slot"
      ? "string"
      : type;
}

function defaultOf(type: VariableDefType, value: unknown): unknown {
  if (value !== undefined) return value;
  return type === "number"
    ? 0
    : type === "boolean"
      ? false
      : type === "object"
        ? {}
        : type === "array"
          ? []
          : "";
}

/**
 * The variables a record sees, nearest first: the element variables of every node on its record
 * chain (each owner's value lives under the record that draws it — two instances keep their own
 * values), its page's, then the project's.
 */
export function catalogRecordVariables(
  graph: CatalogGraph,
  record: CatalogStateRecord,
  get: (id: string) => CatalogStateRecord | undefined,
  pageId: EntryId<"page"> | undefined,
  projectVariables: readonly VariableDef[],
): CatalogVisibleState[] {
  const out: CatalogVisibleState[] = [];
  const seen = new Set<string>();
  for (
    let cursor: CatalogStateRecord | undefined = record;
    cursor && !seen.has(cursor.id);
    cursor = get(cursor.parentId)
  ) {
    seen.add(cursor.id);
    const instanceKey = cursor.id;
    for (const sourceId of [
      cursor.sourceId,
      ...(cursor.collapsedSourceIds ?? []),
    ])
      for (const variable of ownedVariables(graph, sourceId))
        out.push({
          id: variable.id,
          name: variable.name,
          type: variableType(variable.valueType),
          defaultValue: variable.defaultValue,
          scope: { kind: "element", instanceKey },
        });
  }
  if (pageId)
    for (const variable of ownedVariables(graph, pageId))
      out.push({
        id: variable.id,
        name: variable.name,
        type: variableType(variable.valueType),
        defaultValue: variable.defaultValue,
        scope: { kind: "page", pageId },
      });
  for (const variable of projectVariables)
    out.push({
      id: `${PROJECT_VARIABLE}${variable.id}`,
      name: variable.name,
      type: variable.type,
      defaultValue: variable.defaultValue,
      scope: { kind: "project" },
    });
  return out;
}

/** The `{{ }}` environment of a visible list: nearest name wins; unknown names stay as written. */
export function catalogStateEnv(
  visible: readonly CatalogVisibleState[],
  read?: CatalogStateSource["read"],
): StateTemplateEnv {
  const byName = new Map<string, CatalogVisibleState>();
  for (const entry of visible)
    if (!byName.has(entry.name)) byName.set(entry.name, entry);
  return {
    get(name) {
      const entry = byName.get(name);
      if (!entry) return undefined;
      return (
        read?.(entry.id, entry.scope) ??
        defaultOf(entry.type, entry.defaultValue)
      );
    },
  };
}

/**
 * Props with their `{{ }}` templates resolved, or `undefined` when they have none. `authored`
 * keeps the written props (the text editor edits those, never a value).
 */
export function catalogStateProps<T extends Record<string, unknown>>(
  authored: T,
  env: () => StateTemplateEnv,
): T | undefined {
  if (!hasStateTemplateSyntax(authored)) return undefined;
  return resolveStateTemplateProps(authored, env());
}

/** Names a record's authored props read (a refresh re-resolves only those readers). */
export function catalogStateNames(authored: Record<string, unknown>): string[] {
  return collectPropsStateRefs(authored);
}

/**
 * Every page and element variable of the document plus the project's, as the shared runtime
 * state's definitions (ADR-214 value model: ops, types, persistence of project variables).
 */
export function catalogRuntimeVariables(
  graph: CatalogGraph,
  projectVariables: readonly VariableDef[],
): VisibleVariable[] {
  const out: VisibleVariable[] = projectVariables.map((variable) => ({
    def: { ...variable, id: `${PROJECT_VARIABLE}${variable.id}` },
    owner: { kind: "project" },
  }));
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return out;
  for (const id of project.stateVariableIds) {
    const variable = graph.getEntry(id);
    if (variable?.kind !== "stateVariable") continue;
    const owner = graph.getEntry(variable.ownerId);
    out.push({
      def: {
        id: variable.id,
        name: variable.name,
        type: variableType(variable.valueType),
        defaultValue: variable.defaultValue,
      },
      owner:
        owner?.kind === "page"
          ? { kind: "page", pageId: owner.id }
          : { kind: "element", elementId: variable.ownerId },
    });
  }
  return out;
}
