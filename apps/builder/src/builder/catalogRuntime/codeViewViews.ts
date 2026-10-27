/**
 * ADR-285 Decision 2 — the code view's data views read back. Every `let <view> = …` statement is a
 * view (a list's built-in one, or a shared one another view · a row reader also reads), and its
 * readers are the code's own references: a list's `items={<view>}`, a row reader's
 * `<view>.find(row => row.id === <key>)`, another view's source. The statements name the parts:
 * the `filter` terms (and `(… || …)` groups), the sort (`toSorted` — a literal field, or a sort
 * variable with its `<v>Dir` line), the count row (`[{id: 'row-1', count: <view>.length}]`), and
 * for a collection whose endpoint carries its view the request's parameters
 * (`url.searchParams.append(…)` · `set(_sort …)` in its `useAsyncList`). A view statement as the
 * baseline wrote it keeps its view (not read again); a form not read here (grouping) is refused when
 * edited. The planned commands are checked like the rest (the regenerated code).
 */
import type {
  CatalogCommand,
  CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands";
import { stageOver } from "../../../../../packages/shared/src/catalog/commands";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import {
  addView,
  catalogViewUsers,
  removeView,
  updateView,
} from "../../../../../packages/shared/src/catalog/commands/views";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
  ViewAggregate,
  ViewComparison,
  ViewCondition,
  ViewConditionGroup,
  ViewEntry,
  ViewQuery,
  ViewSort,
} from "../../../../../packages/shared/src/catalog/document/types";
import { DEFAULT_QUERY_SUFFIXES } from "../../../../../packages/shared/src/collections/view/serialize";
import {
  literalOf,
  termOf,
} from "../../../../../packages/shared/src/codeView/inverse";
import {
  codeViewNormalized,
  type CodeViewElement,
  type CodeViewParsed,
  type CodeViewStatement,
} from "../../../../../packages/shared/src/codeView/inverse/parse";
import type {
  CodeViewCollection,
  CodeViewResult,
} from "../../../../../packages/shared/src/codeView/types";
import { catalogBindingCommand } from "./dataBindingCommand";

const COLLECTION = "data:collection:";
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** A sort variable's direction line (`let <v>Dir = <v>?.direction === 'descending' ? -1 : 1;`). */
const DIR = /^let ([\w$]+) = ([\w$]+)\?\.direction === 'descending' \? -1 : 1;$/;

type Reason = "outsideVocabulary" | "unknownReference" | "notInCode";

export interface CodeViewViewsInput {
  readonly reader: CatalogReader;
  readonly edited: CodeViewParsed;
  readonly baseline: CodeViewResult;
  readonly baselineParsed: CodeViewParsed;
  readonly collections: readonly CodeViewCollection[];
  /** Code name → variable id (as the edited code names them). */
  readonly variables: ReadonlyMap<string, string>;
  /** Each element's node id after identity (kept · new). */
  readonly ids: ReadonlyMap<CodeViewElement, string>;
  /** Elements whose text · props read a row (`<rows>.find(row => row.id === …)`). */
  readonly rowReaders: ReadonlyMap<CodeViewElement, string>;
  readonly newId: NewId;
  readonly strict: boolean;
  reject(from: number, reason: Reason, detail?: string): void;
  step(from: number, command: CatalogCommand): void;
}

/** A collection's rows as the code names them (`users` · `users.items`). */
interface Rows {
  readonly collectionId: string;
  readonly collection: CodeViewCollection;
  readonly async: boolean;
}

/** A view statement read (its parts by name — the document's query is made from them). */
interface Spec {
  readonly name: string;
  readonly statement: CodeViewStatement;
  /** The rows or the view it reads. */
  readonly source: { rows: Rows } | { view: string };
  readonly terms?: string;
  readonly sort?:
    | { readonly variable: string }
    | { readonly key: string; readonly descending: boolean };
  readonly aggregates?: readonly { as: string; code: string }[];
  /** `Map.groupBy(<rows>, item => item.<key>)` — 「모든 값」 when every value is a group. */
  readonly groupBy?: { readonly key: string; readonly all: boolean };
}

/** Who owns a view in the document: a list's built-in view, or a shared view entry. */
type Owner = { nodeId: string } | { viewId: string };

export function planCodeViews(input: CodeViewViewsInput): void {
  new ViewPlanner(input).plan();
}

class ViewPlanner {
  private readonly rows = new Map<string, Rows>();
  private readonly specs = new Map<string, Spec>();
  /** `let <v>Dir = <v>?.direction === 'descending' ? -1 : 1;` — the sort variable it reads. */
  private readonly dirs = new Map<string, string>();
  /** Baseline view statements (normalized) → their owner. */
  private readonly baselineOwners = new Map<string, Owner>();
  private readonly baselineNames = new Map<string, Owner>();

  constructor(private readonly input: CodeViewViewsInput) {
    for (const collection of input.collections) {
      // (`users` a file's rows · `users.items` a `useListData` · `useAsyncList`'s.)
      const name = codeName(collection.name);
      const rows = {
        collectionId: `${COLLECTION}${collection.id}`,
        collection,
        async: !!collection.endpoint,
      };
      if (!rows.async) this.rows.set(name, rows);
      this.rows.set(`${name}.items`, rows);
    }
    const anchors = input.baseline.anchors.filter(
      (anchor) => anchor.target.kind === "view",
    );
    for (const statement of input.baselineParsed.statements) {
      if (statement.kind !== "view" || DIR.test(statement.code)) continue;
      const anchor = anchors.find(
        (item) => item.start <= statement.from && item.end >= statement.to,
      );
      if (!anchor) continue;
      const owner = (anchor.target as { owner: Owner }).owner;
      this.baselineOwners.set(codeViewNormalized(statement.code), owner);
      if (statement.name) this.baselineNames.set(statement.name, owner);
    }
  }

  private get reader() {
    return this.input.reader;
  }

  plan(): void {
    // Read the statements: views by name; a dir line belongs to its view's sort.
    const helpers = new Set<CodeViewStatement>();
    for (const statement of this.input.edited.statements) {
      if (statement.kind !== "view") continue;
      const dir = DIR.exec(statement.code);
      if (dir) {
        this.dirs.set(dir[1]!, dir[2]!);
        helpers.add(statement);
      }
    }
    // A grouping is three statements: its rows, `Map.groupBy` and the groups' rows (one view).
    const groups = new Map<string, { rows: string; key: string }>();
    for (const statement of this.input.edited.statements) {
      const group =
        /^let ([\w$]+) = Map\.groupBy\(([\w$]+), item => item\.([\w$]+)\);$/.exec(
          statement.code,
        );
      if (statement.kind !== "view" || !group) continue;
      groups.set(group[1]!, { rows: group[2]!, key: group[3]! });
      helpers.add(statement);
    }
    const groupRows = new Set([...groups.values()].map((group) => group.rows));
    const statements = new Map(
      this.input.edited.statements
        .filter((item) => item.kind === "view" && item.name)
        .map((item) => [item.name!, item]),
    );
    for (const statement of this.input.edited.statements) {
      if (statement.kind !== "view" || helpers.has(statement)) continue;
      if (groupRows.has(statement.name!)) continue;
      const unchanged = this.baselineOwners.has(
        codeViewNormalized(statement.code),
      );
      const spec = this.groupedOf(statement, groups, statements, unchanged) ??
        this.specOf(statement, unchanged);
      if (spec) this.specs.set(spec.name, spec);
    }

    // Readers: lists (`items={v}`), row readers (`v.find(row => …)`), other views (sources).
    const lists = new Map<string, { element: CodeViewElement; id: string }[]>();
    const rowReaders = new Map<
      string,
      { element: CodeViewElement; id: string; key: string }[]
    >();
    const visit = (elements: readonly CodeViewElement[]) => {
      for (const element of elements) {
        const id = this.input.ids.get(element);
        const items = element.attributes.find((item) => item.name === "items");
        const name =
          items?.value?.kind === "expression" ? items.value.code.trim() : "";
        if (items && id) {
          if (!this.specs.has(name) && !this.rows.has(name))
            this.input.reject(items.from, "unknownReference", name);
          else lists.set(name, [...(lists.get(name) ?? []), { element, id }]);
        }
        const read = this.input.rowReaders.get(element);
        if (read && id) {
          const m = /^([\w$.]+)\.find\(row => row\.id === (.+)\)$/.exec(read);
          if (!m || (!this.specs.has(m[1]!) && !this.rows.has(m[1]!)))
            this.input.reject(element.from, "unknownReference", read);
          else
            rowReaders.set(m[1]!, [
              ...(rowReaders.get(m[1]!) ?? []),
              { element, id, key: m[2]! },
            ]);
        }
        if (!element.rows) visit(element.children);
      }
    };
    visit(this.input.edited.jsx?.roots ?? []);
    const viewReaders = new Map<string, string[]>();
    for (const spec of this.specs.values())
      if ("view" in spec.source) {
        if (!this.specs.has(spec.source.view)) {
          this.input.reject(
            spec.statement.from,
            "unknownReference",
            spec.source.view,
          );
          continue;
        }
        viewReaders.set(spec.source.view, [
          ...(viewReaders.get(spec.source.view) ?? []),
          spec.name,
        ]);
      }

    // Owners: the baseline's by name; a new view read by one list only (over rows, no count) is
    // that list's built-in view, any other is a shared view.
    const owners = new Map<string, Owner>();
    const created = new Set<string>();
    for (const spec of this.specs.values()) {
      const readers = lists.get(spec.name) ?? [];
      const shared =
        readers.length !== 1 ||
        (viewReaders.get(spec.name)?.length ?? 0) > 0 ||
        (rowReaders.get(spec.name)?.length ?? 0) > 0 ||
        "view" in spec.source ||
        !!spec.aggregates ||
        !!spec.groupBy;
      const before = this.baselineNames.get(spec.name);
      if (before && "viewId" in before) owners.set(spec.name, before);
      else if (
        before &&
        !shared &&
        readers[0]!.id === (before as { nodeId: string }).nodeId
      )
        owners.set(spec.name, before);
      else if (!shared) owners.set(spec.name, { nodeId: readers[0]!.id });
      else {
        owners.set(spec.name, { viewId: this.input.newId("view") });
        created.add(spec.name);
      }
    }

    // Queries (sources first — a shared view's source is an entry).
    const queries = new Map<string, ViewQuery>();
    for (const spec of this.specs.values()) {
      const query = this.queryOf(spec, owners.get(spec.name)!);
      if (query) queries.set(spec.name, query);
    }
    const order: Spec[] = [];
    const placed = new Set<string>();
    const place = (spec: Spec) => {
      if (placed.has(spec.name)) return;
      placed.add(spec.name);
      if ("view" in spec.source) {
        const source = this.specs.get(spec.source.view);
        if (source) place(source);
      }
      order.push(spec);
    };
    this.specs.forEach(place);
    const collectionOf = (spec: Spec): string | undefined =>
      "rows" in spec.source
        ? spec.source.rows.collectionId
        : this.specs.has(spec.source.view)
          ? collectionOf(this.specs.get(spec.source.view)!)
          : undefined;

    // Shared views: added · edited.
    for (const spec of order) {
      const owner = owners.get(spec.name)!;
      const query = queries.get(spec.name);
      if (!("viewId" in owner) || !query) continue;
      const source =
        "rows" in spec.source
          ? { collectionId: spec.source.rows.collectionId }
          : {
              viewId: (owners.get(spec.source.view) as { viewId: string })
                ?.viewId,
            };
      if ("viewId" in source && !source.viewId) {
        this.input.reject(spec.statement.from, "notInCode", spec.name);
        continue;
      }
      const entry = {
        kind: "view",
        id: owner.viewId,
        name: created.has(spec.name)
          ? spec.name
          : ((this.reader.getEntry(owner.viewId) as ViewEntry | undefined)
              ?.name ?? spec.name),
        source,
        ...query,
      } as ViewEntry;
      const current = this.reader.getEntry(owner.viewId) as
        ViewEntry | undefined;
      if (created.has(spec.name))
        this.input.step(spec.statement.from, addView({ entry }));
      else if (JSON.stringify(entry) !== JSON.stringify(current))
        this.input.step(spec.statement.from, updateView({ entry }));
    }

    // Bindings: each list's rows · view, each row reader's view · key.
    for (const [name, readers] of lists)
      for (const { element, id } of readers) {
        const spec = this.specs.get(name);
        const owner = spec ? owners.get(name) : undefined;
        const rows = spec ? undefined : this.rows.get(name);
        const collectionId = rows?.collectionId ?? collectionOf(spec!);
        if (!collectionId) continue;
        this.bind(element, id, (binding) => {
          const {
            view: _view,
            viewId: _viewId,
            ...rest
          } = binding ?? {
            collectionId,
            fieldMap: this.fieldMapOf(element, collectionId),
          };
          if (!owner) return { ...rest, collectionId } as DataBindingRef;
          if ("viewId" in owner)
            return {
              ...rest,
              collectionId,
              viewId: owner.viewId,
            } as DataBindingRef;
          const query = queries.get(name);
          const current =
            binding?.view ??
            (this.reader.getEntry(id) as NodeEntry | undefined)?.binding?.view;
          return {
            ...rest,
            collectionId,
            ...(query ? { view: query } : current ? { view: current } : {}),
          } as DataBindingRef;
        });
      }
    for (const [name, readers] of rowReaders)
      for (const { element, id, key } of readers) {
        const spec = this.specs.get(name);
        const owner = spec ? owners.get(name) : undefined;
        const collectionId =
          this.rows.get(name)?.collectionId ?? collectionOf(spec!);
        if (!collectionId) continue;
        const keyValue = this.keyOf(key, element.from);
        if (keyValue === undefined) continue;
        if (owner && !("viewId" in owner)) {
          this.input.reject(element.from, "notInCode", name);
          continue;
        }
        this.bind(
          element,
          id,
          (binding) =>
            ({
              ...(binding ?? { fieldMap: {} }),
              collectionId,
              ...(owner ? { viewId: owner.viewId } : {}),
              key: keyValue,
            }) as DataBindingRef,
        );
      }

    // Shared views the code no longer names (and nothing reads after this edit).
    for (const [name, owner] of this.baselineNames)
      if ("viewId" in owner && !this.specs.has(name))
        this.input.step(0, (reader) => {
          const view = reader.getEntry(owner.viewId);
          if (
            view?.kind !== "view" ||
            catalogViewUsers(reader, owner.viewId as EntryId<"view">).length
          )
            return { label: "Delete view", ops: [] };
          return removeView({ id: owner.viewId as EntryId<"view"> })(reader);
        });
  }

  /** A binding written when it changes (the node as staged then — a new one is there). */
  private bind(
    element: CodeViewElement,
    id: string,
    next: (binding: DataBindingRef | undefined) => DataBindingRef,
  ): void {
    const before = (this.reader.getEntry(id) as NodeEntry | undefined)?.binding;
    if (before && JSON.stringify(next(before)) === JSON.stringify(before))
      return;
    this.input.step(element.from, (reader) => {
      const node = reader.getEntry(id) as NodeEntry | undefined;
      const binding = next(node?.binding);
      if (
        node?.binding &&
        JSON.stringify(binding) === JSON.stringify(node.binding)
      )
        return { label: "Bind", ops: [] };
      const stage = stageOver(reader);
      const ops: CatalogCommandPlan["ops"][number][] = [];
      const plan = catalogBindingCommand(
        [{ kind: "node", id: id as NodeId }],
        binding,
      )(stage);
      ops.push(...plan.ops);
      return { label: "Bind", ops };
    });
  }

  /** A new list's field map: the rows' label field (`{item.<label>}`), when not the key. */
  private fieldMapOf(
    element: CodeViewElement,
    collectionId: string,
  ): DataBindingRef["fieldMap"] {
    const label = /\{item\.([\w$]+)\}<\//.exec(element.rows?.code ?? "")?.[1];
    const key = /id=\{item\.([\w$]+)\}/.exec(element.rows?.code ?? "")?.[1];
    const field = label
      ? this.input.baseline.symbols.fields[collectionId]?.[label]
      : undefined;
    return label && label !== key && field
      ? ({ label: field } as DataBindingRef["fieldMap"])
      : {};
  }

  /** A row reader's key: a literal, or a variable (`{{name}}`). */
  private keyOf(code: string, from: number): string | undefined {
    const text = code.trim();
    if (IDENTIFIER.test(text)) {
      const id = this.input.variables.get(text);
      const entry = id ? this.reader.getEntry(id) : undefined;
      if (entry?.kind !== "stateVariable") {
        this.input.reject(from, "unknownReference", text);
        return undefined;
      }
      return `{{${entry.name}}}`;
    }
    const value = literalOf(text);
    if (typeof value === "string" || typeof value === "number")
      return String(value);
    this.input.reject(from, "outsideVocabulary", text);
    return undefined;
  }

  /* ── one view statement ── */

  /**
   * A grouping view: `let <v> = [...<v>Groups].map(([k, rows]) => ({id: k, <key>: k, …}))` (or
   * every value of the data — `[...new Set(<rows>.map(item => item.<key>))].map(…)`), its groups
   * over `<v>Rows` (the filtered rows — a view statement of its own shape). Undefined = not one.
   */
  private groupedOf(
    statement: CodeViewStatement,
    groups: ReadonlyMap<string, { rows: string; key: string }>,
    statements: ReadonlyMap<string, CodeViewStatement>,
    unchanged: boolean,
  ): Spec | undefined {
    const code = statement.code.replace(/\s*\n\s*/g, " ");
    const m =
      /^let ([\w$]+) = (?:\[\.\.\.([\w$]+)\]|\[\.\.\.new Set\(([\w$.]+)\.map\(item => item\.([\w$]+)\)\)\]\.map\(([\w$]+) => \[\5, ([\w$]+)\.get\(\5\) \?\? \[\]\]\))\.map\(\(\[([\w$]+), rows\]\) => \(\{id: \7, ([\w$]+): \7(?:, (.+))?\}\)\)(.*)$/.exec(
        code,
      );
    if (!m) return undefined;
    const groupName = m[2] ?? m[6]!;
    const group = groups.get(groupName);
    const rowsStatement = group ? statements.get(group.rows) : undefined;
    if (!group || !rowsStatement || group.key !== m[8] || (m[4] && m[4] !== group.key)) {
      this.input.reject(statement.from, "outsideVocabulary", statement.name);
      return undefined;
    }
    const rowsUnchanged = this.baselineOwners.has(
      codeViewNormalized(rowsStatement.code),
    );
    // (The rows statement is the view's conditions: read it as a view of its own, renamed.)
    const rows = this.specOf(
      {
        ...rowsStatement,
        code: rowsStatement.code.replace(/;$/, `${m[10]!.trim()}`),
      },
      rowsUnchanged && unchanged,
    );
    if (!rows) return undefined;
    const aggregates = m[9]
      ? splitTop(m[9], ",").map((part) => {
          const field = /^([\w$]+): ([\s\S]+)$/.exec(part.trim());
          return field ? { as: field[1]!, code: field[2]! } : undefined;
        })
      : [];
    if (aggregates.some((item) => !item)) {
      this.input.reject(statement.from, "outsideVocabulary", statement.name);
      return undefined;
    }
    return {
      ...rows,
      name: statement.name!,
      statement,
      ...(aggregates.length
        ? { aggregates: aggregates as { as: string; code: string }[] }
        : {}),
      groupBy: { key: group.key, all: !!m[3] },
    };
  }

  private specOf(
    statement: CodeViewStatement,
    unchanged: boolean,
  ): Spec | undefined {
    const name = statement.name!;
    const code = statement.code.replace(/\s*\n\s*/g, " ");
    const refuse = () => {
      if (unchanged && !this.input.strict) return undefined;
      this.input.reject(statement.from, "outsideVocabulary", name);
      return undefined;
    };
    const sourceOf = (text: string): Spec["source"] | undefined => {
      const rows = this.rows.get(text);
      if (rows) return { rows };
      if (IDENTIFIER.test(text)) return { view: text };
      return undefined;
    };
    // A count row: `[{id: 'row-1', <as>: <view>.length, …}]`.
    const count = /^let [\w$]+ = \[\{id: 'row-1', (.+)\}\];$/.exec(code);
    if (count) {
      const fields = splitTop(count[1]!, ",").map((part) => {
        const m = /^([\w$]+): ([\s\S]+)$/.exec(part.trim());
        return m ? { as: m[1]!, code: m[2]! } : undefined;
      });
      const source = fields
        .map(
          (field) =>
            /^([\w$.]+)\.(?:length|reduce|map)\b/.exec(field?.code ?? "")?.[1],
        )
        .find(Boolean);
      if (fields.some((field) => !field) || !source) {
        // (An `applied` count only: its source is the view's own, as written before.)
        if (!fields.every(Boolean)) return refuse();
      }
      // (An `applied` count names no source: as the baseline wrote it, its view's source.)
      let at = sourceOf(source ?? "");
      if (!at && unchanged) {
        const owner = this.baselineOwners.get(codeViewNormalized(statement.code));
        const view =
          owner && "viewId" in owner
            ? (this.reader.getEntry(owner.viewId) as ViewEntry | undefined)
            : undefined;
        const from =
          view && "viewId" in view.source ? view.source.viewId : undefined;
        const sourceName = [...this.baselineNames].find(
          ([, item]) => "viewId" in item && item.viewId === from,
        )?.[0];
        if (sourceName) at = { view: sourceName };
      }
      if (!at) return refuse();
      return {
        name,
        statement,
        source: at,
        aggregates: fields as { as: string; code: string }[],
      };
    }
    const head = /^let [\w$]+ = ([\w$.]+)/.exec(code);
    if (!head) return refuse();
    let rest = code.slice(head[0].length).trim();
    const source = sourceOf(head[1]!);
    if (!source) return refuse();
    let terms: string | undefined;
    let sort: Spec["sort"];
    if (rest.startsWith(".filter(item =>")) {
      const end = closing(rest, ".filter".length);
      if (end < 0) return refuse();
      terms = rest.slice(".filter(item =>".length, end).trim();
      rest = rest.slice(end + 1).trim();
    }
    if (rest.startsWith(".toSorted((a, b) =>")) {
      const end = closing(rest, ".toSorted".length);
      if (end < 0) return refuse();
      const body = rest.slice(".toSorted((a, b) =>".length, end).trim();
      rest = rest.slice(end + 1).trim();
      const byVariable =
        /^([\w$]+) \? collator\.compare\(String\(a\[\1\.column\]\), String\(b\[\1\.column\]\)\) \* ([\w$]+) : 0$/.exec(
          body,
        );
      const byField =
        /^collator\.compare\(String\(a\.([\w$.]+)\), String\(b\.\1\)\)( \* -1)?$/.exec(
          body,
        );
      if (byVariable && this.dirs.get(byVariable[2]!) === byVariable[1])
        sort = { variable: byVariable[1]! };
      else if (byField) sort = { key: byField[1]!, descending: !!byField[2] };
      else return refuse();
    }
    if (rest !== ";") return refuse();
    return {
      name,
      statement,
      source,
      ...(terms !== undefined ? { terms } : {}),
      ...(sort ? { sort } : {}),
    };
  }

  /** A view statement's document query (undefined = refused · nothing to read). */
  private queryOf(spec: Spec, owner: Owner): ViewQuery | undefined {
    const unchanged = this.baselineOwners.has(
      codeViewNormalized(spec.statement.code),
    );
    const current: ViewQuery | undefined =
      "viewId" in owner
        ? (this.reader.getEntry(owner.viewId) as ViewEntry | undefined)
        : (this.reader.getEntry(owner.nodeId) as NodeEntry | undefined)?.binding
            ?.view;
    const rows =
      "rows" in spec.source
        ? spec.source.rows
        : this.rowsOfView(spec.source.view);
    const served = rows?.async && rows.collection.endpoint?.querySerialization;
    // (As the baseline wrote it, over the same request: the document's query stays.)
    if (
      unchanged &&
      !this.input.strict &&
      current &&
      !(served && this.requestChanged(rows!))
    ) {
      const {
        kind: _k,
        id: _i,
        name: _n,
        source: _s,
        ...query
      } = current as ViewEntry;
      return query as ViewQuery;
    }
    if (!rows) return undefined;
    const collectionId = rows.collectionId;
    const existing = new Map<string, ViewCondition>();
    const collect = (group: ViewConditionGroup | undefined) =>
      group?.items.forEach((item) =>
        "items" in item ? collect(item) : existing.set(item.id, item),
      );
    collect(current?.where);
    const reuse = (condition: ViewCondition): ViewCondition => {
      const same = [...existing.values()].find(
        (item) =>
          JSON.stringify({ ...item, id: "" }) ===
          JSON.stringify({ ...condition, id: "" }),
      );
      if (!same) return condition;
      existing.delete(same.id);
      return same;
    };
    let items: (ViewCondition | ViewConditionGroup)[] = [];
    let sort: ViewSort | undefined;
    if (
      served &&
      served.kind === "suffix" &&
      "rows" in spec.source &&
      spec.terms === undefined &&
      !spec.sort &&
      !spec.aggregates
    ) {
      const request = this.requestOf(rows, spec);
      if (!request) return undefined;
      items = request.items.map(reuse);
      sort = request.sort;
    } else {
      for (const term of spec.terms ? splitTop(spec.terms, "&&") : []) {
        const item = this.itemOf(term, collectionId, spec.statement.from);
        if (!item) return undefined;
        items.push(
          "items" in item
            ? {
                ...item,
                items: item.items.map((c) => reuse(c as ViewCondition)),
              }
            : reuse(item),
        );
      }
      if (spec.sort) {
        if ("variable" in spec.sort) {
          const id = this.input.variables.get(spec.sort.variable);
          if (!id) {
            this.input.reject(
              spec.statement.from,
              "unknownReference",
              spec.sort.variable,
            );
            return undefined;
          }
          sort = { variableId: id as never };
        } else {
          const field =
            this.input.baseline.symbols.fields[collectionId]?.[spec.sort.key];
          if (!field) {
            this.input.reject(
              spec.statement.from,
              "unknownReference",
              spec.sort.key,
            );
            return undefined;
          }
          sort = {
            field: [field as never],
            direction: spec.sort.descending ? "descending" : "ascending",
          };
        }
      }
    }
    let aggregates: ViewAggregate[] | undefined;
    if (spec.aggregates) {
      aggregates = [];
      for (const { as, code } of spec.aggregates) {
        const aggregate = this.aggregateOf(as, code, collectionId);
        if (!aggregate) {
          this.input.reject(spec.statement.from, "outsideVocabulary", as);
          return undefined;
        }
        aggregates.push(aggregate);
      }
    }
    const {
      where: _where,
      sort: _sort,
      aggregates: _aggregates,
      kind: _kind,
      id: _id,
      name: _name,
      source: _source,
      ...others
    } = (current ?? {}) as ViewEntry;
    void _where;
    void _sort;
    void _aggregates;
    void _kind;
    void _id;
    void _name;
    void _source;
    let groupBy: ViewQuery["groupBy"];
    if (spec.groupBy) {
      const field =
        this.input.baseline.symbols.fields[collectionId]?.[spec.groupBy.key];
      if (!field) {
        this.input.reject(
          spec.statement.from,
          "unknownReference",
          spec.groupBy.key,
        );
        return undefined;
      }
      groupBy = [[field as never]];
    }
    const {
      groupBy: _groupBy,
      emptyGroups: _emptyGroups,
      ...kept
    } = others as ViewQuery;
    void _groupBy;
    void _emptyGroups;
    return {
      ...kept,
      where: { id: current?.where.id ?? "where", op: "and", items },
      ...(groupBy ? { groupBy } : {}),
      ...(spec.groupBy?.all ? { emptyGroups: "all" as const } : {}),
      ...(aggregates ? { aggregates } : {}),
      ...(sort ? { sort } : {}),
    };
  }

  /** `<as>: <view>.length` · `.reduce(…)` · `.map(…)` · the applied conditions' count. */
  private aggregateOf(
    as: string,
    code: string,
    collectionId: string,
  ): ViewAggregate | undefined {
    if (/^[\w$.]+\.length$/.test(code)) return { fn: "count", as };
    if (/^\[[\s\S]*\]\.filter\(Boolean\)\.length$|^0$/.test(code))
      return { fn: "applied", as };
    const fieldOf = (key: string) => {
      const id = this.input.baseline.symbols.fields[collectionId]?.[key];
      return id ? ([id] as never) : undefined;
    };
    const sum =
      /^[\w$.]+\.reduce\(\(sum, row\) => sum \+ Number\(row\.([\w$.]+) \?\? 0\), 0\)( \/ [\w$.]+\.length)?$/.exec(
        code,
      );
    if (sum) {
      const field = fieldOf(sum[1]!);
      return field ? { fn: sum[2] ? "mean" : "sum", field, as } : undefined;
    }
    const pick =
      /^[\w$.]+\.map\(row => row\.([\w$.]+)\)\.toSorted\(\)(\[0\]|\.at\(-1\))$/.exec(
        code,
      );
    if (pick) {
      const field = fieldOf(pick[1]!);
      return field
        ? { fn: pick[2] === "[0]" ? "min" : "max", field, as }
        : undefined;
    }
    return undefined;
  }

  /**
   * One top-level `filter` term: a condition, or an `(a || b)` group of them. The same comparison
   * over different fields reads as one condition of several fields (the generator writes both
   * alike — the code is the same either way); repeated fields or different comparisons are a group.
   */
  private itemOf(
    term: string,
    collectionId: string,
    from: number,
  ): ViewCondition | ViewConditionGroup | undefined {
    const group = /^\(([\s\S]*)\)$/.exec(term.trim());
    const parts = group ? splitTop(group[1]!, "||") : [];
    if (parts.length > 1) {
      const items = parts.map((part) => this.conditionOf(part, collectionId));
      if (items.every(Boolean)) {
        const shape = (item: ViewCondition) =>
          JSON.stringify({ ...item, id: "", fields: [] });
        const fields = items.map((item) => JSON.stringify(item!.fields));
        const severalFields =
          items.every(
            (item) =>
              item!.fields.length === 1 && shape(item!) === shape(items[0]!),
          ) && new Set(fields).size === fields.length;
        if (!severalFields)
          return {
            id: `or-${this.input.newId("node").slice(-8)}`,
            op: "or",
            items: items as ViewCondition[],
          };
      }
    }
    const condition = this.conditionOf(term.trim(), collectionId);
    if (condition) return condition;
    this.input.reject(from, "outsideVocabulary", term.trim());
    return undefined;
  }

  /** One term (with its 적용 · skip guard) → a condition. */
  private conditionOf(
    term: string,
    collectionId: string,
  ): ViewCondition | undefined {
    let text = term;
    let skip: ViewCondition["skip"];
    let enabled: ViewCondition["enabled"];
    const guarded = /^\(([\s\S]*)\)$/.exec(text);
    if (guarded) {
      const parts = splitTop(guarded[1]!, "||");
      const guard = (part: string) =>
        /^![\w$]+$/.test(part) ||
        new RegExp(String.raw`^([\w$]+)(?: === .+|\.size === 0|\.has\(.+\))$`)
          .exec(part)
          ?.slice(1)
          .every((name) => this.input.variables.has(name));
      if (parts.length > 1 && parts.slice(0, -1).every(guard)) {
        const prefix = parts.slice(0, -1);
        if (prefix[0]!.startsWith("!")) {
          const id = this.input.variables.get(prefix.shift()!.slice(1));
          if (!id) return undefined;
          enabled = `!var.${id}`;
        }
        const has = prefix
          .map((part) => /\.has\((.+)\)$/.exec(part)?.[1])
          .find(Boolean);
        const literal =
          has ??
          (prefix.length === 1 ? /=== (.+)$/.exec(prefix[0]!)?.[1] : undefined);
        if (literal && literal !== "''" && literal !== "null")
          skip = literalOf(literal) as ViewCondition["skip"];
        text = parts.at(-1)!;
      }
    }
    const symbols = {
      variables: Object.fromEntries(this.input.variables),
      fields: this.input.baseline.symbols.fields,
    };
    const read = termOf(text, { symbols }, collectionId);
    if (!read) return undefined;
    // (`startsWithVariant` — a `useFilter` of another sensitivity than `base`.)
    const sensitivity = /\b(?:contains|startsWith|endsWith)([A-Z][a-z]+)\(/.exec(
      text,
    )?.[1];
    return {
      id: `code-${this.input.newId("node").slice(-8)}`,
      ...read,
      ...(sensitivity ? { sensitivity: sensitivity.toLowerCase() } : {}),
      ...(skip !== undefined ? { skip } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    } as ViewCondition;
  }

  /* ── a request that carries the view (`useAsyncList` — `url.searchParams`) ── */

  private rowsOfView(name: string): Rows | undefined {
    const spec = this.specs.get(name);
    if (!spec) return undefined;
    return "rows" in spec.source
      ? spec.source.rows
      : this.rowsOfView(spec.source.view);
  }

  private collectionStatement(
    parsed: CodeViewParsed,
    rows: Rows,
  ): CodeViewStatement | undefined {
    const name = codeName(rows.collection.name);
    return parsed.statements.find(
      (item) => item.kind === "collection" && item.name === name,
    );
  }

  private requestChanged(rows: Rows): boolean {
    const edited = this.collectionStatement(this.input.edited, rows);
    const before = this.collectionStatement(this.input.baselineParsed, rows);
    return (
      codeViewNormalized(edited?.code ?? "") !==
      codeViewNormalized(before?.code ?? "")
    );
  }

  /** The request's parameters → the view's conditions and sort (`suffix` format). */
  private requestOf(
    rows: Rows,
    spec: Spec,
  ): { items: ViewCondition[]; sort?: ViewSort } | undefined {
    const statement = this.collectionStatement(this.input.edited, rows);
    if (!statement) return { items: [] };
    const format = rows.collection.endpoint?.querySerialization;
    const suffixes =
      (format?.kind === "suffix" ? format.suffixes : undefined) ??
      DEFAULT_QUERY_SUFFIXES;
    const sortParam =
      format?.kind === "suffix" ? (format.sortParam ?? "_sort") : "_sort";
    const orderParam =
      format?.kind === "suffix" ? (format.orderParam ?? "_order") : "_order";
    const fields = this.input.baseline.symbols.fields[rows.collectionId] ?? {};
    const types = new Map(
      rows.collection.schema.map((field) => [field.key, field.type]),
    );
    const items: ViewCondition[] = [];
    let sort: ViewSort | undefined;
    // (The request's lines: parameters, and a sort variable's `if (v) { … }` block.)
    const all = statement.code.split("\n").map((line) => line.trim());
    const lines = all.filter(
      (line, index) =>
        !line.startsWith("//") &&
        (/url\.searchParams/.test(line) ||
          (/^if \([\w$]+\) \{$/.test(line) &&
            /url\.searchParams\.set/.test(all[index + 1] ?? "")) ||
          (line === "}" && /url\.searchParams\.set/.test(all[index - 1] ?? ""))),
    );
    const fail = (line: string) => {
      this.input.reject(
        statement.from + Math.max(0, statement.code.indexOf(line)),
        "outsideVocabulary",
        line,
      );
      return undefined;
    };
    const valueOf = (raw: string): unknown => {
      const text = /^String\((.+)\)$/.exec(raw.trim())?.[1] ?? raw.trim();
      const [name, ...path] = text.split(".");
      if (IDENTIFIER.test(name!) && this.input.variables.has(name!))
        return [`!var.${this.input.variables.get(name!)}`, ...path].join(".");
      return literalOf(text);
    };
    const keyOf = (param: string, ops: readonly ViewComparison[]) => {
      for (const op of ops) {
        const suffix = suffixes[op];
        if (suffix === undefined || !param.endsWith(suffix)) continue;
        const key = suffix ? param.slice(0, -suffix.length) : param;
        const field = fields[key];
        if (!field) continue;
        const date = /date/i.test(types.get(key) ?? "");
        if ((op === "after" || op === "before") !== date && suffix) continue;
        return { field, op };
      }
      return undefined;
    };
    const guardOf = (
      guard: string | undefined,
      condition: Pick<ViewCondition, "op" | "value">,
    ): Pick<ViewCondition, "skip" | "enabled"> | undefined => {
      if (!guard) return {};
      const out: Pick<ViewCondition, "skip" | "enabled"> = {};
      for (const part of splitTop(guard, "&&")) {
        if (IDENTIFIER.test(part)) {
          const id = this.input.variables.get(part);
          if (!id) return undefined;
          out.enabled = `!var.${id}`;
          continue;
        }
        const value = /^([\w$]+) !== (.+)$/.exec(part);
        if (value && this.input.variables.has(value[1]!)) {
          const literal = value[2]!;
          if (literal !== "''" && literal !== "null")
            out.skip = literalOf(literal) as ViewCondition["skip"];
          continue;
        }
        const selection =
          /^!\(([\w$]+) === 'all' \|\| \1(?:\.size === 0|\.has\((.+)\))\)$/.exec(
            part,
          );
        if (selection) {
          if (selection[2])
            out.skip = literalOf(selection[2]) as ViewCondition["skip"];
          continue;
        }
        return undefined;
      }
      void condition;
      return out;
    };
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      const sortBlock = /^if \(([\w$]+)\) \{$/.exec(line);
      if (sortBlock) {
        const name = sortBlock[1]!;
        const column = lines[index + 1];
        const order = lines[index + 2];
        if (
          column !==
            `url.searchParams.set('${sortParam}', String(${name}.column));` ||
          order !==
            `url.searchParams.set('${orderParam}', ${name}.direction === 'descending' ? 'desc' : 'asc');` ||
          lines[index + 3] !== "}" ||
          !this.input.variables.has(name)
        )
          return fail(line);
        sort = { variableId: this.input.variables.get(name) as never };
        index += 3;
        continue;
      }
      const sortField = new RegExp(
        String.raw`^url\.searchParams\.set\('${sortParam}', '([\w$.]+)'\);$`,
      ).exec(line);
      if (sortField) {
        const order = new RegExp(
          String.raw`^url\.searchParams\.set\('${orderParam}', '(asc|desc)'\);$`,
        ).exec(lines[index + 1] ?? "");
        const field = fields[sortField[1]!];
        if (!order || !field) return fail(line);
        sort = {
          field: [field as never],
          direction: order[1] === "desc" ? "descending" : "ascending",
        };
        index += 1;
        continue;
      }
      const each =
        /^(?:if \((.+)\) )?for \(let x of ([\w$.]+)\) url\.searchParams\.append\('([^']+)', String\(x\)\);$/.exec(
          line,
        );
      const one =
        /^(?:if \((.+)\) )?url\.searchParams\.append\('([^']+)', (.+)\);$/.exec(
          line,
        );
      if (each) {
        const key = keyOf(each[3]!, ["oneOf"]);
        const value = valueOf(each[2]!);
        if (!key || value === undefined) return fail(line);
        const guard = guardOf(each[1], { op: "oneOf", value: value as never });
        if (!guard) return fail(line);
        items.push({
          id: `code-${this.input.newId("node").slice(-8)}`,
          fields: [[key.field as never]],
          op: "oneOf",
          value: value as never,
          ...guard,
        } as ViewCondition);
        continue;
      }
      if (one) {
        const ops = (Object.keys(suffixes) as ViewComparison[]).filter(
          (op) => op !== "oneOf",
        );
        const key = keyOf(one[2]!, ops);
        const value = valueOf(one[3]!);
        if (!key || value === undefined) return fail(line);
        const guard = guardOf(one[1], { op: key.op, value: value as never });
        if (!guard) return fail(line);
        // (`between` — two lines, `_gte` then `_lte` over the same field and guard.)
        const last = items.at(-1);
        if (
          key.op === "lte" &&
          last?.op === "gte" &&
          JSON.stringify(last.fields) === JSON.stringify([[key.field]]) &&
          JSON.stringify({ skip: last.skip, enabled: last.enabled }) ===
            JSON.stringify({ skip: guard.skip, enabled: guard.enabled })
        ) {
          items[items.length - 1] = {
            ...last,
            op: "between",
            value: [last.value, value] as never,
          };
          continue;
        }
        items.push({
          id: `code-${this.input.newId("node").slice(-8)}`,
          fields: [[key.field as never]],
          op: key.op,
          value: value as never,
          ...guard,
        } as ViewCondition);
        continue;
      }
      return fail(line);
    }
    void spec;
    return { items, ...(sort ? { sort } : {}) };
  }
}

/** The name the generator gives a collection's rows (`identifier`). */
export function codeName(raw: string): string {
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
  if (!name) name = "rows";
  if (/^[0-9]/.test(name)) name = `_${name}`;
  return name;
}

/** The index of the parenthesis closing the one at `open` (outside strings), or -1. */
function closing(code: string, open: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let index = open; index < code.length; index += 1) {
    const char = code[index]!;
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Split at a top-level operator (outside parentheses · brackets · strings). */
export function splitTop(code: string, op: "&&" | "||" | ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index]!;
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth -= 1;
    else if (depth === 0 && code.startsWith(op, index)) {
      parts.push(code.slice(start, index));
      start = index + op.length;
      index += op.length - 1;
    }
  }
  parts.push(code.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}
