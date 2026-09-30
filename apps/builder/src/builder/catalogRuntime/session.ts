import type {
  BreakpointName,
  EditTarget,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { targetExists } from "../../../../../packages/shared/src/catalog/resolution/positions";
import type { CatalogCommandPlan } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogRuntime } from "./controller";

/**
 * ADR-248 Phase 4c session state: what the author is looking at and working on — the page, the
 * selected edit targets, the hovered one, the entered editing context, the text being edited and
 * the breakpoint. It lives outside the document (no history, no save, no revision), and every
 * published step reconciles it: a target that no longer addresses a shown element leaves the
 * selection (undo/redo included); a gone page or context falls back.
 *
 * Snapshots are immutable and replaced on change (`useSyncExternalStore` reads `getSnapshot`).
 */
export interface CatalogSessionState {
  readonly pageId: EntryId<"page"> | undefined;
  readonly selection: readonly EditTarget[];
  readonly hover: EditTarget | undefined;
  /** An entered instance or group: clicks select inside it. */
  readonly editingContext: NodeId | undefined;
  readonly textEditing: EditTarget | undefined;
  readonly breakpoint: BreakpointName;
}

const targetKey = (target: EditTarget): string =>
  target.kind === "node"
    ? target.id
    : `${target.ownerId}|${target.address.instances.join("/")}|${target.address.templatePath.join("/")}`;
export const sameTarget = (a: EditTarget, b: EditTarget) =>
  targetKey(a) === targetKey(b);

export class CatalogSession {
  private state: CatalogSessionState;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribeSteps: () => void;

  constructor(private readonly runtime: CatalogRuntime) {
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

  setPage(pageId: EntryId<"page">): void {
    if (this.runtime.graph.getEntry(pageId)?.kind !== "page")
      throw new Error(`CATALOG_SESSION_PAGE_NOT_FOUND:${pageId}`);
    if (pageId === this.state.pageId) return;
    this.set({
      pageId,
      selection: [],
      hover: undefined,
      editingContext: undefined,
      textEditing: undefined,
    });
  }
  setBreakpoint(breakpoint: BreakpointName): void {
    this.set({ breakpoint });
  }

  /** Replace the selection, or (`additive`) toggle each target in it. */
  select(
    targets: readonly EditTarget[],
    options?: { additive?: boolean },
  ): void {
    const shown = targets.filter((target) =>
      targetExists(this.runtime.graph, target),
    );
    let selection: EditTarget[];
    if (options?.additive) {
      selection = [...this.state.selection];
      for (const target of shown) {
        const at = selection.findIndex((item) => sameTarget(item, target));
        if (at >= 0) selection.splice(at, 1);
        else selection.push(target);
      }
    } else
      selection = shown.filter(
        (target, index) =>
          shown.findIndex((item) => sameTarget(item, target)) === index,
      );
    const unchanged =
      selection.length === this.state.selection.length &&
      selection.every((target, index) =>
        sameTarget(target, this.state.selection[index]),
      );
    if (unchanged) return;
    this.set({
      selection,
      textEditing:
        this.state.textEditing &&
        selection.some((target) => sameTarget(target, this.state.textEditing!))
          ? this.state.textEditing
          : undefined,
    });
  }
  clearSelection(): void {
    this.select([]);
  }
  setHover(target: EditTarget | undefined): void {
    if (
      (!target && !this.state.hover) ||
      (target && this.state.hover && sameTarget(target, this.state.hover))
    )
      return;
    this.set({
      hover:
        target && targetExists(this.runtime.graph, target) ? target : undefined,
    });
  }
  enterContext(id: NodeId): void {
    if (this.runtime.graph.getEntry(id)?.kind !== "node")
      throw new Error(`CATALOG_SESSION_NODE_NOT_FOUND:${id}`);
    this.set({ editingContext: id });
  }
  exitContext(): void {
    this.set({ editingContext: undefined });
  }
  startTextEdit(target: EditTarget): void {
    if (!targetExists(this.runtime.graph, target))
      throw new Error(`CATALOG_SESSION_TARGET_NOT_FOUND:${targetKey(target)}`);
    this.select([target]);
    this.set({ textEditing: target });
  }
  endTextEdit(): void {
    this.set({ textEditing: undefined });
  }
  /** After a command: its `selectAfter` becomes the selection. */
  applyPlan(plan: CatalogCommandPlan): void {
    if (plan.selectAfter)
      this.select(plan.selectAfter.map((id) => ({ kind: "node", id })));
  }

  /** Drop what no longer addresses a shown element (every published step calls it). */
  private reconcile(): void {
    const graph = this.runtime.graph;
    const exists = (target: EditTarget) => targetExists(graph, target);
    const project = graph.getEntry(graph.projectId);
    const pageId =
      this.state.pageId && graph.getEntry(this.state.pageId)?.kind === "page"
        ? this.state.pageId
        : project?.kind === "project"
          ? project.pageIds[0]
          : undefined;
    const selection = this.state.selection.filter(exists);
    this.set({
      pageId,
      ...(selection.length !== this.state.selection.length
        ? { selection }
        : {}),
      hover:
        this.state.hover && exists(this.state.hover)
          ? this.state.hover
          : undefined,
      editingContext:
        this.state.editingContext &&
        graph.getEntry(this.state.editingContext)?.kind === "node"
          ? this.state.editingContext
          : undefined,
      textEditing:
        this.state.textEditing && exists(this.state.textEditing)
          ? this.state.textEditing
          : undefined,
    });
  }
}
