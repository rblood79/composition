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
  /**
   * The shown path's route params (`{{ params.id }}` — a `:id` route segment, the router's
   * `useParams`). Absent (the Canvas) = `{{ params.… }}` stays as written.
   */
  params?(): Readonly<Record<string, string>>;
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
/** A document variable's default: a structured one's `""` is nothing yet (`null`). */
function documentDefault(variable: {
  valueType: ValueType | "object" | "array";
  defaultValue: unknown;
}): unknown {
  return (variable.valueType === "object" || variable.valueType === "array") &&
    variable.defaultValue === ""
    ? null
    : variable.defaultValue;
}

function variableType(type: ValueType | "object" | "array"): VariableDefType {
  if (type === "object" || type === "array") return type;
  return type === "string[]" || type === "items"
    ? "array"
    : type === "slot"
      ? "string"
      : // (ADR-257 Column widths are no variable type: a state variable is a scalar of its own.)
        type === "columnSize" ||
          type === "columnStaticSize" ||
          // (ADR-258: nor a RAC color — a state variable of its own is a string.)
          type === "racColor"
        ? "string"
        : // (ADR-256 Phase 9: nor a calendar duration · number format — objects of their own.)
          type === "calendarDuration" || type === "numberFormat"
          ? "object"
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
          defaultValue: documentDefault(variable),
          scope: { kind: "element", instanceKey },
        });
  }
  if (pageId)
    for (const variable of ownedVariables(graph, pageId))
      out.push({
        id: variable.id,
        name: variable.name,
        type: variableType(variable.valueType),
        defaultValue: documentDefault(variable),
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

/** The template root of the shown path's route params (`{{ params.id }}`). */
export const CATALOG_PARAMS_ROOT = "params";

/** The `{{ }}` environment of a visible list: nearest name wins; unknown names stay as written. */
export function catalogStateEnv(
  visible: readonly CatalogVisibleState[],
  read?: CatalogStateSource["read"],
  params?: CatalogStateSource["params"],
): StateTemplateEnv {
  const byName = new Map<string, CatalogVisibleState>();
  for (const entry of visible)
    if (!byName.has(entry.name)) byName.set(entry.name, entry);
  return {
    get(name) {
      const entry = byName.get(name);
      // (A variable named `params` wins — the route params are the root no variable took.)
      if (!entry) return name === CATALOG_PARAMS_ROOT ? params?.() : undefined;
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

/**
 * A keyed binding's key (`binding.key` — `useListData.getItem(key)`): a literal, or `{{ }}` over the
 * bound node's page variables, the project's and the route params. A whole-template key keeps its
 * value's kind — a selection (an array) gives its first key. `undefined` = nothing to read here
 * (the Canvas has no route and no runtime values): the caller shows a sample item.
 */
export function catalogBindingKey(
  graph: CatalogGraph,
  key: string,
  ownerId: string | undefined,
  source: CatalogStateSource | undefined,
): string | undefined {
  if (!hasStateTemplateSyntax({ key })) return key;
  const visible = pageAndProjectStates(graph, ownerId, source);
  const env = catalogStateEnv(
    visible,
    source?.read?.bind(source),
    source?.params?.bind(source),
  );
  const runtime = source?.read !== undefined;
  const whole = /^\{\{\s*([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)\s*\}\}$/.exec(
    key.trim(),
  );
  if (whole) {
    let value = env.get(whole[1]!);
    for (const segment of (whole[2] ?? "").split(".").filter(Boolean))
      value =
        value !== null && typeof value === "object"
          ? (value as Record<string, unknown>)[segment]
          : undefined;
    if (Array.isArray(value)) value = value[0];
    if (typeof value === "number") return String(value);
    if (typeof value !== "string") return undefined;
    return value === "" && !runtime ? undefined : value;
  }
  const text = resolveStateTemplateProps({ key }, env).key;
  return hasStateTemplateSyntax({ key: text }) ? undefined : text;
}

/** The bound node's page variables and the project's (what a binding's key · view reads). */
function pageAndProjectStates(
  graph: CatalogGraph,
  ownerId: string | undefined,
  source: CatalogStateSource | undefined,
): CatalogVisibleState[] {
  const visible: CatalogVisibleState[] = [];
  for (let id = ownerId; id; id = graph.ownerOf(id)) {
    if (graph.getEntry(id)?.kind !== "page") continue;
    const pageId = id as EntryId<"page">;
    for (const variable of ownedVariables(graph, pageId))
      visible.push({
        id: variable.id,
        name: variable.name,
        type: variableType(variable.valueType),
        defaultValue: documentDefault(variable),
        scope: { kind: "page", pageId },
      });
    break;
  }
  for (const variable of source?.projectVariables() ?? [])
    visible.push({
      id: `${PROJECT_VARIABLE}${variable.id}`,
      name: variable.name,
      type: variable.type,
      defaultValue: variable.defaultValue,
      scope: { kind: "project" },
    });
  return visible;
}

/**
 * ADR-284 — a variable's value by id as a view reads it (`!var.<id>` — a condition's value · a
 * sort): the bound node's page variable or the project's; the runtime value (Preview · Publish)
 * else its default (the Canvas). Undefined = no such variable there (the condition is broken).
 */
export function catalogVariableValue(
  graph: CatalogGraph,
  variableId: string,
  ownerId: string | undefined,
  source: CatalogStateSource | undefined,
): { value: unknown; name: string } | undefined {
  const entry = pageAndProjectStates(graph, ownerId, source).find(
    (item) => item.id === variableId,
  );
  if (!entry) return undefined;
  return {
    value:
      source?.read?.(entry.id, entry.scope) ??
      defaultOf(entry.type, entry.defaultValue),
    name: entry.name,
  };
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
        defaultValue: documentDefault(variable),
      },
      owner:
        owner?.kind === "page"
          ? { kind: "page", pageId: owner.id }
          : { kind: "element", elementId: variable.ownerId },
    });
  }
  return out;
}
