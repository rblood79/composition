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
import type {
  EntryId,
  PropVar,
  PropWhen,
  StateVariableEntry,
  ValueType,
} from "../document/types";
import { isPropVar, isPropWhen } from "../document/valueType";
import { viewCompare } from "../../collections/view/comparison";
import { instancePathBoundaries, resolveInputVariable } from "./inputVariable";

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
  /**
   * The record an element variable's value lives under (`RuntimeScope` element `instanceKey`) for
   * a reader at this resolution path: the record drawing the variable's owner there. Absent = the
   * owner's id (no runtime value — its default).
   */
  elementKey?(ownerId: string, instancePath: readonly string[]): string | undefined;
}

/** One variable a record sees, with the scope its value lives in. */
export interface CatalogVisibleState {
  /** The `stateVariable` record id, or a project variable's `data:variable:<id>`. */
  id: string;
  name: string;
  type: VariableDefType;
  defaultValue?: unknown;
  scope: RuntimeScope;
  /**
   * ADR-294 — a component's input variable read where it sits (the instance's value): wins over
   * the runtime value and the default.
   */
  derived?: () => { value: unknown } | undefined;
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
  valueType: ValueType | "object" | "array" | "date";
  defaultValue: unknown;
}): unknown {
  return (variable.valueType === "object" || variable.valueType === "array") &&
    variable.defaultValue === ""
    ? null
    : variable.defaultValue;
}

function variableType(
  type: ValueType | "object" | "array" | "date",
): VariableDefType {
  if (type === "object" || type === "array" || type === "date") return type;
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

/** A `{{ }}` environment that also reads a variable by id (a value condition's `!var.<id>`). */
export interface CatalogStateEnv extends StateTemplateEnv {
  /** A visible variable's value (and its type) by id; undefined = not visible here. */
  byId(id: string): { value: unknown; type?: string } | undefined;
}

/** The `{{ }}` environment of a visible list: nearest name wins; unknown names stay as written. */
export function catalogStateEnv(
  visible: readonly CatalogVisibleState[],
  read?: CatalogStateSource["read"],
  params?: CatalogStateSource["params"],
  /** ADR-294 — the input variable values (a record's — `resolveInputVariableAt`). */
  derive?: (entry: CatalogVisibleState) => { value: unknown } | undefined,
): CatalogStateEnv {
  const valueOf = (entry: CatalogVisibleState) => {
    const derived = entry.derived?.() ?? derive?.(entry);
    if (derived) return derived.value ?? defaultOf(entry.type, entry.defaultValue);
    return (
      read?.(entry.id, entry.scope) ?? defaultOf(entry.type, entry.defaultValue)
    );
  };
  const byName = new Map<string, CatalogVisibleState>();
  const byId = new Map<string, CatalogVisibleState>();
  for (const entry of visible) {
    if (!byName.has(entry.name)) byName.set(entry.name, entry);
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return {
    byId(id) {
      const entry = byId.get(id);
      if (!entry) return undefined;
      return { value: valueOf(entry), type: entry.type };
    },
    get(name) {
      const entry = byName.get(name);
      // (A variable named `params` wins — the route params are the root no variable took.)
      if (!entry) return name === CATALOG_PARAMS_ROOT ? params?.() : undefined;
      return valueOf(entry);
    },
  };
}

/**
 * Props with their `{{ }}` templates resolved, or `undefined` when they have none. `authored`
 * keeps the written props (the text editor edits those, never a value).
 */
export function catalogStateProps<T extends Record<string, unknown>>(
  authored: T,
  env: () => CatalogStateEnv,
): T | undefined {
  const templates = hasStateTemplateSyntax(authored);
  const conditions = Object.values(authored).some(
    (value) => isPropWhen(value) || isPropVar(value),
  );
  if (!templates && !conditions) return undefined;
  const scope = env();
  const props = templates ? resolveStateTemplateProps(authored, scope) : authored;
  if (!conditions) return props;
  // (ADR-284 Phase 6 — a value condition's prop is the condition's verdict.)
  const out: Record<string, unknown> = { ...props };
  for (const [key, value] of Object.entries(authored))
    if (isPropWhen(value)) out[key] = catalogPropWhenValue(value, scope);
    else if (isPropVar(value)) out[key] = catalogPropVarValue(key, value, scope);
  return out as T;
}

/** RAC's key list props: a text variable's one key is a list of one (`selectedKeys={[album]}`). */
const KEY_LIST_PROPS: ReadonlySet<string> = new Set([
  "selectedKeys",
  "defaultSelectedKeys",
  "expandedKeys",
  "disabledKeys",
]);

/** ADR-284 Phase 6 — a prop that is a variable's value (undefined = no such variable). */
export function catalogPropVarValue(
  prop: string,
  value: PropVar,
  env: Pick<CatalogStateEnv, "byId">,
): unknown {
  const [id, ...path] = value.ref.slice("!var.".length).split(".");
  let read = id ? env.byId(id)?.value : undefined;
  for (const segment of path)
    read =
      read !== null && typeof read === "object"
        ? (read as Record<string, unknown>)[segment]
        : undefined;
  if (KEY_LIST_PROPS.has(prop) && !Array.isArray(read) && read !== "all")
    return read === undefined || read === null || read === "" ? [] : [read];
  return read;
}

/**
 * ADR-284 Phase 6 — a value condition's verdict: the subject variable (its path read — `.size` is a
 * selection's count, `"all"` stays `"all"`) compared with the value (a literal or `!var.<id>`) by the
 * view comparisons. An unknown variable is false (the prop keeps its off state).
 */
export function catalogPropWhenValue(
  when: PropWhen,
  env: Pick<CatalogStateEnv, "byId">,
): boolean {
  const read = (
    ref: string,
  ): { value: unknown; type?: string } | undefined => {
    const [id, ...path] = ref.slice("!var.".length).split(".");
    const found = id ? env.byId(id) : undefined;
    if (!found) return undefined;
    // (A path reads into the value — its type is the variable's only at the root.)
    if (!path.length) return found;
    let value = found.value;
    for (const segment of path) {
      if (segment === "size" && (Array.isArray(value) || value instanceof Set))
        value = Array.isArray(value) ? value.length : value.size;
      else if (segment === "size" && value === "all") value = "all";
      else
        value =
          value !== null && typeof value === "object"
            ? (value as Record<string, unknown>)[segment]
            : undefined;
    }
    return { value };
  };
  const subject = read(when.subject);
  if (!subject) return false;
  const value =
    typeof when.value === "string" && when.value.startsWith("!var.")
      ? read(when.value)?.value
      : when.value;
  const cell = subject.value;
  // (A `date` variable is stored as ISO text — its type, not the value's `typeof`, makes it a date:
  //   the panel offers the date comparisons, 2026-10-29.)
  const kind =
    subject.type === "date"
      ? "date"
      : typeof cell === "number"
      ? "number"
      : typeof cell === "boolean"
        ? "boolean"
        : Array.isArray(cell) || cell instanceof Set
          ? "list"
          : "text";
  return viewCompare(when.op, cell, value, { kind });
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

/**
 * The bound node's page variables and the project's (what a binding's key · view reads). ADR-294 —
 * also the input variables of the origins it sits in (a template root on its owner chain), valued
 * as the instance on its instance path passes them (none — the default).
 */
function pageAndProjectStates(
  graph: CatalogGraph,
  ownerId: string | undefined,
  source: CatalogStateSource | undefined,
  instancePath?: readonly string[],
): CatalogVisibleState[] {
  const visible: CatalogVisibleState[] = [];
  for (let id = ownerId; id; id = graph.ownerOf(id)) {
    const owner = graph.getEntry(graph.ownerOf(id) ?? "");
    if (owner?.kind === "definition" && owner.templateRootId === id) {
      // (No instance path — the origin drawn by itself: the default.)
      const boundaries = instancePathBoundaries(graph, instancePath ?? []);
      for (const variable of ownedVariables(graph, id))
        if (variable.input)
          visible.push({
            id: variable.id,
            name: variable.name,
            type: variableType(variable.valueType),
            defaultValue: documentDefault(variable),
            scope: { kind: "element", instanceKey: id },
            derived: () =>
              resolveInputVariable(
                graph,
                variable.id,
                boundaries,
                (otherId, boundary) => {
                  // (Read where the instance stands: its page · the project's.)
                  const entry = pageAndProjectStates(
                    graph,
                    boundary.instanceId,
                    source,
                  ).find((item) => item.id === otherId);
                  return entry
                    ? {
                        value:
                          source?.read?.(entry.id, entry.scope) ??
                          defaultOf(entry.type, entry.defaultValue),
                      }
                    : undefined;
                },
              ),
          });
    }
    // An element variable (a node's own — a search box's text inside a component's origin): read
    // under the record that draws its owner at the reader's path — only by a reader that can scope
    // it (a view, `elementKey`); a keyed binding's `{{ }}` reads page · project only (ADR-288 ⑥).
    if (source?.elementKey && graph.getEntry(id)?.kind === "node")
      for (const variable of ownedVariables(graph, id))
        if (!variable.input)
          visible.push({
            id: variable.id,
            name: variable.name,
            type: variableType(variable.valueType),
            defaultValue: documentDefault(variable),
            scope: {
              kind: "element",
              instanceKey: source.elementKey(id, instancePath ?? []) ?? id,
            },
          });
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
  /** ADR-294 — the bound node's instance path (an origin's input variable reads its instance). */
  instancePath?: readonly string[],
): { value: unknown; name: string } | undefined {
  const entry = pageAndProjectStates(graph, ownerId, source, instancePath).find(
    (item) => item.id === variableId,
  );
  if (!entry) return undefined;
  const derived = entry.derived?.();
  return {
    value: derived
      ? (derived.value ?? defaultOf(entry.type, entry.defaultValue))
      : (source?.read?.(entry.id, entry.scope) ??
        defaultOf(entry.type, entry.defaultValue)),
    name: entry.name,
  };
}

/**
 * Names a record's authored props read (a refresh re-resolves only those readers) — a value
 * condition's variables by id (the refresh passes both names and ids).
 */
export function catalogStateNames(authored: Record<string, unknown>): string[] {
  const names = collectPropsStateRefs(authored);
  for (const value of Object.values(authored))
    if (isPropVar(value)) names.push(value.ref.slice("!var.".length).split(".")[0]!);
    else if (isPropWhen(value))
      for (const ref of [value.subject, value.value])
        if (typeof ref === "string" && ref.startsWith("!var."))
          names.push(ref.slice("!var.".length).split(".")[0]!);
  return names;
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
