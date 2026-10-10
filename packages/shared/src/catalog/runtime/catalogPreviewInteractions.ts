import {
  buildInteractionIndex,
  createElementHandlers,
  type DispatchDeps,
  type InteractionIndex,
  type InteractionRule,
} from "@composition/shared";
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

/** The records an interaction's owner is drawn as (every row of a bound row template too). */
function recordsOfOwner(
  root: CatalogCompositionRoot,
  entry: InteractionEntry,
): readonly string[] {
  if (!entry.address) return root.recordsOfSource(entry.ownerId);
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
 * `callEndpoint` has no Preview path yet (the old Preview had none either): no rule.
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
    for (const record of recordsOfOwner(root, entry)) {
      const rule = ruleOf(graph, root, entry, record);
      if (rule) rules.push(rule);
    }
  }
  return rules;
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
}

/**
 * ADR-248 4e-6 Preview rule execution over the catalog document: each interaction becomes a
 * shared rule on the records its owner is drawn as, run by the shared dispatcher (the old
 * Preview's `createElementHandlers`). Navigation moves the Preview's page by route; a toast shows
 * in the Preview; a capability writes a prop override of its target record (runtime only — the
 * document and the Builder never see it). `setState` writes the session's runtime values.
 */
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

  constructor(private readonly options: CatalogPreviewInteractionsOptions) {
    this.deps = {
      getElement: (id) => {
        const record = options.root()?.domInputs.get(id);
        const graph = options.graph();
        if (!record || !graph) return undefined;
        let type = "";
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
  }

  dispose(): void {
    this.unsubscribe();
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
    return createElementHandlers(
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
  }
  /**
   * A record's runtime props: a capability's patch and the component's own state (a Disclosure or
   * Tree expanded by the user) — one value per prop, never the document (ADR-250).
   */
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
