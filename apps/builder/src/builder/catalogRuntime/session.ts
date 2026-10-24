import type {
  BreakpointName,
  EditTarget,
  EntryId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { targetExists } from "../../../../../packages/shared/src/catalog/resolution/positions";
import type { CatalogRuntime } from "./controller";
import type { CatalogComponentsViewId } from "./originViewNode";

/**
 * ADR-248 Phase 4c session state: what the author is looking at and working on — the page, the
 * selected positions, the hovered one, the entered editing context, the text being edited and
 * the breakpoint. It lives outside the document (no history, no save, no revision), and every
 * published step reconciles it: a position that no longer shows an element leaves the selection
 * (undo/redo included); a gone page or context falls back.
 *
 * A selected position is what an edit addresses (`target`) and which drawn element it is
 * (`identity`, the Canvas/DOM record id): one node can be drawn at several positions.
 *
 * Snapshots are immutable and replaced on change (`useSyncExternalStore` reads `getSnapshot`).
 */
export interface CatalogSelectionItem {
  readonly target: EditTarget;
  readonly identity: string;
}
export interface CatalogSessionState {
  readonly pageId: EntryId<"page"> | undefined;
  readonly selection: readonly CatalogSelectionItem[];
  readonly hover: CatalogSelectionItem | undefined;
  /**
   * An entered instance or group: clicks select inside it. A document node id, or the record
   * identity of a template position inside an instance (`catalogContextOf` — a ListBox's item).
   */
  readonly editingContext: string | undefined;
  readonly textEditing: CatalogSelectionItem | undefined;
  readonly breakpoint: BreakpointName;
  /**
   * The definition edit view (ADR-248 4e): the Canvas and Layers show this project definition's
   * template instead of the pages. The page stays the open page to return to.
   */
  readonly definitionView?: CatalogDefinitionViewId;
}
/**
 * What the edit view shows instead of the pages: a project definition, or the Components page
 * (every built-in component origin).
 */
export type CatalogDefinitionViewId =
  EntryId<"definition"> | CatalogComponentsViewId;

export const targetKey = (target: EditTarget): string =>
  target.kind === "node"
    ? target.id
    : `${target.ownerId}|${target.address.instances.join("/")}|${target.address.templatePath.join("/")}`;
export const sameTarget = (a: EditTarget, b: EditTarget) =>
  targetKey(a) === targetKey(b);
const sameItem = (a: CatalogSelectionItem, b: CatalogSelectionItem) =>
  a.identity === b.identity && sameTarget(a.target, b.target);

export interface CatalogSessionOptions {
  /** Whether a record identity is drawn now (the composition root's records). Default: always. */
  identityExists?: (identity: string) => boolean;
}

export class CatalogSession {
  private state: CatalogSessionState;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribeSteps: () => void;
  private readonly identityExists: (identity: string) => boolean;

  constructor(
    private readonly runtime: CatalogRuntime,
    options: CatalogSessionOptions = {},
  ) {
    this.identityExists = options.identityExists ?? (() => true);
    const project = runtime.graph.getEntry(runtime.graph.projectId);
    this.state = {
      pageId: project?.kind === "project" ? project.pageIds[0] : undefined,
      selection: [],
      hover: undefined,
      editingContext: undefined,
      textEditing: undefined,
      breakpoint: "desktop",
    };
    this.unsubscribeSteps = runtime.subscribeSteps(() => this.reconcile());
  }

  dispose(): void {
    this.unsubscribeSteps();
    this.listeners.clear();
  }
  getSnapshot = (): CatalogSessionState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private shown = (item: CatalogSelectionItem): boolean =>
    targetExists(this.runtime.graph, item.target) &&
    this.identityExists(item.identity);

  private set(next: Partial<CatalogSessionState>): void {
    const merged = { ...this.state, ...next };
    if (
      (Object.keys(next) as (keyof CatalogSessionState)[]).every(
        (key) => merged[key] === this.state[key],
      )
    )
      return;
    this.state = merged;
    for (const listener of [...this.listeners]) listener();
  }

  /**
   * Open a page; `selection` replaces the cleared selection in the same snapshot (a selection on
   * another page — listeners never see the new page with nothing selected).
   */
  setPage(
    pageId: EntryId<"page">,
    selection: readonly CatalogSelectionItem[] = [],
  ): void {
    if (this.runtime.graph.getEntry(pageId)?.kind !== "page")
      throw new Error(`CATALOG_SESSION_PAGE_NOT_FOUND:${pageId}`);
    if (pageId === this.state.pageId) return;
    this.set({
      pageId,
      selection: this.distinct(selection.filter(this.shown)),
      hover: undefined,
      editingContext: undefined,
      textEditing: undefined,
    });
  }
  setBreakpoint(breakpoint: BreakpointName): void {
    this.set({ breakpoint });
  }
  /** Enter (a definition id) or leave (`undefined`) the definition edit view; clears the selection. */
  setDefinitionView(definitionId: CatalogDefinitionViewId | undefined): void {
    if (definitionId === this.state.definitionView) return;
    this.set({
      definitionView: definitionId,
      selection: [],
      hover: undefined,
      editingContext: undefined,
      textEditing: undefined,
    });
  }

  /** Replace the selection, or (`additive`) toggle each item in it. */
  select(
    items: readonly CatalogSelectionItem[],
    options?: { additive?: boolean },
  ): void {
    const shown = items.filter(this.shown);
    let selection: CatalogSelectionItem[];
    if (options?.additive) {
      selection = [...this.state.selection];
      for (const item of shown) {
        const at = selection.findIndex((other) => sameItem(other, item));
        if (at >= 0) selection.splice(at, 1);
        else selection.push(item);
      }
    } else selection = this.distinct(shown);
    const unchanged =
      selection.length === this.state.selection.length &&
      selection.every((item, index) =>
        sameItem(item, this.state.selection[index]),
      );
    if (unchanged) return;
    this.set({
      selection,
      textEditing:
        this.state.textEditing &&
        selection.some((item) => sameItem(item, this.state.textEditing!))
          ? this.state.textEditing
          : undefined,
    });
  }
  clearSelection(): void {
    this.select([]);
  }
  /** Keep the first item for each drawn identity/target pair (an index for this change only). */
  private distinct(
    items: readonly CatalogSelectionItem[],
  ): CatalogSelectionItem[] {
    const seen = new Map<string, Set<string>>();
    return items.filter((item) => {
      const identity = item.identity;
      const key = targetKey(item.target);
      const targets = seen.get(identity);
      if (targets?.has(key)) return false;
      if (targets) targets.add(key);
      else seen.set(identity, new Set([key]));
      return true;
    });
  }
  setHover(item: CatalogSelectionItem | undefined): void {
    if (
      (!item && !this.state.hover) ||
      (item && this.state.hover && sameItem(item, this.state.hover))
    )
      return;
    this.set({ hover: item && this.shown(item) ? item : undefined });
  }
  enterContext(id: string): void {
    if (!this.contextExists(id))
      throw new Error(`CATALOG_SESSION_NODE_NOT_FOUND:${id}`);
    this.set({ editingContext: id });
  }
  /** A context is a document node, or a drawn template position's record identity. */
  private contextExists(id: string): boolean {
    const entry = this.runtime.graph.getEntry(id);
    return entry ? entry.kind === "node" : this.identityExists(id);
  }
  exitContext(): void {
    this.set({ editingContext: undefined });
  }
  startTextEdit(item: CatalogSelectionItem): void {
    if (!this.shown(item))
      throw new Error(
        `CATALOG_SESSION_TARGET_NOT_FOUND:${targetKey(item.target)}`,
      );
    this.select([item]);
    this.set({ textEditing: item });
  }
  endTextEdit(): void {
    this.set({ textEditing: undefined });
  }

  /** Drop what no longer shows an element (every published step and a root switch call it). */
  reconcile(): void {
    const graph = this.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const pageId =
      this.state.pageId && graph.getEntry(this.state.pageId)?.kind === "page"
        ? this.state.pageId
        : project?.kind === "project"
          ? project.pageIds[0]
          : undefined;
    const selection = this.state.selection.filter(this.shown);
    this.set({
      pageId,
      ...(selection.length !== this.state.selection.length
        ? { selection }
        : {}),
      hover:
        this.state.hover && this.shown(this.state.hover)
          ? this.state.hover
          : undefined,
      editingContext:
        this.state.editingContext &&
        this.contextExists(this.state.editingContext)
          ? this.state.editingContext
          : undefined,
      textEditing:
        this.state.textEditing && this.shown(this.state.textEditing)
          ? this.state.textEditing
          : undefined,
    });
  }
}
