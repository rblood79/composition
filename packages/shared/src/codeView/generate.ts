/**
 * ADR-284 Phase 6 — the code view generator: one page of the document as one React Aria component
 * in the reference examples' shape (연구 §3 · §8.5, Decision 9). The units map 1:1:
 *
 * - a variable → `useState` (a selection is a `Selection`, a sort a `SortDescriptor`),
 * - a collection → `useListData` (local rows a rule writes) · `useAsyncList` (an endpoint) · the
 *   imported rows (read only). An endpoint with a query format (Decision 6) carries the one view
 *   its lists read in the request — `url.searchParams` · a JSON body, a variable it reads reloads
 *   (`useEffect(() => list.reload(), […])`) — and that view is the loaded items (the session's
 *   `serverView`: the server answered it, nothing filters them again),
 * - a view → `filter(…)` terms (`&&` · `||`, a skip value → `v === … ||`, an enabled flag →
 *   `!flag ||`) · `toSorted(collator…)` · `Map.groupBy` + counts · a reference → `find`,
 * - a rule → a JSX handler (a single `Set state` of the event value is the setter itself —
 *   `onChange={setSearch}`), a drop rule → `useDragAndDrop({…})` with `list.update` · `moveBefore`,
 * - a variable a control is the only writer of → the control's controlled prop too
 *   (`value={search} onChange={setSearch}`), a named RAC state → the state and its callback,
 * - a prop's value condition → the expression (`isDisabled={selectedKeys !== 'all' && …}`).
 *
 * Markup is the document's node tree (types as RAC components, scalar props); styles are not code.
 * The slots (`CodeViewSlot`) record the 1:1 positions an edit maps back to.
 */
import { getPrimitiveBinding } from "../catalog/bindings";
import { parseDateValue, type DateValueKind } from "../state/dateValue";
import { definitionTypeName } from "../catalog/commands/context";
import type {
  AuthoredValue,
  CatalogEntry,
  DataBindingRef,
  InteractionAction,
  InteractionEntry,
  NodeEntry,
  PageEntry,
  PropWhen,
  Scalar,
  StateVariableEntry,
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
  ViewEntry,
  ViewQuery,
} from "../catalog/document/types";
import { isPropVar, isPropWhen } from "../catalog/document/valueType";
import { resolveField } from "../collections/resolveBoundCollection";
import {
  DEFAULT_QUERY_SUFFIXES,
  viewQueryLimits,
  type EndpointQuerySerialization,
  type SerializationWarningCode,
} from "../collections/view/serialize";
import { isBodyType } from "../domain/predicates";
import {
  eventArgNames,
  eventArgsAreFields,
  resolveCapabilities,
} from "../interactions/capabilityRegistry";
import {
  conceptCallbackOf,
  conceptStateOf,
} from "../interactions/conceptState";
import { CodeWriter } from "./writer";
import {
  formulaEngineSync,
  loadFormulaEngine,
} from "../collections/formula/engine";
import { hasFormula } from "../collections/formula/compute";
import { formulaShown } from "../collections/formula/names";
import type {
  CodeViewAnchorTarget,
  CodeViewCollection,
  CodeViewInput,
  CodeViewResult,
  CodeViewViewOwner,
} from "./types";

const COLLECTION = "data:collection:";
const FIELD = "data:field:";
/** The drops that bring items from elsewhere — their keys are read from the drag data. */
/** Why a condition is not in a request (`viewQueryLimits` codes). */
const NOT_SENT: Record<SerializationWarningCode, string> = {
  OR_GROUP: "an or of conditions",
  COMPARISON: "a comparison the format does not name",
  MULTI_FIELD: "a condition over several fields",
  REFERENCE_PATH: "a path through a reference",
  BROKEN: "a field that does not resolve",
  GET_BODY: "a GET request carries no body",
  MULTI_VIEW: "several views",
  GROUP: "a grouping",
  COMPUTED: "a computed field",
};
const FOREIGN_DROPS = new Set(["onInsert", "onRootDrop", "onItemDrop"]);
const DRAG_EVENTS = new Set([
  "onReorder",
  "onInsert",
  "onRootDrop",
  "onItemDrop",
  "onDragEnd",
]);
const RESERVED = new Set(
  "break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await item e keys key formula computed".split(
    " ",
  ),
);

/* ─── names ─────────────────────────────────────────────────────────────────────────────── */

function identifier(raw: string, fallback: string): string {
  const words = raw
    .replace(/[^A-Za-z0-9_$\s-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean);
  let name = words
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
  if (!name) name = fallback;
  if (/^[0-9]/.test(name)) name = `_${name}`;
  return name;
}
const capital = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

class Names {
  private readonly used = new Set<string>(RESERVED);
  take(raw: string, fallback: string): string {
    const base = identifier(raw, fallback);
    let name = base;
    for (let index = 2; this.used.has(name); index += 1)
      name = `${base}${index}`;
    this.used.add(name);
    return name;
  }
}

/** A JS literal in the references' style (single quotes). */
function literal(value: unknown): string {
  if (typeof value === "string")
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .map(
        ([key, item]) =>
          `${key === "__proto__" ? `[${literal(key)}]` : property(key)}: ${literal(item)}`,
      )
      .join(", ")}}`;
  return JSON.stringify(value);
}
const property = (key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key) ? key : literal(key);
const member = (object: string, key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${object}.${key}`
    : `${object}[${literal(key)}]`;

/* ─── document reading ──────────────────────────────────────────────────────────────────── */

const stateProp = conceptStateOf;
const callbackOf = conceptCallbackOf;

/**
 * A variable that is a RAC `Selection` (a key set): a key list (`string[]`), or an `array` that a
 * selection names (a control's named keys state) or writes (`!event.keys`) — or one with no JSON
 * start (the page array before 2026-10-29 was a selection). An `array` with a JSON start nothing
 * selects into is a plain array (`useState([1, 1, 2])` — a Set would drop its repeats).
 */
function isSelectionVariable(
  entry: StateVariableEntry,
  interactions: readonly InteractionEntry[],
): boolean {
  if (entry.valueType === "string[]") return true;
  if (entry.valueType !== "array") return false;
  if (entry.source || !Array.isArray(entry.defaultValue)) return true;
  return interactions.some((rule) =>
    rule.actions.some(
      (action) =>
        action.opcode === "setState" &&
        action.variableId === entry.id &&
        typeof action.value === "string" &&
        /^!event\.keys$/.test(action.value),
    ),
  );
}

/** A date variable's start in code — the `@internationalized/date` parser of its text's shape. */
const DATE_PARSE_FN: Record<DateValueKind, string> = {
  date: "parseDate",
  dateTime: "parseDateTime",
  time: "parseTime",
  zoned: "parseZonedDateTime",
};

class Doc {
  readonly project;
  constructor(readonly input: CodeViewInput) {
    const project = input.reader.getEntry(input.reader.projectId);
    if (project?.kind !== "project") throw new Error("CODE_VIEW_NO_PROJECT");
    this.project = project;
  }
  get(id: string): CatalogEntry | undefined {
    return this.input.reader.getEntry(id);
  }
  node(id: string): NodeEntry | undefined {
    const entry = this.get(id);
    return entry?.kind === "node" ? entry : undefined;
  }
  typeOf(node: NodeEntry): string {
    try {
      return definitionTypeName(this.input.reader as never, node.definitionId);
    } catch {
      return "div";
    }
  }
  collection(id: string): CodeViewCollection | undefined {
    const bare = id.startsWith(COLLECTION) ? id.slice(COLLECTION.length) : id;
    return this.input.collections.find((collection) => collection.id === bare);
  }
  /** A field id (`data:field:<id>`) as its key in the collection. */
  fieldKey(collectionId: string, fieldId: string): string {
    const bare = fieldId.startsWith(FIELD)
      ? fieldId.slice(FIELD.length)
      : fieldId;
    return (
      resolveField(this.collection(collectionId)?.schema, bare)?.key ?? bare
    );
  }
  get variables(): StateVariableEntry[] {
    return this.project.stateVariableIds
      .map((id) => this.get(id))
      .filter(
        (entry): entry is StateVariableEntry => entry?.kind === "stateVariable",
      );
  }
  get interactions(): InteractionEntry[] {
    return this.project.interactionIds
      .map((id) => this.get(id))
      .filter(
        (entry): entry is InteractionEntry => entry?.kind === "interaction",
      );
  }
  view(id: string): ViewEntry | undefined {
    const entry = this.get(id);
    return entry?.kind === "view" ? entry : undefined;
  }
}

/* ─── generation ───────────────────────────────────────────────────────────────────────── */

interface VariableCode {
  entry: StateVariableEntry;
  name: string;
  setter: string;
  selection: boolean;
  /** Written by the list it names (`let {selectedKeys, setSelectedKeys} = list`). */
  fromList?: string;
}
interface CollectionCode {
  id: string;
  collection: CodeViewCollection | undefined;
  name: string;
  /** `useListData` · `useAsyncList` (rules write it or it loads) — `items` reads `<name>.items`. */
  hook: "list" | "async" | "rows";
}
/** A collection whose endpoint carries its lists' one view (the session's `serverView`). */
interface ServedView {
  format: EndpointQuerySerialization;
  method: string;
  /** The view chain, sources first (trailing count-only views left out — not a request). */
  chain: { key: string; query: ViewQuery }[];
}
interface ViewCode {
  name: string;
  owner: CodeViewViewOwner;
  collectionId: string;
  /** The rows of each group (a grouping view) — a count reads them. */
  grouped: boolean;
}

export function generateCodeView(input: CodeViewInput): CodeViewResult {
  const doc = new Doc(input);
  const page = doc.get(input.pageId);
  if (page?.kind !== "page") throw new Error("CODE_VIEW_NO_PAGE");
  return new Generator(doc, page).run();
}

class Generator {
  private readonly names = new Names();
  private readonly nodes: NodeEntry[] = [];
  private readonly nodeIds = new Set<string>();
  private readonly variables = new Map<string, VariableCode>();
  private readonly rowSources = new Map<string, CollectionCode>();
  private readonly views = new Map<string, ViewCode>();
  private readonly served = new Map<string, ServedView>();
  /** Collections several different views read — none goes in the request (`MULTI_VIEW`). */
  private readonly multiView = new Set<string>();
  private readonly rules = new Map<string, InteractionEntry[]>();
  /** Props a capability writes on a node: the state that holds them (`<node>SelectedKeys`). */
  private readonly ruleStates = new Map<string, VariableCode>();
  private readonly nodeNames = new Map<string, string>();
  private readonly imports = new Map<string, Set<string>>();
  private readonly dataImports: string[] = [];
  /** ADR-291 — the json-formula helpers written once a collection has a computed column. */
  private formulaHelpers = false;
  private filterFns = new Set<string>();
  private collator = false;
  private toasts = false;
  private navigate = false;

  constructor(
    private readonly doc: Doc,
    private readonly page: PageEntry,
  ) {}

  run(): CodeViewResult {
    this.collect();
    const body = new CodeWriter();
    body.in();
    this.writeState(body);
    this.writeCollections(body);
    const views = body.fragment();
    this.writeViews(views);
    const dnd = body.fragment();
    this.writeDragAndDrop(dnd);
    const jsx = body.fragment();
    jsx.in();
    this.writeJsx(jsx);
    // (The filter functions · collator are known once the views are written.)
    if (this.filterFns.size)
      body.anchorLine(
        `let {${[...this.filterFns].sort().join(", ")}} = useFilter({sensitivity: 'base'});`,
        { kind: "derived", key: "useFilter:base" },
      );
    for (const [sensitivity, fns] of this.sensitiveFns)
      body.anchorLine(
        `let {${[...fns].map(([op, name]) => `${op}: ${name}`).join(", ")}} = useFilter({sensitivity: '${sensitivity}'});`,
        { kind: "derived", key: `useFilter:${sensitivity}` },
      );
    if (this.collator)
      body.anchorLine("let collator = useCollator();", {
        kind: "derived",
        key: "collator",
      });
    if (this.navigate)
      body.anchorLine("let navigate = useNavigate();", {
        kind: "derived",
        key: "navigate",
      });
    body.append(views);
    body.append(dnd);
    body.line();
    body.line("return (");
    body.append(jsx);
    body.line(");");
    body.out();

    const out = new CodeWriter();
    this.writeImports(out);
    out.line();
    if (this.toasts) {
      out.anchorLine(
        "const toasts = new UNSTABLE_ToastQueue<{title: string}>();",
        { kind: "derived", key: "toasts" },
      );
      out.line();
    }
    out.line(
      `export default function ${capital(identifier(this.page.name, "page"))}() {`,
    );
    out.append(body);
    out.line("}");
    const variables: Record<string, string> = {};
    for (const variable of this.variables.values())
      variables[variable.name] = variable.entry.id;
    const states: Record<string, { nodeId: string; prop: string }> = {};
    for (const [key, state] of this.ruleStates) {
      const [nodeId = "", prop = ""] = key.split("\u0000");
      states[state.name] = { nodeId, prop };
    }
    const fields: Record<string, Record<string, string>> = {};
    for (const collection of this.doc.input.collections) {
      const map: Record<string, string> = {};
      for (const field of collection.schema)
        if (field.id) map[field.key] = `${FIELD}${field.id}`;
      fields[`${COLLECTION}${collection.id}`] = map;
    }
    return {
      ...out.done(),
      symbols: {
        variables,
        fields,
        ...(Object.keys(states).length ? { states } : {}),
      },
    };
  }

  /* ── collect ── */

  private collect(): void {
    const visit = (id: string) => {
      const node = this.doc.node(id);
      if (!node || this.nodeIds.has(id)) return;
      this.nodes.push(node);
      this.nodeIds.add(id);
      node.children.forEach(visit);
    };
    this.page.children.forEach(visit);
    for (const node of this.nodes) {
      const type = this.doc.typeOf(node);
      this.nodeNames.set(node.id, this.names.take(node.name ?? type, "node"));
    }
    for (const rule of this.doc.interactions)
      if (this.nodeIds.has(rule.ownerId)) {
        const list = this.rules.get(rule.ownerId) ?? [];
        list.push(rule);
        this.rules.set(rule.ownerId, list);
      }
    // Variables: the page's, its nodes' (and named states of its nodes).
    const interactions = this.doc.interactions;
    for (const entry of this.doc.variables) {
      if (entry.ownerId !== this.page.id && !this.nodeIds.has(entry.ownerId))
        continue;
      const name = this.names.take(entry.name, "state");
      this.variables.set(entry.id, {
        entry,
        name,
        setter: `set${capital(name)}`,
        selection: isSelectionVariable(entry, interactions),
      });
    }
    // Collections: the bound ones, the ones a rule writes, the views' sources.
    const written = new Set<string>();
    for (const rules of this.rules.values())
      for (const rule of rules)
        for (const action of rule.actions)
          if ("collectionId" in action && action.collectionId)
            written.add(action.collectionId);
    const use = (collectionId: string) => {
      if (this.rowSources.has(collectionId)) return;
      const collection = this.doc.collection(collectionId);
      const base = this.names.take(
        collection?.name ?? collectionId.slice(COLLECTION.length),
        "rows",
      );
      this.rowSources.set(collectionId, {
        id: collectionId,
        collection,
        name: base,
        hook: collection?.endpoint
          ? "async"
          : written.has(collectionId)
            ? "list"
            : "rows",
      });
    };
    for (const node of this.nodes)
      if (node.binding) use(node.binding.collectionId);
    for (const id of written) use(id);
    // Views: shared ones (sources first) and the built-in ones.
    const shared = (viewId: string): ViewCode | undefined => {
      const existing = this.views.get(viewId);
      if (existing) return existing;
      const view = this.doc.view(viewId);
      if (!view) return undefined;
      const source =
        "viewId" in view.source ? shared(view.source.viewId) : undefined;
      const collectionId =
        "collectionId" in view.source
          ? view.source.collectionId
          : source?.collectionId;
      if (!collectionId) return undefined;
      use(collectionId);
      const code: ViewCode = {
        name: this.names.take(view.name, "view"),
        owner: { viewId: view.id },
        collectionId,
        grouped: !!view.groupBy,
      };
      this.views.set(viewId, code);
      return code;
    };
    for (const node of this.nodes) {
      const binding = node.binding;
      if (!binding) continue;
      if (binding.viewId) shared(binding.viewId);
      else if (binding.view && !this.views.has(node.id)) {
        const collection = this.rowSources.get(binding.collectionId)!;
        this.views.set(node.id, {
          name: this.names.take(`${collection.name}View`, "view"),
          owner: { nodeId: node.id },
          collectionId: binding.collectionId,
          grouped: !!binding.view.groupBy,
        });
      }
    }
    this.collectServed();
    // A named selection of a list a rule writes is the list's own (`useListData` selection).
    for (const variable of this.variables.values()) {
      const source = variable.entry.source;
      const node = source ? this.doc.node(source.nodeId) : undefined;
      const collection = node?.binding
        ? this.rowSources.get(node.binding.collectionId)
        : undefined;
      if (source?.prop === "selectedKeys" && collection?.hook === "list")
        variable.fromList = collection.name;
    }
    // A capability's target prop that no variable names: a state of its own.
    for (const rules of this.rules.values())
      for (const rule of rules)
        for (const action of rule.actions) {
          if (action.opcode !== "capability" || !("nodeId" in action.target))
            continue;
          const target = this.doc.node(action.target.nodeId);
          if (!target || !this.nodeIds.has(target.id)) continue;
          const def = resolveCapabilities(this.doc.typeOf(target))[
            action.capabilityId
          ];
          if (!def || def.imperative) continue;
          const prop = def.prop.startsWith("style.") ? "isVisible" : def.prop;
          const key = `${target.id}\u0000${prop}`;
          if (this.ruleStates.has(key) || this.namedStateOf(target.id, prop))
            continue;
          const name = this.names.take(
            `${this.nodeNames.get(target.id)}${capital(prop)}`,
            "state",
          );
          // ADR-287 — the state's kind is the Do's (a number · a boolean · a choice's text), its start
          //   the node's authored value (RAC's pattern: `useState(<the prop's value>)`).
          const valueType =
            prop === "selectedKeys"
              ? "string[]"
              : prop === "isVisible" ||
                  typeof def.value === "boolean" ||
                  (def.value === "!self" && !def.prop.startsWith("style."))
                ? "boolean"
                : def.param?.kind === "number"
                  ? "number"
                  : "string";
          const authored =
            this.propValue(target, prop) ??
            getPrimitiveBinding(this.doc.typeOf(target))?.props.accepts[prop]
              ?.default;
          const defaultValue =
            prop === "selectedKeys"
              ? []
              : prop === "isVisible"
                ? true
                : valueType === "boolean"
                  ? authored === true
                  : valueType === "number"
                    ? typeof authored === "number"
                      ? authored
                      : 0
                    : typeof authored === "string"
                      ? authored
                      : "";
          this.ruleStates.set(key, {
            entry: {
              kind: "stateVariable",
              id: `capability:${key}` as never,
              ownerId: target.id,
              name,
              valueType,
              defaultValue,
            },
            name,
            setter: `set${capital(name)}`,
            selection: prop === "selectedKeys",
          });
        }
  }

  private namedStateOf(nodeId: string, prop: string): VariableCode | undefined {
    for (const variable of this.variables.values())
      if (
        variable.entry.source?.nodeId === nodeId &&
        variable.entry.source.prop === prop
      )
        return variable;
    return this.ruleStates.get(`${nodeId}\u0000${prop}`);
  }

  private import(from: string, name: string): void {
    const names = this.imports.get(from) ?? new Set<string>();
    names.add(name);
    this.imports.set(from, names);
  }

  /* ── imports ── */

  private writeImports(out: CodeWriter): void {
    const order = [
      "react",
      "@internationalized/date",
      "react-aria",
      "react-aria-components",
      "react-aria-components/useListData",
      "react-aria-components/useAsyncList",
      "react-aria-components/useDragAndDrop",
      "react-router",
    ];
    if (this.filterFns.size || this.sensitiveFns.size)
      this.import("react-aria", "useFilter");
    if (this.collator) this.import("react-aria", "useCollator");
    if (this.toasts)
      this.import("react-aria-components", "UNSTABLE_ToastQueue");
    if (this.navigate) this.import("react-router", "useNavigate");
    for (const from of [...this.imports.keys()].sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    )) {
      const names = [...this.imports.get(from)!].sort();
      const types = names.filter((name) => name.startsWith("type "));
      const values = names.filter((name) => !name.startsWith("type "));
      out.anchorLine(
        `import {${[...values, ...types].join(", ")}} from '${from}';`,
        { kind: "derived", key: `import:${from}` },
      );
    }
    for (const line of this.dataImports)
      out.anchorLine(line, { kind: "derived", key: `import:${line}` });
  }

  /* ── state ── */

  private writeState(out: CodeWriter): void {
    const states = [...this.variables.values(), ...this.ruleStates.values()];
    if (!states.length) return;
    this.import("react", "useState");
    for (const variable of states) {
      if (variable.fromList) continue;
      const { entry } = variable;
      out.start();
      const from = out.length;
      out.write("let [");
      const isVariable = !entry.id.startsWith("capability:");
      if (isVariable)
        out.slot(variable.name, { kind: "variableName", variableId: entry.id });
      else out.write(variable.name);
      out.write(`, ${variable.setter}] = useState`);
      const initial = this.initialValue(variable);
      if (variable.selection) {
        this.import("react-aria-components", "type Selection");
        out.write("<Selection>(");
      } else if (this.isSortVariable(entry)) {
        this.import("react-aria-components", "type SortDescriptor");
        out.write("<SortDescriptor>(");
      } else if (entry.valueType === "date") {
        const time =
          typeof entry.defaultValue === "string" &&
          parseDateValue(entry.defaultValue)?.kind === "time";
        this.import(
          "@internationalized/date",
          time ? "type Time" : "type DateValue",
        );
        out.write(time ? "<Time | null>(" : "<DateValue | null>(");
      } else out.write("(");
      if (initial && isVariable)
        out.slot(initial, { kind: "variableDefault", variableId: entry.id });
      else out.write(initial);
      out.write(");");
      out
        .anchor(
          from,
          isVariable
            ? { kind: "variable", variableId: entry.id }
            : { kind: "derived", key: `state:${entry.id}` },
        )
        .end();
    }
  }

  private isSortVariable(entry: StateVariableEntry): boolean {
    const isSort = (query: ViewQuery | undefined) =>
      !!query?.sort &&
      "variableId" in query.sort &&
      query.sort.variableId === entry.id;
    return (
      this.nodes.some((node) => isSort(node.binding?.view)) ||
      [...this.views.values()].some((view) =>
        "viewId" in view.owner
          ? isSort(this.doc.view(view.owner.viewId))
          : false,
      )
    );
  }

  private initialValue(variable: VariableCode): string {
    const { entry } = variable;
    if (variable.selection) {
      const keys = Array.isArray(entry.defaultValue) ? entry.defaultValue : [];
      return keys.length ? `new Set(${literal(keys)})` : "new Set()";
    }
    if (entry.valueType === "object" || entry.valueType === "array") {
      // (A structured variable starts empty — a sort sorts nothing until a column is picked —
      //   or with its JSON default as a literal, 2026-10-29.)
      if (this.isSortVariable(entry)) return "";
      return entry.defaultValue === "" || entry.defaultValue === null
        ? "null"
        : literal(entry.defaultValue);
    }
    if (entry.valueType === "date") {
      // (RAC's date values — `parseDate('2026-10-29')` · `parseTime('10:00')` …; none = `null`.)
      const parsed =
        typeof entry.defaultValue === "string"
          ? parseDateValue(entry.defaultValue)
          : undefined;
      if (!parsed) return "null";
      // (An instant written with `Z` · an offset is read in UTC — `parseZonedDateTime` takes only
      //   the bracketed zone form, review 2026-10-29.)
      if (parsed.kind === "zoned" && !String(entry.defaultValue).includes("[")) {
        this.import("@internationalized/date", "parseAbsolute");
        return `parseAbsolute(${literal(entry.defaultValue)}, 'UTC')`;
      }
      const fn = DATE_PARSE_FN[parsed.kind];
      this.import("@internationalized/date", fn);
      return `${fn}(${literal(entry.defaultValue)})`;
    }
    return literal(entry.defaultValue);
  }

  /* ── collections ── */

  private writeCollections(out: CodeWriter): void {
    for (const code of this.rowSources.values()) {
      const file = `./data/${identifier(code.collection?.name ?? code.name, "rows")}`;
      const key = resolveField(code.collection?.schema, "id")?.key ?? "id";
      const fields = this.writeComputedFields(out, code);
      const computed = (rows: string) =>
        fields ? `${rows}.map(item => computed(item, ${fields}))` : rows;
      if (code.hook === "rows") {
        if (!fields) {
          this.dataImports.push(`import ${code.name} from '${file}';`);
          continue;
        }
        const data = `${code.name}Data`;
        this.dataImports.push(`import ${data} from '${file}';`);
        out.anchorLine(`let ${code.name} = ${computed(data)};`, {
          kind: "derived",
          key: `rows:${code.id}`,
        });
        continue;
      }
      const derived = {
        kind: "derived",
        key: `collection:${code.id}`,
      } as const;
      if (code.hook === "list") {
        const initial = `${code.name}Data`;
        this.dataImports.push(`import ${initial} from '${file}';`);
        this.import("react-aria-components/useListData", "useListData");
        const from = out.length;
        out.line(`let ${code.name} = useListData({`);
        out
          .in()
          .line(`initialItems: ${computed(initial)},`)
          .line(`getKey: item => item.${key}`)
          .out();
        out.line("});").anchor(from, derived);
        // (Its named selection reads the list's own — `removeSelectedItems` clears it.)
        for (const variable of this.variables.values())
          if (variable.fromList === code.name)
            out.anchorLine(
              `let {selectedKeys: ${variable.name}, setSelectedKeys: ${variable.setter}} = ${code.name};`,
              { kind: "variable", variableId: variable.entry.id },
            );
        continue;
      }
      const endpoint = code.collection?.endpoint;
      const url = endpoint?.url ?? "";
      const served = this.served.get(code.id);
      this.import("react-aria-components/useAsyncList", "useAsyncList");
      const from = out.length;
      out.line(`let ${code.name} = useAsyncList({`);
      out.in().line("async load({signal, cursor}) {").in();
      if (served) this.writeRequest(out, code, served, url);
      else {
        if (this.multiView.has(code.id))
          out.line(
            `// Lists read different views of ${code.name}: none goes in the request — each filters the loaded items.`,
          );
        out.line(
          `let res = await fetch(cursor || ${literal(url)}${endpoint?.method && endpoint.method.toUpperCase() !== "GET" ? `, {signal, method: ${literal(endpoint.method)}}` : ", {signal}"});`,
        );
      }
      // (The response's items · next cursor — the endpoint's response mapping.)
      const read = (path: string | undefined) =>
        path
          ? path.split(".").reduce((code, key) => member(code, key), "json")
          : "json";
      out.line("let json = await res.json();");
      out.line(
        `return {items: ${computed(read(endpoint?.dataPath))}${endpoint?.cursorPath ? `, cursor: ${read(endpoint.cursorPath)}` : ""}};`,
      );
      out.out().line("}").out();
      out.line("});").anchor(from, derived);
      if (served) {
        const dependencies = this.servedDependencies(served);
        if (dependencies.length) {
          this.import("react", "useEffect");
          out.anchorLine(
            `useEffect(() => { ${code.name}.reload(); }, [${dependencies.join(", ")}]);`,
            { kind: "derived", key: `effect:${code.id}` },
          );
        }
      }
    }
  }

  /**
   * ADR-291 Decision 9 — a collection's computed columns as a field definition block the rows
   * are mapped through: `let <rows>Fields = {<key>: {type, formula}}` (the formula shown over
   * field keys — `names.ts`; `type` is the column's result type) and, once, the json-formula
   * helpers. Returns the block's name; undefined when the collection has no computed column.
   */
  private writeComputedFields(
    out: CodeWriter,
    code: CollectionCode,
  ): string | undefined {
    // (The document's definition when the reader holds it — ADR-286: the data is the document's,
    //   and an edit of the block regenerates from the staged document.)
    const entry = this.doc.get(code.id);
    const schema: CodeViewCollection["schema"] =
      entry?.kind === "collection"
        ? entry.schema.map((field) => ({
            ...(field.id ? { id: field.id } : {}),
            key: field.key,
            ...(field.type ? { type: field.type } : {}),
            ...(field.formula ? { formula: field.formula } : {}),
          }))
        : (code.collection?.schema ?? []);
    const computed = schema.filter(hasFormula);
    if (!computed.length) return undefined;
    if (!this.formulaHelpers) {
      this.formulaHelpers = true;
      this.dataImports.unshift("import JsonFormula from '@adobe/json-formula';");
      out.anchorLine("let formula = new JsonFormula();", {
        kind: "derived",
        key: "formula",
      });
      out.anchorLine(
        "let computed = (item, fields) => ({...item, ...Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, formula.search(field.formula, item)]))});",
        { kind: "derived", key: "computed" },
      );
    }
    // (Shown over keys when the engine is loaded — the panel reads again once it is; until then
    //   the stored form.)
    const engine = formulaEngineSync();
    if (!engine) void loadFormulaEngine();
    const shown = (stored: string) => formulaShown(engine, stored, schema);
    const name = `${code.name}Fields`;
    out.start();
    const from = out.length;
    out.write(`let ${name} = {`).end();
    out.in();
    for (const field of computed)
      out.line(
        `${property(field.key)}: {type: ${literal(field.type ?? "string")}, formula: ${literal(shown(field.formula!))}},`,
      );
    out.out();
    out.write("  ".repeat(out.depth)).write("};");
    out.anchor(from, { kind: "fields", collectionId: code.id }).end();
    return name;
  }

  /** The nodes of every page bound to a collection (the session reads them all). */
  private boundNodes(collectionId: string): NodeEntry[] {
    const out: NodeEntry[] = [];
    const visit = (id: string) => {
      const node = this.doc.node(id);
      if (!node) return;
      if (node.binding?.collectionId === collectionId) out.push(node);
      node.children.forEach(visit);
    };
    for (const pageId of this.doc.project.pageIds) {
      const page = this.doc.get(pageId);
      if (page?.kind === "page") page.children.forEach(visit);
    }
    return out;
  }

  /** A binding's view chain, sources first (`key` = the views map key). */
  private chainOf(
    node: NodeEntry,
  ): { key: string; query: ViewQuery }[] | undefined {
    const binding = node.binding;
    if (!binding) return undefined;
    if (binding.view) return [{ key: node.id, query: binding.view }];
    const chain: { key: string; query: ViewQuery }[] = [];
    let id: string | undefined = binding.viewId;
    while (id) {
      const view = this.doc.view(id);
      if (!view) return undefined;
      chain.unshift({ key: view.id, query: view });
      id = "viewId" in view.source ? view.source.viewId : undefined;
    }
    return chain.length ? chain : undefined;
  }

  /**
   * The session's `serverView` per endpoint collection: its query format names a request, and the
   * bindings of the collection read one view (by its definition — a count of it is the same
   * request) without grouping.
   */
  private collectServed(): void {
    const countOnly = (query: ViewQuery) =>
      !query.where.items.length &&
      !query.groupBy &&
      !query.sort &&
      !!query.aggregates?.length &&
      query.aggregates.every(
        (aggregate) => aggregate.fn === "count" || aggregate.fn === "applied",
      );
    for (const code of this.rowSources.values()) {
      const endpoint = code.collection?.endpoint;
      const format = endpoint?.querySerialization;
      if (code.hook !== "async" || !format || format.kind === "none") continue;
      const chains = new Map<string, { key: string; query: ViewQuery }[]>();
      for (const node of this.boundNodes(code.id)) {
        const chain = this.chainOf(node);
        if (!chain) continue;
        let end = chain.length;
        while (end > 1 && countOnly(chain[end - 1]!.query)) end -= 1;
        const base = chain.slice(0, end);
        chains.set(JSON.stringify(base.map((item) => item.query)), base);
      }
      if (chains.size > 1) this.multiView.add(code.id);
      if (chains.size !== 1) continue;
      const [chain] = [...chains.values()];
      if (chain!.some((item) => item.query.groupBy || item.query.aggregates))
        continue;
      this.served.set(code.id, {
        format,
        method: (endpoint!.method ?? "GET").toUpperCase(),
        chain: chain!,
      });
    }
  }

  /** The view a served collection's request carries: parameters (`suffix`) or a JSON body. */
  private writeRequest(
    out: CodeWriter,
    code: CollectionCode,
    served: ServedView,
    url: string,
  ): void {
    const collection = code.collection!;
    const queries = served.chain.map((item) => item.query);
    const limits = viewQueryLimits(
      served.format,
      {
        queries,
        schema: collection.schema.flatMap((field) =>
          field.id
            ? [
                {
                  id: field.id,
                  key: field.key,
                  type: field.type,
                  ...(field.formula ? { formula: field.formula } : {}),
                },
              ]
            : [],
        ),
      },
      served.method,
    );
    const notSent = new Map<string, SerializationWarningCode>();
    for (const warning of limits)
      if (warning.conditionId) notSent.set(warning.conditionId, warning.code);
    const owner = served.chain.at(-1)!;
    const view = this.views.get(owner.key)!;
    const init =
      served.method === "GET"
        ? "{signal}"
        : `{signal, method: ${literal(served.method)}}`;
    const last = queries.at(-1)!;
    if (served.format.kind === "suffix") {
      out.line(`let url = new URL(${literal(url)});`);
      const suffixes = served.format.suffixes ?? DEFAULT_QUERY_SUFFIXES;
      const visit = (item: ViewCondition | ViewConditionGroup) => {
        const reason = notSent.get(item.id);
        if (reason) {
          out.line(
            `// Not in the request (${NOT_SENT[reason]}) — and not filtered here.`,
          );
          return;
        }
        if ("items" in item) item.items.forEach(visit);
        else this.writeParam(out, item, view, suffixes);
      };
      for (const query of queries) visit(query.where);
      this.writeSortParams(out, last, view, served.format);
      out.line(`let res = await fetch(cursor || url, ${init});`);
      return;
    }
    if (served.method === "GET" || served.method === "HEAD") {
      out.line(
        "// A GET request carries no body: the view is not sent — and not filtered here.",
      );
      out.line(`let res = await fetch(cursor || ${literal(url)}, ${init});`);
      return;
    }
    const group = (item: ViewConditionGroup): string =>
      `{op: ${literal(item.op)}, items: [${item.items
        .map((child) =>
          "items" in child ? group(child) : this.bodyCondition(child, view),
        )
        .filter(Boolean)
        .join(", ")}].filter(Boolean)}`;
    const wheres = queries.map((query) => group(query.where));
    out.line(
      `let where = ${wheres.length === 1 ? wheres[0] : `{op: 'and', items: [${wheres.join(", ")}]}`};`,
    );
    const sort = this.sortCode(last, view);
    out.line(
      `let res = await fetch(cursor || ${literal(url)}, {signal, method: ${literal(served.method)}, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({where${sort ? `, sort: ${sort.when ? `${sort.when} && ` : ""}{field: ${sort.field}, direction: ${sort.direction}}` : ""}})});`,
    );
  }

  /** A condition's guard: its 적용 variable and its skip value (`gender !== 'all'`). */
  private guardOf(
    condition: ViewCondition,
    value: { code: string; variable?: VariableCode },
  ): string | undefined {
    const parts: string[] = [];
    if (
      typeof condition.enabled === "string" &&
      condition.enabled.startsWith("!var.")
    )
      parts.push(this.conditionValue(condition.enabled).code);
    const skip = this.skipOf(condition, value);
    if (skip.length === 1 && / === /.test(skip[0]!))
      parts.push(skip[0]!.replace(" === ", " !== "));
    else if (skip.length) parts.push(`!(${skip.join(" || ")})`);
    else if (
      value.variable &&
      ["contains", "startsWith", "endsWith"].includes(condition.op)
    )
      parts.push(`${value.code} !== ''`);
    return parts.length ? parts.join(" && ") : undefined;
  }

  /** One condition as request parameters (`url.searchParams.append('gender', String(gender))`). */
  private writeParam(
    out: CodeWriter,
    condition: ViewCondition,
    view: ViewCode,
    suffixes: Readonly<Partial<Record<ViewComparison, string>>>,
  ): void {
    if (condition.enabled === false) return;
    const key = this.pathKey(view.collectionId, condition.fields[0]!);
    const value = this.conditionValue(condition.value);
    const guard = this.guardOf(condition, value);
    const lead = guard ? `if (${guard}) ` : "";
    const anchor = {
      kind: "condition",
      owner: view.owner,
      conditionId: condition.id,
    } as const;
    const text = (code: string) =>
      /^'.*'$|^-?\d/.test(code) ? code : `String(${code})`;
    if (condition.op === "between") {
      const cells = Array.isArray(condition.value) ? condition.value : [];
      [suffixes.gte, suffixes.lte].forEach((suffix, index) => {
        const cell = this.conditionValue(cells[index]);
        out.anchorLine(
          `${lead}url.searchParams.append(${literal(`${key}${suffix}`)}, ${text(cell.code)});`,
          anchor,
        );
      });
      return;
    }
    const suffix = suffixes[condition.op] ?? "";
    if (condition.op === "oneOf" || Array.isArray(condition.value)) {
      out.anchorLine(
        `${lead}for (let x of ${value.code}) url.searchParams.append(${literal(`${key}${suffix}`)}, String(x));`,
        anchor,
      );
      return;
    }
    out.start();
    const from = out.length;
    out.write(`${lead}url.searchParams.append(`);
    out.slot(`${literal(`${key}${suffix}`)}, ${text(value.code)}`, {
      kind: "condition",
      owner: view.owner,
      conditionId: condition.id,
      collectionId: view.collectionId,
      suffixes,
    });
    out.write(");").anchor(from, anchor).end();
  }

  /** The view's sort as parameters (`_sort` · `_order`); a literal sort's field is a position. */
  private writeSortParams(
    out: CodeWriter,
    query: ViewQuery,
    view: ViewCode,
    format: EndpointQuerySerialization,
  ): void {
    const sort = query.sort;
    if (!sort) return;
    const sortParam = literal(format.sortParam ?? "_sort");
    const orderParam = literal(format.orderParam ?? "_order");
    if ("variableId" in sort) {
      const variable = this.variables.get(sort.variableId);
      if (!variable) return;
      out.line(`if (${variable.name}) {`).in();
      out.line(
        `url.searchParams.set(${sortParam}, String(${variable.name}.column));`,
      );
      out.line(
        `url.searchParams.set(${orderParam}, ${variable.name}.direction === 'descending' ? 'desc' : 'asc');`,
      );
      out.out().line("}");
      return;
    }
    const key = this.pathKey(view.collectionId, sort.field);
    out.start().write(`url.searchParams.set(${sortParam}, '`);
    out.slot(key, {
      kind: "sortField",
      owner: view.owner,
      collectionId: view.collectionId,
    });
    out.write("');").end();
    out.line(
      `url.searchParams.set(${orderParam}, ${literal(sort.direction === "descending" ? "desc" : "asc")});`,
    );
  }

  /** A body format's sort (the field and direction as code). */
  private sortCode(
    query: ViewQuery,
    view: ViewCode,
  ): { field: string; direction: string; when?: string } | undefined {
    const sort = query.sort;
    if (!sort) return undefined;
    if ("variableId" in sort) {
      const variable = this.variables.get(sort.variableId);
      return variable
        ? {
            field: `${variable.name}.column`,
            direction: `${variable.name}.direction`,
            when: variable.name,
          }
        : undefined;
    }
    return {
      field: literal(this.pathKey(view.collectionId, sort.field)),
      direction: literal(sort.direction),
    };
  }

  /** A body format's condition (`guard && {fields, op, value}`). */
  private bodyCondition(condition: ViewCondition, view: ViewCode): string {
    if (condition.enabled === false) return "";
    const value = this.conditionValue(condition.value);
    const fields = condition.fields.map((path) =>
      literal(this.pathKey(view.collectionId, path)),
    );
    const object = `{fields: [${fields.join(", ")}], op: ${literal(condition.op)}${
      condition.op === "exists" || condition.op === "notExists"
        ? ""
        : `, value: ${value.variable?.selection ? `[...${value.code}]` : value.code}`
    }}`;
    const guard = this.guardOf(condition, value);
    return guard ? `${guard} && ${object}` : object;
  }

  /** The variables a served view reads (its conditions' values · 적용 flags · its sort). */
  private servedDependencies(served: ServedView): string[] {
    const names: string[] = [];
    const add = (ref: unknown) => {
      if (typeof ref !== "string" || !ref.startsWith("!var.")) return;
      const variable = this.variables.get(ref.slice(5).split(".")[0]!);
      if (variable && !names.includes(variable.name)) names.push(variable.name);
    };
    const visit = (item: ViewCondition | ViewConditionGroup) => {
      if ("items" in item) item.items.forEach(visit);
      else {
        add(item.enabled);
        if (Array.isArray(item.value)) item.value.forEach(add);
        else add(item.value);
      }
    };
    for (const { query } of served.chain) {
      visit(query.where);
      if (query.sort && "variableId" in query.sort)
        add(`!var.${query.sort.variableId}`);
    }
    return names;
  }

  /** The rows a collection's code gives (`users.items` · `users`). */
  private rowsOf(collectionId: string): string {
    const code = this.rowSources.get(collectionId);
    if (!code) return "[]";
    return code.hook === "rows" ? code.name : `${code.name}.items`;
  }

  /* ── views ── */

  private writeViews(out: CodeWriter): void {
    const written = new Set<string>();
    const write = (key: string) => {
      if (written.has(key)) return;
      written.add(key);
      const code = this.views.get(key)!;
      let query: ViewQuery;
      let source: string;
      if ("viewId" in code.owner) {
        const view = this.doc.view(code.owner.viewId)!;
        query = view;
        if ("viewId" in view.source) {
          write(view.source.viewId);
          source = this.views.get(view.source.viewId)!.name;
        } else source = this.rowsOf(view.source.collectionId);
      } else {
        query = this.doc.node(code.owner.nodeId)!.binding!.view!;
        source = this.rowsOf(code.collectionId);
      }
      const from = out.length;
      this.writeView(out, code, query, source, key);
      out.anchor(from, { kind: "view", owner: code.owner });
    };
    for (const key of this.views.keys()) write(key);
  }

  private writeView(
    out: CodeWriter,
    code: ViewCode,
    query: ViewQuery,
    source: string,
    viewKey: string,
  ): void {
    // (A view the endpoint's request carries: the server answered it — the loaded items are it.)
    const servedView = this.served.get(code.collectionId);
    if (servedView?.chain.some((item) => item.key === viewKey)) {
      out.line(`let ${code.name} = ${source};`);
      return;
    }
    const sort = query.sort;
    let dir: string | undefined;
    if (sort && "variableId" in sort) {
      const variable = this.variables.get(sort.variableId);
      if (variable) {
        dir = this.names.take(`${variable.name}Dir`, "dir");
        out.line(
          `let ${dir} = ${variable.name}?.direction === 'descending' ? -1 : 1;`,
        );
      }
    }
    const grouped = !!query.groupBy?.length;
    if (!grouped && query.aggregates?.length && !query.where.items.length) {
      // (A count without grouping — 「결과 수 표시」 · 「적용 조건 수 표시」: one row, the key the
      // runtime gives a row without an id.)
      const fields = this.aggregateFields(code, query, source);
      out.line(`let ${code.name} = [{id: 'row-1', ${fields.join(", ")}}];`);
      return;
    }
    // (A grouping view: the filtered rows first, then `Map.groupBy` and the aggregates.)
    const filtered = grouped
      ? this.names.take(`${code.name}Rows`, "rows")
      : code.name;
    out.start().write(`let ${filtered} = ${source}`);
    const terms = this.fragmentOfGroup(query.where, code, true);
    out.in();
    if (terms)
      out
        .end()
        .start()
        .write(".filter(item =>")
        .end()
        .in()
        .start()
        .append(terms)
        .write(")")
        .out();
    if (grouped) {
      out.write(";").end();
      out.out();
      this.writeGroup(out, code, query, filtered);
      out.in();
    }
    if (sort) {
      this.collator = true;
      out.end().start().write(".toSorted((a, b) => ");
      if ("variableId" in sort) {
        const variable = this.variables.get(sort.variableId);
        const column = variable ? `${variable.name}.column` : "'id'";
        const compare = `collator.compare(String(a[${column}]), String(b[${column}])) * ${dir ?? 1}`;
        out.write(
          variable ? `${variable.name} ? ${compare} : 0)` : `${compare})`,
        );
      } else {
        const key = this.pathKey(code.collectionId, sort.field);
        out.write("collator.compare(String(a.");
        out.slot(key, {
          kind: "sortField",
          owner: code.owner,
          collectionId: code.collectionId,
        });
        out.write(
          `), String(b.${key}))${sort.direction === "descending" ? " * -1" : ""})`,
        );
      }
    }
    out.write(";").end();
    out.out();
  }

  private writeGroup(
    out: CodeWriter,
    code: ViewCode,
    query: ViewQuery,
    rows: string,
  ): void {
    const key = this.pathKey(code.collectionId, query.groupBy![0]!);
    const read = this.fieldRead(code.collectionId, query.groupBy![0]!);
    const groups = this.names.take(`${code.name}Groups`, "groups");
    out.line(`let ${groups} = Map.groupBy(${rows}, item => ${read});`);
    const fields = this.aggregateFields(code, query, "rows");
    const value = identifier(key, "value");
    const entries =
      query.emptyGroups === "all"
        ? // (「모든 값」: every value the data has — 0 rows where none match.)
          `[...new Set(${this.rowsOf(code.collectionId)}.map(item => ${read}))].map(${value} => [${value}, ${groups}.get(${value}) ?? []])`
        : `[...${groups}]`;
    out
      .start()
      .write(
        `let ${code.name} = ${entries}.map(([${value}, rows]) => ({id: ${value}, ${property(key)}: ${value}${fields.length ? `, ${fields.join(", ")}` : ""}}))`,
      );
  }

  /** A view's aggregates over `rows` as object fields (`count: rows.length` …). */
  private aggregateFields(
    code: ViewCode,
    query: ViewQuery,
    rows: string,
  ): string[] {
    return (query.aggregates ?? []).map((aggregate) => {
      const field = aggregate.field
        ? this.pathKey(code.collectionId, aggregate.field)
        : "";
      const name = property(aggregate.as);
      switch (aggregate.fn) {
        case "count":
          return `${name}: ${rows}.length`;
        case "sum":
          return `${name}: ${rows}.reduce((sum, row) => sum + Number(row.${field} ?? 0), 0)`;
        case "mean":
          return `${name}: ${rows}.reduce((sum, row) => sum + Number(row.${field} ?? 0), 0) / ${rows}.length`;
        case "min":
          return `${name}: ${rows}.map(row => row.${field}).toSorted()[0]`;
        case "max":
          return `${name}: ${rows}.map(row => row.${field}).toSorted().at(-1)`;
        case "applied":
          return `${name}: ${this.appliedCode(code)}`;
      }
    });
  }

  /**
   * 「적용 조건 수」 — how many conditions of the source views apply, as code: each condition's
   * 「applies」 (its 적용 variable, not its skip value — an empty search does not count).
   */
  private appliedCode(code: ViewCode): string {
    const actives: string[] = [];
    let source =
      "viewId" in code.owner
        ? this.doc.view(code.owner.viewId)?.source
        : undefined;
    while (source && "viewId" in source) {
      const view = this.doc.view(source.viewId);
      if (!view) break;
      // (A nested group — 「또는 조건」 — is one condition: it applies when anything in it does.)
      const leaves = (group: ViewConditionGroup): string[] =>
        group.items.flatMap((item) =>
          "items" in item ? leaves(item) : (this.activeOf(item) ?? []),
        );
      const before = actives.length;
      for (const item of view.where.items) {
        const active =
          "items" in item ? [...new Set(leaves(item))] : this.activeOf(item);
        if (Array.isArray(active)) {
          if (active.length)
            actives.push(
              active.length > 1 ? `(${active.join(" || ")})` : active[0]!,
            );
        } else if (active) actives.push(active);
      }
      // (Root first: the source of a source is read before it.)
      actives.unshift(...actives.splice(before));
      source = view.source;
    }
    return actives.length
      ? `[${actives.join(", ")}].filter(Boolean).length`
      : "0";
  }

  /** Whether a condition applies, as code (undefined = never — `enabled: false`). */
  private activeOf(condition: ViewCondition): string | undefined {
    if (condition.enabled === false) return undefined;
    const value = this.conditionValue(condition.value);
    const parts: string[] = [];
    if (
      typeof condition.enabled === "string" &&
      condition.enabled.startsWith("!var.")
    )
      parts.push(this.conditionValue(condition.enabled).code);
    const skip = this.skipOf(condition, value);
    if (skip.length) parts.push(`!(${skip.join(" || ")})`);
    else if (
      value.variable &&
      ["contains", "startsWith", "endsWith"].includes(condition.op)
    )
      // (An empty search matches every row — it is not a filter.)
      parts.push(`${value.code} !== ''`);
    return parts.length ? parts.join(" && ") : "true";
  }

  /** A field path's key (`team.name` for a reference path). */
  private pathKey(collectionId: string, path: readonly string[]): string {
    const keys: string[] = [];
    let current = collectionId;
    for (const fieldId of path) {
      const key = this.doc.fieldKey(current, fieldId);
      keys.push(key);
      const field = resolveField(this.doc.collection(current)?.schema, key);
      if (field?.reference)
        current = `${COLLECTION}${field.reference.collectionId}`;
    }
    return keys.join(".");
  }

  /** A field path read from `item` (a reference path → `rows.find(…)?.field`). */
  private fieldRead(
    collectionId: string,
    path: readonly string[],
    row = "item",
  ): string {
    let read = row;
    let current = collectionId;
    path.forEach((fieldId, index) => {
      const key = this.doc.fieldKey(current, fieldId);
      const field = resolveField(this.doc.collection(current)?.schema, key);
      read = index === 0 ? member(read, key) : member(read, key);
      if (field?.reference && index < path.length - 1) {
        const target = `${COLLECTION}${field.reference.collectionId}`;
        if (!this.rowSources.has(target)) {
          const collection = this.doc.collection(target);
          const name = this.names.take(
            collection?.name ?? field.reference.collectionId,
            "rows",
          );
          this.rowSources.set(target, {
            id: target,
            collection,
            name,
            hook: "rows",
          });
          this.dataImports.push(
            `import ${name} from './data/${identifier(collection?.name ?? name, "rows")}';`,
          );
        }
        const rows = this.rowsOf(target);
        read = `${rows}.find(row => ${member("row", field.reference.keyField)} === ${read})?`;
        current = target;
      }
    });
    return read.replace(/\?\.$/, "").replace(/\?$/, "");
  }

  /** A view's condition tree as `filter` terms; undefined = nothing filters. */
  private fragmentOfGroup(
    group: ViewConditionGroup,
    view: ViewCode,
    top: boolean,
  ): CodeWriter | undefined {
    const parts = group.items
      .map((item) =>
        "items" in item
          ? this.fragmentOfGroup(item, view, false)
          : this.fragmentOfCondition(item, view),
      )
      .filter((part): part is CodeWriter => !!part);
    if (!parts.length) return undefined;
    const out = new CodeWriter();
    const join = group.op === "and" ? " &&" : " ||";
    parts.forEach((part, index) => {
      if (index) {
        out.write(join);
        if (top) out.write("\n" + "      ");
        else out.write(" ");
      }
      out.append(part);
    });
    if (!top && parts.length > 1) {
      const wrapped = new CodeWriter();
      return wrapped.write("(").append(out).write(")");
    }
    return out;
  }

  /** The value a condition compares with, and whether it is a selection variable. */
  private conditionValue(value: unknown): {
    code: string;
    variable?: VariableCode;
  } {
    if (typeof value === "string" && value.startsWith("!var.")) {
      const [id, ...path] = value.slice(5).split(".");
      const variable = this.variables.get(id!);
      if (variable)
        return {
          code: [variable.name, ...path].join("."),
          ...(path.length ? {} : { variable }),
        };
      return { code: "undefined" };
    }
    if (Array.isArray(value)) return { code: literal(value) };
    return { code: literal(value) };
  }

  private fragmentOfCondition(
    condition: ViewCondition,
    view: ViewCode,
  ): CodeWriter | undefined {
    // 적용 여부: a literal false never applies; a variable · `true` wraps the term.
    if (condition.enabled === false) return undefined;
    const value = this.conditionValue(condition.value);
    const reads = condition.fields.map((path) => ({
      read: this.fieldRead(view.collectionId, path),
      list:
        resolveField(
          this.doc.collection(view.collectionId)?.schema,
          this.pathKey(view.collectionId, path),
        )?.type === "array",
    }));
    const termOf = (read: string, list: boolean) =>
      this.comparison(condition.op, read, value, list, condition.sensitivity);
    const term = reads.map(({ read, list }) => termOf(read, list));
    const inner = term.length > 1 ? `(${term.join(" || ")})` : term[0]!;
    const out = new CodeWriter();
    const skip = this.skipOf(condition, value);
    const enabled =
      typeof condition.enabled === "string" &&
      condition.enabled.startsWith("!var.")
        ? this.conditionValue(condition.enabled).code
        : undefined;
    const prefix = [enabled ? `!${enabled}` : undefined, ...skip].filter(
      Boolean,
    );
    if (prefix.length) out.write(`(${prefix.join(" || ")} || `);
    out.slot(inner, {
      kind: "condition",
      owner: view.owner,
      conditionId: condition.id,
      collectionId: view.collectionId,
    });
    if (prefix.length) out.write(")");
    return out.anchor(0, {
      kind: "condition",
      owner: view.owner,
      conditionId: condition.id,
    });
  }

  /** The value that skips the condition, as `v === …` terms (useFilter: an empty search matches). */
  private skipOf(
    condition: ViewCondition,
    value: { code: string; variable?: VariableCode },
  ): string[] {
    if (!value.variable) return [];
    const v = value.code;
    const skip = condition.skip ?? "empty";
    if (value.variable.selection)
      return skip === "empty"
        ? [`${v} === 'all'`, `${v}.size === 0`]
        : [`${v} === 'all'`, `${v}.has(${literal(skip)})`];
    if (skip !== "empty") return [`${v} === ${literal(skip)}`];
    const text = ["contains", "startsWith", "endsWith"].includes(condition.op);
    if (text) return [];
    if (value.variable.entry.valueType === "boolean") return [];
    return [
      `${v} === ${value.variable.entry.valueType === "number" ? "null" : "''"}`,
    ];
  }

  /** A `useFilter` function (`contains` …); another sensitivity than `base` is its own hook. */
  private filterFn(
    op: "contains" | "startsWith" | "endsWith",
    sensitivity?: string,
  ): string {
    if (!sensitivity || sensitivity === "base") {
      this.filterFns.add(op);
      return op;
    }
    const name = `${op}${capital(sensitivity)}`;
    const fns = this.sensitiveFns.get(sensitivity) ?? new Map<string, string>();
    fns.set(op, name);
    this.sensitiveFns.set(sensitivity, fns);
    return name;
  }
  private readonly sensitiveFns = new Map<string, Map<string, string>>();

  /** One comparison of a row's cell (`read`) with the value. */
  private comparison(
    op: ViewComparison,
    read: string,
    value: { code: string; variable?: VariableCode },
    list: boolean,
    sensitivity?: string,
  ): string {
    const v = value.code;
    const textOp = (name: "contains" | "startsWith" | "endsWith") => {
      const fn = this.filterFn(name, sensitivity);
      return list
        ? `${read}.some(x => ${fn}(String(x), ${v}))`
        : `${fn}(String(${read}), ${v})`;
    };
    switch (op) {
      case "equals":
        return `${read} === ${v}`;
      case "notEquals":
        return `${read} !== ${v}`;
      case "contains":
      case "startsWith":
      case "endsWith":
        return textOp(op);
      case "notContains":
        return `!${textOp("contains")}`;
      case "notStartsWith":
        return `!${textOp("startsWith")}`;
      case "notEndsWith":
        return `!${textOp("endsWith")}`;
      case "oneOf":
        return value.variable?.selection
          ? `${v}.has(${read})`
          : `${v}.includes(${read})`;
      case "containsAny":
        return value.variable?.selection
          ? `${read}.some(x => ${v}.has(x))`
          : `${read}.some(x => ${v}.includes(x))`;
      case "containsAll":
        return `[...${v}].every(x => ${read}.includes(x))`;
      case "gte":
        return `${read} >= ${v}`;
      case "gt":
        return `${read} > ${v}`;
      case "lte":
        return `${read} <= ${v}`;
      case "lt":
        return `${read} < ${v}`;
      case "between":
        return `${read} >= ${v}[0] && ${read} <= ${v}[1]`;
      case "before":
        return `String(${read}).slice(0, 10) < String(${v})`;
      case "after":
        return `String(${read}).slice(0, 10) > String(${v})`;
      case "withinLast":
        return `daysSince(${read}) <= ${v}`;
      case "exists":
        return `(${read} != null && ${read} !== '')`;
      case "notExists":
        return `(${read} == null || ${read} === '')`;
    }
  }

  /* ── value condition (a prop) ── */

  private propWhen(when: PropWhen): string {
    const [id, ...path] = when.subject.slice(5).split(".");
    const variable = this.variables.get(id!);
    if (!variable) return "false";
    const value = this.conditionValue(when.value);
    if (variable.selection) {
      const v = variable.name;
      if (path[0] === "size") {
        const op = this.comparison(when.op, `${v}.size`, value, false);
        return `${v} !== 'all' && ${op}`;
      }
      if (when.op === "notExists") return `${v} !== 'all' && ${v}.size === 0`;
      if (when.op === "exists") return `(${v} === 'all' || ${v}.size > 0)`;
    }
    const read = [variable.name, ...path].join(".");
    return this.comparison(when.op, read, value, false);
  }

  /* ── drag and drop ── */

  private dndNames = new Map<string, string>();

  private writeDragAndDrop(out: CodeWriter): void {
    // Lists whose rules drop, and lists whose items a drop rule writes (drag only).
    const writtenByDrop = new Set<string>();
    for (const rules of this.rules.values())
      for (const rule of rules)
        if (FOREIGN_DROPS.has(rule.trigger))
          for (const action of rule.actions)
            if ("collectionId" in action)
              writtenByDrop.add(action.collectionId);
    for (const node of this.nodes) {
      const rules = (this.rules.get(node.id) ?? []).filter((rule) =>
        DRAG_EVENTS.has(rule.trigger),
      );
      const bound = node.binding?.collectionId;
      // (Only a collection component drags — a Text reading the same data does not.)
      if (
        !this.itemType(this.doc.typeOf(node)) ||
        this.doc.typeOf(node) === "Select" ||
        this.doc.typeOf(node) === "ComboBox"
      )
        continue;
      const dragOnly = !rules.length && !!bound && writtenByDrop.has(bound);
      if (!rules.length && !dragOnly) continue;
      this.import("react-aria-components/useDragAndDrop", "useDragAndDrop");
      const type =
        this.rowSources.get(bound ?? "")?.name ?? this.nodeNames.get(node.id)!;
      const name = this.names.take(
        `${this.nodeNames.get(node.id)}DragAndDrop`,
        "dnd",
      );
      this.dndNames.set(node.id, name);
      const writes = new Set<string>();
      for (const rule of rules)
        if (FOREIGN_DROPS.has(rule.trigger))
          for (const action of rule.actions)
            if ("collectionId" in action) writes.add(action.collectionId);
      const ownWritten = !!bound && writtenByDrop.has(bound);
      const draggable =
        !bound ||
        ownWritten ||
        rules.some(
          (rule) =>
            rule.trigger === "onReorder" || rule.trigger === "onDragEnd",
        ) ||
        !writes.size;
      // (As the Preview: the collections its drop rules write — its own too when it reorders; a
      //  list whose drop rules write nothing takes its own items.)
      const reorders = rules.some((rule) => rule.trigger === "onReorder");
      const accepted = [
        ...new Set(
          (writes.size
            ? [...(reorders ? [bound] : []), ...writes]
            : [bound]
          ).filter(Boolean) as string[],
        ),
      ].map((id) => this.rowSources.get(id)?.name ?? id);
      const from = out.length;
      out.line(`let {dragAndDropHooks: ${name}} = useDragAndDrop({`);
      out.in();
      if (draggable)
        out.line(
          `getItems: keys => [...keys].map(key => ({${literal(type)}: String(key)})),`,
        );
      if (rules.length) {
        out.line(`acceptedDragTypes: [${accepted.map(literal).join(", ")}],`);
        out.line("getDropOperation: () => 'move',");
      }
      const byTrigger = new Map<string, InteractionEntry[]>();
      for (const rule of rules)
        byTrigger.set(rule.trigger, [
          ...(byTrigger.get(rule.trigger) ?? []),
          rule,
        ]);
      for (const [trigger, list] of byTrigger) {
        const foreign = FOREIGN_DROPS.has(trigger);
        out.start();
        if (foreign) out.write("async ");
        out.slot(trigger, {
          kind: "trigger",
          interactionIds: list.map((rule) => rule.id),
          ownerType: this.doc.typeOf(node),
        });
        out.write("(e) {").end().in();
        if (foreign) {
          this.import("react-aria-components/useDragAndDrop", "isTextDropItem");
          out.line(
            accepted.length === 1
              ? `let keys = await Promise.all(e.items.filter(isTextDropItem).map(item => item.getText(${literal(accepted[0])})));`
              : `let keys = await Promise.all(e.items.filter(isTextDropItem).map(item => item.getText([${accepted.map(literal).join(", ")}].find(type => item.types.has(type))!)));`,
          );
        }
        for (const rule of list)
          for (const action of rule.actions)
            this.writeAction(out, action, { node, trigger, fields: true });
        out.out().line("},");
      }
      out
        .out()
        .line("});")
        .anchor(from, { kind: "derived", key: `dnd:${node.id}` });
    }
  }

  /* ── actions ── */

  private eventValue(
    raw: unknown,
    context: { trigger: string; fields: boolean; args?: readonly string[] },
  ): string {
    if (typeof raw !== "string" || !raw.startsWith("!")) return literal(raw);
    if (raw.startsWith("!var.")) return this.conditionValue(raw).code;
    if (raw.startsWith("!event.")) {
      const [arg, ...path] = raw.slice(7).split(".");
      if (context.fields) {
        if (arg === "keys" && FOREIGN_DROPS.has(context.trigger))
          return ["keys", ...path].join(".");
        return ["e", arg, ...path].join(".");
      }
      const args = context.args ?? [];
      const name = arg === "value" ? (args[0] ?? "value") : arg!;
      return [identifier(name, "value"), ...path].join(".");
    }
    if (raw.startsWith("!item.")) {
      const [arg, ...path] = raw.slice(6).split(".");
      const keys = context.fields
        ? FOREIGN_DROPS.has(context.trigger)
          ? "keys"
          : `e.${arg}`
        : identifier(arg!, "keys");
      return `[...${keys}].map(key => list.getItem(key))${path.length ? `.map(row => row?.${path.join(".")})` : ""}`;
    }
    return literal(raw);
  }

  private writeAction(
    out: CodeWriter,
    action: InteractionAction,
    context: {
      node: NodeEntry;
      trigger: string;
      fields: boolean;
      args?: readonly string[];
    },
  ): void {
    const value = (raw: unknown) => this.eventValue(raw, context);
    const list =
      "collectionId" in action
        ? this.rowSources.get(action.collectionId)
        : undefined;
    const listName = list?.name ?? "list";
    switch (action.opcode) {
      case "setState": {
        const variable = this.variables.get(action.variableId);
        if (!variable)
          return void out.line(
            `// (a variable not on this page: ${action.variableId})`,
          );
        const setter = variable.setter;
        if (action.op === "toggle")
          return void out.line(
            typeof action.value === "string"
              ? `${setter}(v => v === ${literal(action.value)} ? ${literal(variable.entry.defaultValue)} : ${literal(action.value)});`
              : `${setter}(v => !v);`,
          );
        if (action.op === "increment")
          return void out.line(`${setter}(v => v + ${action.value ?? 1});`);
        if (action.op === "reset")
          return void out.line(`${setter}(${this.initialValue(variable)});`);
        let next = value(action.value);
        // (A key list into a text variable: a single selection's key. A ComboBox · Tabs report
        // the key itself — RAC `onSelectionChange(key)` — not a Set.)
        if (
          !variable.selection &&
          typeof action.value === "string" &&
          /^!event\.keys$/.test(action.value)
        )
          next =
            conceptStateOf(this.doc.typeOf(context.node), context.trigger)
              ?.valueType === "key"
              ? `${next} ?? ''`
              : `[...${next}][0] ?? ''`;
        return void out.line(`${setter}(${next});`);
      }
      case "update": {
        const key = value(action.key);
        const keys = typeof action.key === "string" && /keys$/.test(action.key);
        const field = action.field
          ? this.doc.fieldKey(action.collectionId, action.field)
          : undefined;
        const patch = field
          ? `{...${listName}.getItem(id), ${property(field)}: ${value(action.value)}}`
          : value(action.value);
        if (keys)
          out.line(`for (let id of ${key}) ${listName}.update(id, ${patch});`);
        else
          out.line(
            `${listName}.update(${key}, ${patch.replace(/\(id\)/, `(${key})`)});`,
          );
        return;
      }
      case "moveBefore":
      case "moveAfter": {
        const target = value(action.key);
        const keys = value(action.keys);
        if (action.dropPosition !== undefined) {
          const side = value(action.dropPosition);
          out.line(
            `if (${side} === 'before') ${listName}.moveBefore(${target}, ${keys});`,
          );
          out.line(
            `else if (${side} === 'after') ${listName}.moveAfter(${target}, ${keys});`,
          );
        } else out.line(`${listName}.${action.opcode}(${target}, ${keys});`);
        return;
      }
      case "move":
        return void out.line(
          `${listName}.move(${value(action.key)}, ${value(action.toIndex)});`,
        );
      case "removeSelectedItems":
        return void out.line(`${listName}.removeSelectedItems();`);
      case "remove":
        return void out.line(`${listName}.remove(...${value(action.keys)});`);
      case "append":
      case "prepend":
        return void out.line(
          `${listName}.${action.opcode}(${value(action.value)});`,
        );
      case "insert":
        return void out.line(
          `${listName}.insert(${value(action.index)}, ${value(action.value)});`,
        );
      case "insertBefore":
      case "insertAfter":
        return void out.line(
          `${listName}.${action.opcode}(${value(action.key)}, ${value(action.value)});`,
        );
      case "reload":
      case "loadMore":
        return void out.line(`${listName}.${action.opcode}();`);
      case "setFilterText":
        return void out.line(
          `${listName}.setFilterText(${value(action.value)});`,
        );
      case "toast":
        this.toasts = true;
        return void out.line(
          `toasts.add({title: ${literal(action.message)}});`,
        );
      case "navigate": {
        this.navigate = true;
        const page = this.doc.get(action.pageId);
        return void out.line(
          `navigate(${literal(page?.kind === "page" ? page.route : "/")});`,
        );
      }
      case "callEndpoint": {
        const endpoint = this.doc.input.endpoints?.find(
          (entry) =>
            `data:endpoint:${entry.id}` === action.endpointId ||
            entry.id === action.endpointId,
        );
        const method = endpoint?.method ?? "POST";
        const body =
          action.body !== undefined
            ? `, body: JSON.stringify(${value(action.body)})`
            : "";
        return void out.line(
          `await fetch(${literal(endpoint?.url ?? "")}, {method: ${literal(method)}${body}});`,
        );
      }
      case "capability": {
        if (!("nodeId" in action.target))
          return void out.line("// (a capability with no target)");
        const target = this.doc.node(action.target.nodeId);
        if (!target) return;
        const def = resolveCapabilities(this.doc.typeOf(target))[
          action.capabilityId
        ];
        if (!def)
          return void out.line(
            `// (${action.capabilityId}: not a capability of this component)`,
          );
        if (def.imperative)
          return void out.line(
            `${this.nodeNames.get(target.id)}Ref.current?.${action.capabilityId}();`,
          );
        const prop = def.prop.startsWith("style.") ? "isVisible" : def.prop;
        const state = this.namedStateOf(target.id, prop);
        if (!state) return;
        let next: string;
        if (def.prop.startsWith("style."))
          next =
            action.capabilityId === "hide"
              ? "false"
              : action.capabilityId === "show"
                ? "true"
                : "v => !v";
        else if (def.value === "!self") next = "v => !v";
        else if (def.value === "!param") {
          const param = value(action.value);
          next =
            def.op === "add"
              ? `v => new Set([...v, ${param}])`
              : def.op === "remove"
                ? `v => new Set([...v].filter(key => key !== ${param}))`
                : param;
        } else if (Array.isArray(def.value) && state.selection)
          next = "new Set()";
        else next = literal(def.value);
        return void out.line(`${state.setter}(${next});`);
      }
    }
  }

  /* ── JSX ── */

  /** A variable written only by `node`'s `callback` with its event value (the controlled pair). */
  private controlledBy(
    node: NodeEntry,
    type: string,
  ): Map<string, { variable: VariableCode; callback: string }> {
    const out = new Map<string, { variable: VariableCode; callback: string }>();
    for (const rule of this.rules.get(node.id) ?? []) {
      const state = stateProp(type, rule.trigger);
      const [action] = rule.actions;
      if (
        !state ||
        rule.actions.length !== 1 ||
        action?.opcode !== "setState" ||
        action.op !== "set"
      )
        continue;
      if (
        typeof action.value !== "string" ||
        !/^!event\.(value|keys|descriptor|isSelected)$/.test(action.value)
      )
        continue;
      const variable = this.variables.get(action.variableId);
      if (!variable || variable.entry.source) continue;
      // (Only writer: no other rule writes it.)
      const writers = this.doc.interactions.filter((other) =>
        other.actions.some(
          (item) =>
            item.opcode === "setState" && item.variableId === variable.entry.id,
        ),
      );
      if (writers.length !== 1) continue;
      // (Same start: the control's own default is the variable's.)
      const declared = this.propValue(node, state.defaultProp ?? state.prop);
      const single =
        !variable.selection && Array.isArray(declared) && declared.length === 1;
      const start = single
        ? JSON.stringify(declared[0])
        : variable.selection
          ? JSON.stringify(Array.isArray(declared) ? declared : [])
          : JSON.stringify(
              declared ?? (variable.entry.valueType === "boolean" ? false : ""),
            );
      const own = variable.selection
        ? JSON.stringify(
            Array.isArray(variable.entry.defaultValue)
              ? variable.entry.defaultValue
              : [],
          )
        : JSON.stringify(variable.entry.defaultValue);
      const sort = this.isSortVariable(variable.entry);
      if (start !== own && !sort) continue;
      out.set(rule.trigger, { variable, callback: rule.trigger });
      void state;
    }
    return out;
  }

  private propValue(node: NodeEntry, prop: string): unknown {
    const write = node.props[prop];
    return write?.kind === "set" ? write.value : undefined;
  }

  private writeJsx(out: CodeWriter): void {
    const roots = this.page.children.flatMap((id) => {
      const node = this.doc.node(id);
      // (The page's body is the page itself — its children are the fragment.)
      return node && isBodyType(this.doc.typeOf(node)) ? node.children : [id];
    });
    out.line("<>");
    out.in();
    for (const id of roots) this.writeNode(out, id, undefined);
    out.out();
    out.line("</>");
  }

  private writeNode(
    out: CodeWriter,
    id: string,
    row: string | undefined,
  ): void {
    const node = this.doc.node(id);
    if (!node) return;
    let type = this.doc.typeOf(node);
    if (type === "frame" || (type === "Group" && !node.props["aria-label"]))
      type = type === "frame" ? "div" : type;
    if (type !== "div") this.import("react-aria-components", type);
    const attributes: { part: CodeWriter; target: CodeViewAnchorTarget }[] = [];
    const attribute = (
      name: string,
      value: string | CodeWriter,
      source: "prop" | "state" | "dnd" = "prop",
    ) => {
      const part = new CodeWriter().write(`${name}=`);
      if (typeof value === "string") part.write(value);
      else part.append(value);
      attributes.push({
        part,
        target: { kind: "attribute", nodeId: node.id, name, source },
      });
    };
    let text: string | undefined;
    for (const [prop, write] of Object.entries(node.props)) {
      if (write.kind !== "set") continue;
      // (ADR-287 — a prop a rule's implicit state holds is that state: its start is this value.)
      if (this.ruleStates.has(`${node.id}\u0000${prop}`)) continue;
      const value = write.value as AuthoredValue;
      if (prop === "children" && typeof value === "string") {
        text = value;
        continue;
      }
      const code = this.propCode(value, row, prop);
      if (code !== undefined) attribute(prop, code);
    }
    // Rules → handlers; a variable this control only writes → its controlled prop too.
    const controlled = this.controlledBy(node, type);
    for (const [, { variable, callback }] of controlled) {
      const state = stateProp(type, callback)!;
      // (The control's state prop already reads the variable — 「검색 추가」 · 「변수로 정하기」.)
      if (node.props[state.prop]) continue;
      // (A single selection's key in a text variable: `selectedKeys={[album]}`.)
      attribute(
        state.prop,
        state.prop === "selectedKeys" && !variable.selection
          ? `{[${variable.name}]}`
          : `{${variable.name}}`,
        "state",
      );
    }
    for (const variable of this.variables.values())
      if (variable.entry.source?.nodeId === node.id) {
        const callback = callbackOf(type, variable.entry.source.prop);
        attribute(variable.entry.source.prop, `{${variable.name}}`, "state");
        if (
          callback &&
          !(this.rules.get(node.id) ?? []).some(
            (rule) => rule.trigger === callback,
          )
        )
          attribute(callback, `{${variable.setter}}`, "state");
      }
    for (const state of this.ruleStates.values())
      if (state.entry.ownerId === node.id) {
        const prop = (state.entry.id as string).split("\u0000")[1]!;
        if (prop === "isVisible") continue;
        attribute(prop, `{${state.name}}`, "state");
        const callback = callbackOf(type, prop);
        if (
          callback &&
          !(this.rules.get(node.id) ?? []).some(
            (rule) => rule.trigger === callback,
          )
        )
          attribute(callback, `{${state.setter}}`, "state");
      }
    const byTrigger = new Map<string, InteractionEntry[]>();
    for (const rule of this.rules.get(node.id) ?? [])
      if (!DRAG_EVENTS.has(rule.trigger))
        byTrigger.set(rule.trigger, [
          ...(byTrigger.get(rule.trigger) ?? []),
          rule,
        ]);
    for (const [trigger, rules] of byTrigger) {
      const handler = new CodeWriter();
      const slotTarget = {
        kind: "trigger" as const,
        interactionIds: rules.map((rule) => rule.id),
        ownerType: type,
      };
      const named = [...this.variables.values()].find(
        (variable) =>
          variable.entry.source?.nodeId === node.id &&
          callbackOf(type, variable.entry.source.prop) === trigger,
      );
      const value = this.handlerCode(
        rules,
        node,
        trigger,
        controlled.get(trigger)?.variable,
        named,
        out.depth,
      );
      const name = new CodeWriter().slot(trigger, slotTarget);
      const part = new CodeWriter().append(name).write("=");
      part.write(`{${value}}`);
      attributes.push({
        part,
        target: {
          kind: "attribute",
          nodeId: node.id,
          name: trigger,
          source: "handler",
          interactionIds: rules.map((rule) => rule.id),
        },
      });
      void handler;
    }
    const dnd = this.dndNames.get(node.id);
    if (dnd) attribute("dragAndDropHooks", `{${dnd}}`, "dnd");
    const binding = node.binding;
    const children = node.children;
    const visible = [...this.ruleStates.values()].find(
      (state) =>
        state.entry.ownerId === node.id &&
        (state.entry.id as string).endsWith("\u0000isVisible"),
    );
    out.start();
    const from = out.length;
    if (visible) out.write(`{${visible.name} && `);
    out.write(`<${type}`);
    for (const { part, target } of attributes) {
      out.write(" ");
      const at = out.length;
      out.append(part).anchor(at, target);
    }
    const text$ = (code: string) => {
      const at = out.length;
      out.write(code).anchor(at, { kind: "text", nodeId: node.id });
    };
    if (binding) {
      const rows = this.boundRows(node, binding);
      const item = this.itemType(type);
      if (item === undefined) {
        // (A keyed binding — one row: its text and the descendants read its fields.)
        if (text !== undefined && !children.length) {
          out.write(">");
          text$(this.textCode(text, rows));
          out.write(`</${type}>`);
        } else {
          out.write(">").end().in();
          if (text !== undefined)
            out.anchorLine(this.textCode(text, rows), {
              kind: "text",
              nodeId: node.id,
            });
          for (const child of children) this.writeNode(out, child, rows);
          out.out().start().write(`</${type}>`);
        }
      } else {
        out.write(" ");
        const at = out.length;
        out.write(`items={${rows}}`).anchor(at, {
          kind: "attribute",
          nodeId: node.id,
          name: "items",
          source: "items",
        });
        out.write(">").end().in();
        this.import("react-aria-components", item);
        const key =
          resolveField(this.doc.collection(binding.collectionId)?.schema, "id")
            ?.key ?? "id";
        const map = binding.fieldMap;
        const label =
          map.label ??
          map.title ??
          map.name ??
          map.value ??
          Object.values(map).find(
            (id) => this.doc.fieldKey(binding.collectionId, id) !== key,
          );
        const labelKey = label
          ? this.doc.fieldKey(binding.collectionId, label)
          : key;
        out.anchorLine(
          `{item => <${item} id={item.${key}} textValue={String(${member("item", labelKey)})}>{${member("item", labelKey)}}</${item}>}`,
          { kind: "rows", nodeId: node.id },
        );
        out.out().start().write(`</${type}>`);
      }
    } else if (!children.length && text === undefined) out.write(" />");
    else {
      out.write(">");
      if (text !== undefined && !children.length)
        text$(this.textCode(text, row));
      else {
        out.end().in();
        if (text !== undefined)
          out.anchorLine(this.textCode(text, row), {
            kind: "text",
            nodeId: node.id,
          });
        for (const child of children) this.writeNode(out, child, row);
        out.out().start();
      }
      out.write(`</${type}>`);
    }
    if (visible) out.write("}");
    out.anchor(from, { kind: "node", nodeId: node.id }).end();
  }

  /** A list's item component (undefined = not a collection — a keyed binding's container). */
  private itemType(type: string): string | undefined {
    return (
      {
        ListBox: "ListBoxItem",
        GridList: "GridListItem",
        Tree: "TreeItem",
        Menu: "MenuItem",
        TagGroup: "Tag",
        TagList: "Tag",
        Select: "ListBoxItem",
        ComboBox: "ListBoxItem",
        Table: "Row",
        TableBody: "Row",
        CardView: "Card",
      } as Record<string, string>
    )[type];
  }

  /** The rows a bound node shows: its view's, else the collection's (a key picks one). */
  private boundRows(node: NodeEntry, binding: DataBindingRef): string {
    const view = binding.viewId
      ? this.views.get(binding.viewId)
      : binding.view
        ? this.views.get(node.id)
        : undefined;
    const rows = view?.name ?? this.rowsOf(binding.collectionId);
    if (binding.key === undefined) return rows;
    const key = /^\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}$/.exec(binding.key);
    const variable = key
      ? [...this.variables.values()].find(
          (entry) => entry.entry.name === key[1],
        )
      : undefined;
    const keyCode = variable ? variable.name : literal(binding.key);
    return `${rows}.find(row => row.id === ${keyCode})`;
  }

  private textCode(text: string, row: string | undefined): string {
    const parts = text
      .split(/(\{\{\s*[A-Za-z_$][\w$.]*\s*\}\}|\{[A-Za-z_$#][\w$.#]*\})/)
      .filter(Boolean);
    if (parts.length === 1 && !/^\{/.test(parts[0]!)) return parts[0]!;
    return `{\`${parts
      .map((part) => {
        const template = /^\{\{\s*([A-Za-z_$][\w$.]*)\s*\}\}$/.exec(part);
        if (template) {
          const [name, ...path] = template[1]!.split(".");
          const variable = [...this.variables.values()].find(
            (entry) => entry.entry.name === name,
          );
          return `\${${[variable?.name ?? name, ...path].join(".")}}`;
        }
        const field = /^\{([A-Za-z_$#][\w$.#]*)\}$/.exec(part);
        if (field && row)
          return `\${${row}?.${field[1]!.replace(/^#/, "")} ?? ''}`;
        return part.replace(/`/g, "\\`");
      })
      .join("")}\`}`;
  }

  private propCode(
    value: AuthoredValue,
    row: string | undefined,
    prop = "",
  ): string | undefined {
    if (isPropWhen(value)) return `{${this.propWhen(value)}}`;
    if (isPropVar(value)) {
      const [id, ...path] = value.ref.slice(5).split(".");
      const variable = this.variables.get(id!);
      if (!variable) return undefined;
      const read = [variable.name, ...path].join(".");
      // A JSON array stays an array even when a key-list prop reads it. Only a scalar key
      // needs wrapping; changing the variable to a Set would discard repeated data values.
      const keyList =
        variable.selection ||
        (!path.length && variable.entry.valueType === "array");
      return /Keys$/.test(prop) && !keyList ? `{[${read}]}` : `{${read}}`;
    }
    if (typeof value === "string") {
      const whole = /^\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}$/.exec(value);
      if (whole) {
        const variable = [...this.variables.values()].find(
          (entry) => entry.entry.name === whole[1],
        );
        return `{${variable?.name ?? whole[1]}}`;
      }
      if (/\{\{|\{[A-Za-z_$#]/.test(value)) return this.textCode(value, row);
      return literal(value).replace(/^'(.*)'$/, '"$1"');
    }
    if (typeof value === "number" || typeof value === "boolean")
      return value === true ? "{true}" : `{${JSON.stringify(value)}}`;
    if (value && typeof value === "object" && "kind" in value) return undefined;
    return `{${literal(value)}}`;
  }

  /** A rule list on one When as the handler's code. */
  private handlerCode(
    rules: readonly InteractionEntry[],
    node: NodeEntry,
    trigger: string,
    controlled: VariableCode | undefined,
    named: VariableCode | undefined,
    depth: number,
  ): string {
    const args = eventArgNames(trigger)[0] ?? [];
    const fields = eventArgsAreFields(trigger);
    const actions = rules.flatMap((rule) => rule.actions);
    // `onChange={setSearch}` — a single Set state of the event's first value.
    const first = actions[0];
    if (
      controlled &&
      actions.length === 1 &&
      !named &&
      (controlled.selection ||
        !(first?.opcode === "setState" && first.value === "!event.keys"))
    )
      return controlled.setter;
    if (
      actions.length === 1 &&
      actions[0]!.opcode === "setState" &&
      actions[0]!.op === "set" &&
      !named
    ) {
      const variable = this.variables.get(actions[0]!.variableId);
      const value = actions[0]!.value;
      if (
        variable &&
        typeof value === "string" &&
        new RegExp(`^!event\\.(value|${args[0] ?? "value"})$`).test(value) &&
        (variable.selection || !/keys$/.test(value))
      )
        return variable.setter;
    }
    const body = new CodeWriter();
    for (let level = 0; level <= depth; level += 1) body.in();
    const context = { node, trigger, fields, args };
    if (named)
      body.line(`${named.setter}(${identifier(args[0] ?? "value", "value")});`);
    for (const action of actions) this.writeAction(body, action, context);
    const params = fields
      ? "e"
      : args.length
        ? args.map((arg) => identifier(arg, "value")).join(", ")
        : "";
    const isAsync = actions.some((action) => action.opcode === "callEndpoint");
    const text = body.done().code;
    return `${isAsync ? "async " : ""}(${params}) => {\n${text}${"  ".repeat(depth)}}`;
  }
}

/** A helper the `withinLast` comparison reads (emitted only when used — kept in the module). */
export const CODE_VIEW_DAYS_SINCE = `function daysSince(date) {\n  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);\n}`;

export type { Scalar };
