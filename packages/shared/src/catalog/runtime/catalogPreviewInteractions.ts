import {
  buildInteractionIndex,
  createElementHandlers,
  type DispatchDeps,
  type InteractionIndex,
  type InteractionRule,
} from "@composition/shared";
import {
  composeEventHandlers,
  normalizeImplicitStateValue,
  resolveImplicitStateSources,
} from "../../state/implicitState";
import type { VariableDefType } from "../../state/variable.types";
import { definitionTypeName } from "../commands/context";
import type { CatalogGraph } from "../document/graph";
import type {
  DefinitionId,
  EntryId,
  InteractionEntry,
} from "../document/types";
import type { CatalogCompositionRoot } from "./compositionRoot";
import type { CatalogDomRuntime } from "./domBinding";
import { catalogTableSortOf, type CatalogTableSort } from "./tableSort";
import {
  catalogCollectionItemKeys,
  catalogTypeName,
} from "./delegatedDom.runtime";
import {
  catalogOpenOwnerOf,
  catalogRuntimeStateOf,
  CATALOG_OPEN_BODY_TYPES,
} from "./runtimeStateProps";
import { catalogToggleGroupOf } from "./presence";
import {
  catalogRecordInteractionOverrides,
  effectiveInteractionsOf,
} from "../resolution/effectiveInteractions";
import { catalogAncestorInherited } from "./inheritedProps";
import { CATALOG_INHERITED_RECEIVERS } from "./providerContexts";

/**
 * The records an interaction's owner is drawn as (every row of a bound row template too). An
 * origin's rule leaves out the records whose instance turned it off or replaced it (ADR-281
 * Decision 4 — `effectiveInteractionsOf`, the panel's answer too).
 */
function recordsOfOwner(
  graph: CatalogGraph,
  root: CatalogCompositionRoot,
  entry: InteractionEntry,
): readonly string[] {
  if (!entry.address) {
    const get = (id: string) => graph.getEntry(id as never);
    return root.recordsOfSource(entry.ownerId).filter((id) => {
      const path = root.domInputs.get(id)?.instancePath ?? [];
      if (!path.length) return true;
      const overrides = catalogRecordInteractionOverrides(
        get,
        path,
        entry.ownerId,
      );
      return (
        !overrides ||
        effectiveInteractionsOf(get, [entry], overrides)[0]!.status === "on"
      );
    });
  }
  const { instances, templatePath } = entry.address;
  const templateId = templatePath[templatePath.length - 1];
  if (!templateId) return [];
  return root.recordsOfSource(templateId).filter((id) => {
    const path = root.domInputs.get(id)?.instancePath ?? [];
    const tail = path.slice(path.length - instances.length);
    return (
      tail.length === instances.length &&
      tail.every((item, index) => item === instances[index])
    );
  });
}

/**
 * The shared rule shape of one catalog interaction on one record. `navigate` goes by the page's
 * route (the dispatcher's vocabulary); a capability targets the target node's first record.
 * `callEndpoint` sends its body to the project's endpoint (ADR-281 Decision 5 — the id without its
 * `data:endpoint:` prefix, as the data services key it).
 */
function ruleOf(
  graph: CatalogGraph,
  root: CatalogCompositionRoot,
  entry: InteractionEntry,
  elementId: string,
): InteractionRule | undefined {
  const base = {
    id: entry.id,
    type: "interaction" as const,
    elementId,
    trigger: entry.trigger,
  };
  const action = entry.action;
  switch (action.opcode) {
    case "navigate": {
      const page = graph.getEntry(action.pageId);
      return page?.kind === "page"
        ? {
            ...base,
            action: { kind: "navigate", params: { path: page.route } },
          }
        : undefined;
    }
    case "toast":
      return {
        ...base,
        action: { kind: "toast", params: { message: action.message } },
      };
    case "capability": {
      const target = root.recordsOfSource(action.targetId)[0];
      return target
        ? {
            ...base,
            action: {
              kind: "capability",
              targetId: target,
              capability: action.capabilityId,
              ...(action.value !== undefined
                ? { params: { value: action.value } }
                : {}),
            },
          }
        : undefined;
    }
    case "callEndpoint":
      return {
        ...base,
        action: {
          kind: "callEndpoint",
          endpointId: action.endpointId.slice("data:endpoint:".length),
          ...(action.body !== undefined ? { body: action.body } : {}),
        },
      };
    case "append":
      return {
        ...base,
        action: {
          kind: "append",
          collectionId: action.collectionId.slice("data:collection:".length),
          ...(action.value !== undefined ? { value: action.value } : {}),
        },
      };
    case "update":
      return {
        ...base,
        action: {
          kind: "update",
          collectionId: action.collectionId.slice("data:collection:".length),
          ...(action.key !== undefined ? { key: action.key } : {}),
          ...(action.value !== undefined ? { value: action.value } : {}),
        },
      };
    case "reload":
    case "loadMore":
      return {
        ...base,
        action: {
          kind: action.opcode,
          collectionId: action.collectionId.slice("data:collection:".length),
        },
      };
    case "setFilterText":
      return {
        ...base,
        action: {
          kind: "setFilterText",
          collectionId: action.collectionId.slice("data:collection:".length),
          ...(action.value !== undefined ? { value: action.value } : {}),
        },
      };
    case "remove":
      return {
        ...base,
        action: {
          kind: "remove",
          collectionId: action.collectionId.slice("data:collection:".length),
          ...(action.keys !== undefined ? { keys: action.keys } : {}),
        },
      };
    case "insert":
    case "insertBefore":
    case "insertAfter":
    case "prepend":
    case "move":
    case "moveBefore":
    case "moveAfter":
    case "removeSelectedItems": {
      // (`useListData`'s positions — the rule's fields as they are, the collection without its prefix.)
      const { opcode, collectionId, ...fields } = action;
      return {
        ...base,
        action: {
          kind: opcode,
          collectionId: collectionId.slice("data:collection:".length),
          ...fields,
        },
      };
    }
    case "setState":
      return {
        ...base,
        action: {
          kind: "setState",
          variableId: action.variableId,
          op: action.op,
          ...(action.value !== undefined ? { value: action.value } : {}),
        },
      };
    default:
      return undefined;
  }
}

/** Every interaction of the graph as shared rules keyed by record. */
export function catalogPreviewRules(
  graph: CatalogGraph,
  root: CatalogCompositionRoot,
): InteractionRule[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  const rules: InteractionRule[] = [];
  for (const id of project.interactionIds) {
    const entry = graph.getEntry(id);
    if (entry?.kind !== "interaction") continue;
    for (const record of recordsOfOwner(graph, root, entry)) {
      const rule = ruleOf(graph, root, entry, record);
      if (rule) rules.push(rule);
    }
  }
  return rules;
}

/** A named RAC state observed on a record: its variable, the RAC event and the value kind. */
interface CatalogStateMirror {
  variableId: string;
  event: string;
  type: VariableDefType;
}

/**
 * The named RAC states a record's node has (the old implicit state): each follows the RAC event
 * its component fires for that state prop — observed only, never a controlled prop (D1).
 */
function mirrorsOf(
  graph: CatalogGraph,
  root: CatalogCompositionRoot,
  recordId: string,
): CatalogStateMirror[] {
  const record = root.domInputs.get(recordId);
  if (!record) return [];
  let type: string;
  try {
    type = definitionTypeName(graph, record.definitionId as DefinitionId);
  } catch {
    return [];
  }
  const sources = resolveImplicitStateSources(type);
  if (!sources.length) return [];
  const mirrors: CatalogStateMirror[] = [];
  for (const sourceId of [
    record.sourceId,
    ...(record.collapsedSourceIds ?? []),
  ])
    for (const referrerId of graph.referrersOf(sourceId)) {
      const entry = graph.getEntry(referrerId);
      if (entry?.kind !== "stateVariable" || entry.source?.nodeId !== sourceId)
        continue;
      const prop = entry.source.prop;
      const source = sources.find((item) => item.prop === prop);
      if (source)
        mirrors.push({
          variableId: entry.id,
          event: source.event,
          type: source.type,
        });
    }
  return mirrors;
}

/**
 * A capability's patch over the previous override. The dispatcher's `style` patch already holds
 * the whole style (the current one with the key set or removed), so it replaces it.
 */
function mergePatch(
  previous: Readonly<Record<string, unknown>> | undefined,
  patch: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return { ...previous, ...patch };
}

export interface CatalogPreviewInteractionsOptions {
  graph: () => CatalogGraph | undefined;
  root: () => CatalogCompositionRoot | undefined;
  /** The session's updates: the rules are rebuilt after each. */
  subscribe: (listener: () => void) => () => void;
  /** The keys a collection's load returned (`useAsyncList` load `selectedKeys` — `selectLoaded`). */
  subscribeLoadedSelection?: (
    listener: (
      collectionId: string,
      keys: readonly string[] | "all",
      join: boolean,
    ) => void,
  ) => () => void;
  navigate: (pageId: EntryId<"page">) => void;
  /** Go to a path (routes with `:param`, the 404 fallback); absent = exact routes via `navigate`. */
  navigateTo?: (path: string) => void;
  showToast: (message: string) => void;
  /** Variable writes (`setState`); absent = the rule reports that it cannot run. */
  writeState?: DispatchDeps["writeState"];
  /** The record drawing `ownerId` on `recordId`'s chain: an element variable's value key. */
  ownerRecord?: (recordId: string, ownerId: string) => string | undefined;
  /** A rule that could not run (the old Preview's warning — never a silent no-op). */
  report?: (rule: InteractionRule, reason: string) => void;
  /** ADR-257 Phase 4 — a Table's sort set by RAC (`sortDescriptor` runtime prop): the session's. */
  sortTable?: (tableId: string, sort: CatalogTableSort | undefined) => void;
  /**
   * ADR-281 Decision 6 — a page root's `colorScheme` set by a rule: the session shows the theme in
   * that color mode (its CSS variables and `data-theme`, the theme's own variable sets).
   */
  colorScheme?: (mode: "light" | "dark") => void;
  /**
   * ADR-281 Decision 5 — a Form's submit to an endpoint (the session's `submitApiEndpoint`): settles
   * later — a failure is reported and shown as a toast here (user decision 3).
   */
  submitEndpoint?: (endpointId: string, body: unknown) => Promise<unknown>;
  /** ADR-281 user decision 3, second step — the session appends the value (`CatalogPreviewSession.append`). */
  append?: DispatchDeps["append"];
  /** `CatalogPreviewSession.insert` · `move` (`useListData`'s positions). */
  insert?: DispatchDeps["insert"];
  move?: DispatchDeps["move"];
  /** `CatalogPreviewSession.update` · `remove` (`useListData.update` · `remove`). */
  update?: DispatchDeps["update"];
  remove?: DispatchDeps["remove"];
  /**
   * `useAsyncList.reload()` — the session loads the collection again (`CatalogPreviewSession.reload`):
   * settles later — a failure is reported and shown as a toast here.
   */
  reloadCollection?: (collectionId: string) => Promise<unknown>;
  /** `useAsyncList.loadMore()` · `setFilterText(text)` (the session's) — reported like `reload`. */
  loadMore?: (collectionId: string) => Promise<unknown>;
  setFilterText?: (collectionId: string, filterText: string) => Promise<unknown>;
  /** The collection a record's text filters on the server (`CatalogPreviewSession.serverFilterOf`). */
  serverFilterOf?: (recordId: string) => string | undefined;
  /** Whether a collection pages (`CatalogPreviewSession.pages`). */
  pages?: (collectionId: string) => boolean;
}

/**
 * ADR-248 4e-6 Preview rule execution over the catalog document: each interaction becomes a
 * shared rule on the records its owner is drawn as, run by the shared dispatcher (the old
 * Preview's `createElementHandlers`). Navigation moves the Preview's page by route; a toast shows
 * in the Preview; a capability writes a prop override of its target record (runtime only — the
 * document and the Builder never see it). `setState` writes the session's runtime values.
 */
/** Bound components whose selection is one key (`selectedKey`) — a load's first key. */
const LOADED_SINGLE_SELECTION_TYPES: ReadonlySet<string> = new Set([
  "Select",
  "ComboBox",
]);
/** Bound collections whose selection is a key set (`selectedKeys`). */
const LOADED_MULTIPLE_SELECTION_TYPES: ReadonlySet<string> = new Set([
  "ListBox",
  "GridList",
  "Table",
  "Tree",
  "TagGroup",
]);

export class CatalogPreviewInteractions implements CatalogDomRuntime {
  private index: InteractionIndex = buildInteractionIndex([]);
  /** Record → its rules' signature (which rules, which triggers): a change re-renders it. */
  private signatures = new Map<string, string>();
  private readonly propOverrides = new Map<string, Record<string, unknown>>();
  /**
   * Each runtime prop's declared value when it was written (JSON): a Builder change of that
   * declaration drops the runtime value, so the Preview follows the new declaration (ADR-250 R2).
   */
  private readonly declaredAt = new Map<string, Record<string, string>>();
  private readonly revisions = new Map<string, number>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly deps: DispatchDeps;
  private readonly unsubscribe: () => void;
  private readonly unsubscribeLoadedSelection?: () => void;

  constructor(private readonly options: CatalogPreviewInteractionsOptions) {
    // A load a rule started settles later: its failure is reported and shown as a toast.
    const settleLoad = (load: Promise<unknown>, collectionId: string, what: string) =>
      load.catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[interactions] collection ${collectionId} ${what} 실패 — ${message}`);
        options.showToast(message);
      });
    this.deps = {
      getElement: (id) => {
        const record = options.root()?.domInputs.get(id);
        const graph = options.graph();
        if (!record || !graph) return undefined;
        let type: string;
        try {
          type = definitionTypeName(graph, record.definitionId as DefinitionId);
        } catch {
          type = "";
        }
        const override = this.overrideOf(id);
        return {
          type,
          props: {
            ...(record.props as Record<string, unknown>),
            ...override,
          },
        };
      },
      updateElementProps: (id, patch) => this.setRuntimeProps(id, patch),
      callEndpoint: (endpointId, body) => {
        const submit = options.submitEndpoint;
        if (!submit)
          return { ok: false, reason: "endpoint 제출 서비스 없음" };
        submit(endpointId, body).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(
            `[interactions] endpoint ${endpointId} 제출 실패 — ${message}`,
          );
          options.showToast(message);
        });
        return { ok: true };
      },
      ...(options.append ? { append: options.append } : {}),
      ...(options.update ? { update: options.update } : {}),
      ...(options.remove ? { remove: options.remove } : {}),
      ...(options.insert ? { insert: options.insert } : {}),
      ...(options.move ? { move: options.move } : {}),
      // `useListData.removeSelectedItems()` — the list's selection is what the components showing
      // the collection select (each bound record's current selection — the render's value).
      selectedKeysOf: (collectionId) => {
        const root = options.root();
        const graph = options.graph();
        if (!root || !graph) return [];
        const keys = new Set<string>();
        for (const record of root.domInputs.values()) {
          const source = graph.getEntry(record.sourceId as never);
          const binding = source?.kind === "node" ? source.binding : undefined;
          if (binding?.collectionId !== `data:collection:${collectionId}`) continue;
          const selected = catalogRuntimeStateOf(
            root,
            record,
            this.overrideOf(record.id),
            "selectedKeys",
            (recordId) => this.overrideOf(recordId),
          );
          if (selected === "all") return "all";
          if (Array.isArray(selected) || selected instanceof Set)
            for (const key of selected) keys.add(String(key));
        }
        return [...keys];
      },
      reload: (collectionId) => {
        const reload = options.reloadCollection;
        if (!reload) return { ok: false, reason: "collection 다시 읽기 서비스 없음" };
        settleLoad(reload(collectionId), collectionId, "다시 읽기");
        return { ok: true };
      },
      loadMore: (collectionId) => {
        if (!options.loadMore)
          return { ok: false, reason: "collection 더 불러오기 서비스 없음" };
        settleLoad(options.loadMore(collectionId), collectionId, "더 불러오기");
        return { ok: true };
      },
      setFilterText: (collectionId, filterText) => {
        if (!options.setFilterText)
          return { ok: false, reason: "collection 검색 서비스 없음" };
        settleLoad(
          options.setFilterText(collectionId, filterText),
          collectionId,
          "검색",
        );
        return { ok: true };
      },
      // ADR-280 Decision 8 — the state RAC shows (the render reads the same function).
      getRuntimeState: (id, prop) => {
        const root = options.root();
        const record = root?.domInputs.get(id);
        return root && record
          ? catalogRuntimeStateOf(
              root,
              record,
              this.overrideOf(id),
              prop,
              (recordId) => this.overrideOf(recordId),
            )
          : undefined;
      },
      stateOwnerOf: (id, prop) => {
        const root = options.root();
        const record = root?.domInputs.get(id);
        if (!root || !record || prop !== "isOpen") return undefined;
        const typeOf = (node: typeof record) => catalogTypeName(root, node);
        return CATALOG_OPEN_BODY_TYPES.has(typeOf(record))
          ? catalogOpenOwnerOf(root, id, typeOf)
          : undefined;
      },
      getConstraintContext: (id) => {
        const root = options.root();
        const record = root?.domInputs.get(id);
        if (!root || !record) return {};
        const group = catalogToggleGroupOf(
          record,
          (recordId) => root.domInputs.get(recordId),
          (node) => catalogTypeName(root, node),
        );
        const groupProps = group
          ? { ...group.props, ...this.overrideOf(group.id) }
          : undefined;
        // ADR-281 Decision 3 — what a page root · frame passes down, for the props the target's
        // RAC context takes (the render ORs them in — `catalogInheritedFlags`).
        const fromHosts = catalogAncestorInherited(
          record,
          (recordId) => root.domInputs.get(recordId),
          (node) => catalogTypeName(root, node),
          (node) => ({ ...node.props, ...this.overrideOf(node.id) }),
        );
        const takes =
          CATALOG_INHERITED_RECEIVERS.get(catalogTypeName(root, record)) ?? [];
        const hostFlag = (flag: "isDisabled" | "isReadOnly") =>
          takes.includes(flag) && fromHosts[flag] === true;
        const inherited = {
          isDisabled:
            groupProps?.isDisabled === true || hostFlag("isDisabled"),
          isReadOnly:
            groupProps?.isReadOnly === true || hostFlag("isReadOnly"),
        };
        return {
          ...(groupProps || inherited.isDisabled || inherited.isReadOnly
            ? { inherited }
            : {}),
          ...catalogCollectionItemKeys(root, record),
        };
      },
      // ADR-280 Decision 9 — Form submit · reset through the form element (RAC delegates to it).
      invokeImperative: (id, capability) => {
        const form = globalThis.document?.querySelector(
          `form[data-catalog-id="${id.replace(/["\\]/g, "\\$&")}"]`,
        );
        if (!(form instanceof HTMLFormElement))
          return { ok: false, reason: `form 요소 없음: ${id}` };
        if (capability === "submit") form.requestSubmit();
        else if (capability === "reset") form.reset();
        else
          return {
            ok: false,
            reason: `imperative capability 미지원: ${capability}`,
          };
        return { ok: true };
      },
      navigate: (path) => {
        // By route, with `:param` routes and the 404 fallback (the session's router) when the
        // host has one; else the exact route only.
        if (options.navigateTo) {
          options.navigateTo(path);
          return;
        }
        const graph = options.graph();
        const project = graph?.getEntry(graph.projectId);
        if (project?.kind !== "project") return;
        const pageId = project.pageIds.find((id) => {
          const page = graph!.getEntry(id);
          return page?.kind === "page" && page.route === path;
        });
        if (pageId) options.navigate(pageId);
      },
      showToast: options.showToast,
      ...(options.writeState ? { writeState: options.writeState } : {}),
    };
    this.refresh();
    this.unsubscribe = options.subscribe(() => this.refresh());
    this.unsubscribeLoadedSelection = options.subscribeLoadedSelection?.(
      (collectionId, keys, join) => this.selectLoaded(collectionId, keys, join),
    );
  }

  dispose(): void {
    this.unsubscribe();
    this.unsubscribeLoadedSelection?.();
    this.listeners.clear();
  }

  /**
   * Rebuild the rules from the document (after each update) and re-render the records whose rules
   * changed — a rule added on its own changes no record, so its node would not render again.
   */
  private refresh(): void {
    const graph = this.options.graph();
    const root = this.options.root();
    const rules = graph && root ? catalogPreviewRules(graph, root) : [];
    this.index = buildInteractionIndex(rules);
    const signatures = new Map<string, string>();
    for (const rule of rules)
      signatures.set(
        rule.elementId,
        `${signatures.get(rule.elementId) ?? ""}|${rule.id}:${rule.trigger}:${JSON.stringify(rule.action)}`,
      );
    // A named RAC state adds an observer to its node's records: naming one re-renders them too.
    const project = graph?.getEntry(graph.projectId);
    if (graph && root && project?.kind === "project")
      for (const variableId of project.stateVariableIds) {
        const entry = graph.getEntry(variableId);
        if (entry?.kind !== "stateVariable" || !entry.source) continue;
        for (const id of root.recordsOfSource(entry.source.nodeId))
          signatures.set(
            id,
            `${signatures.get(id) ?? ""}|${entry.id}<-${entry.source.prop}`,
          );
      }
    const changed = new Set<string>();
    for (const [id, signature] of signatures)
      if (this.signatures.get(id) !== signature) changed.add(id);
    for (const id of this.signatures.keys())
      if (!signatures.has(id)) changed.add(id);
    this.signatures = signatures;
    for (const id of changed) this.touch(id);
  }
  private touch(id: string): void {
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
    for (const notify of [...(this.listeners.get(id) ?? [])]) notify();
  }

  revisionOf(id: string): number {
    return this.revisions.get(id) ?? 0;
  }
  handlersOf(id: string) {
    const ownerRecord = this.options.ownerRecord;
    const rules = createElementHandlers(
      id,
      this.index,
      this.deps,
      (rule, outcome) => {
        if (!outcome.ok)
          (this.options.report ?? warn)(rule, outcome.reason ?? "failed");
      },
      // An element variable's value lives under the record drawing its owner in this context.
      {
        instanceKeyFor: (ownerId) => ownerRecord?.(id, ownerId) ?? ownerId,
      },
    );
    const graph = this.options.graph();
    const root = this.options.root();
    const mirrors = graph && root ? mirrorsOf(graph, root, id) : [];
    if (!mirrors.length) return rules;
    const observe: Record<string, (...args: unknown[]) => void> = {};
    for (const mirror of mirrors) {
      const write = (raw: unknown) => {
        const outcome = this.deps.writeState?.({
          variableId: mirror.variableId,
          op: "set",
          value: normalizeImplicitStateValue(mirror.type, raw),
        });
        if (outcome && !outcome.ok)
          console.warn(
            `[state] ${mirror.variableId} 관찰 실패 — ${outcome.reason ?? "failed"}`,
          );
      };
      const previous = observe[mirror.event];
      observe[mirror.event] = previous
        ? (raw) => {
            previous(raw);
            write(raw);
          }
        : (raw) => write(raw);
    }
    // The observer runs first: a rule on the same event reads the new value.
    return composeEventHandlers(rules, observe);
  }
  /**
   * A record's runtime props: a capability's patch and the component's own state (a Disclosure or
   * Tree expanded by the user) — one value per prop, never the document (ADR-250).
   */
  pages(collectionId: string): boolean {
    return this.options.pages?.(collectionId) ?? false;
  }
  serverFilterOf(recordId: string): string | undefined {
    return this.options.serverFilterOf?.(recordId);
  }
  setFilterText(collectionId: string, filterText: string): void {
    const load = this.options.setFilterText;
    if (!load) return;
    load(collectionId, filterText).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[interactions] collection ${collectionId} 검색 실패 — ${message}`);
      this.options.showToast(message);
    });
  }
  loadMore(collectionId: string): void {
    const load = this.options.loadMore;
    if (!load) return;
    load(collectionId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[interactions] collection ${collectionId} 더 불러오기 실패 — ${message}`);
      this.options.showToast(message);
    });
  }
  /**
   * `useAsyncList` load `selectedKeys` — the components showing a collection select the keys its
   * load returned (`selectedKeys={list.selectedKeys}`): a load's replace the selection, a
   * `loadMore`'s join it (a picker's `selectedKey` is the first; a single list keeps one).
   */
  selectLoaded(
    collectionId: string,
    keys: readonly string[] | "all",
    join: boolean,
  ): void {
    const root = this.options.root();
    const graph = this.options.graph();
    if (!root || !graph) return;
    for (const record of [...root.domInputs.values()]) {
      const source = graph.getEntry(record.sourceId as never);
      const binding = source?.kind === "node" ? source.binding : undefined;
      if (binding?.collectionId !== `data:collection:${collectionId}`) continue;
      const type = catalogTypeName(root, record);
      if (LOADED_SINGLE_SELECTION_TYPES.has(type)) {
        const current = catalogRuntimeStateOf(
          root,
          record,
          this.overrideOf(record.id),
          "selectedKey",
        );
        if (keys === "all") continue;
        if (join && current != null) continue;
        this.setRuntimeProps(record.id, { selectedKey: keys[0] ?? null });
        continue;
      }
      if (!LOADED_MULTIPLE_SELECTION_TYPES.has(type)) continue;
      const current = catalogRuntimeStateOf(
        root,
        record,
        this.overrideOf(record.id),
        "selectedKeys",
        (recordId) => this.overrideOf(recordId),
      );
      const before =
        current === "all"
          ? "all"
          : Array.isArray(current) || current instanceof Set
            ? [...current].map(String)
            : [];
      const next =
        keys === "all" || (join && before === "all")
          ? "all"
          : join
            ? [...new Set([...(before as string[]), ...keys])]
            : [...keys];
      const single = record.props.selectionMode === "single";
      this.setRuntimeProps(record.id, {
        selectedKeys:
          single && next !== "all" ? next.slice(join ? -1 : 0, join ? undefined : 1) : next,
      });
    }
  }
  setRuntimeProps(id: string, patch: Readonly<Record<string, unknown>>): void {
    const props = this.options.root()?.domInputs.get(id)?.props as
      Readonly<Record<string, unknown>> | undefined;
    const declared = { ...this.declaredAt.get(id) };
    for (const key of Object.keys(patch))
      declared[key] = declaredKey(props?.[key]);
    this.declaredAt.set(id, declared);
    this.propOverrides.set(id, mergePatch(this.propOverrides.get(id), patch));
    if ("sortDescriptor" in patch)
      this.options.sortTable?.(id, catalogTableSortOf(patch.sortDescriptor));
    if (patch.colorScheme === "light" || patch.colorScheme === "dark")
      this.options.colorScheme?.(patch.colorScheme);
    this.touch(id);
  }
  /** The record's runtime props still standing over their declarations. */
  overrideOf(id: string) {
    const override = this.propOverrides.get(id);
    if (!override) return undefined;
    const props = this.options.root()?.domInputs.get(id)?.props as
      Readonly<Record<string, unknown>> | undefined;
    const declared = this.declaredAt.get(id) ?? {};
    let current: Record<string, unknown> | undefined;
    for (const key of Object.keys(override)) {
      if (key === "style" || declared[key] === declaredKey(props?.[key]))
        continue;
      current ??= { ...override };
      delete current[key];
    }
    if (!current) return override;
    if (Object.keys(current).length) this.propOverrides.set(id, current);
    else this.propOverrides.delete(id);
    return Object.keys(current).length ? current : undefined;
  }
  subscribe(id: string, notify: () => void) {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(notify);
    return () => {
      set.delete(notify);
    };
  }
}

/** A declared prop value as a comparable key (absent = its own key). */
function declaredKey(value: unknown): string {
  return value === undefined ? "\u0000absent" : JSON.stringify(value);
}

function warn(rule: InteractionRule, reason: string): void {
  console.warn(
    `[interactions] 규칙 ${rule.id} (${rule.trigger}) 실행 실패 — ${reason}`,
  );
}
