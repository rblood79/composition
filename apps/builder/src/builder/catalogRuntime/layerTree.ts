import { isBodyType } from "@composition/shared";
import { moveNodes } from "../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  EntryId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import type { CatalogStepListener } from "./controller";
import type { CatalogReadModel } from "./readModel";

/** One Layers row: its key is the drawn record identity (the Canvas selection's key). */
export interface CatalogLayerNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly hasChildren: boolean;
  /** Present only while the row is expanded (collapsed rows are not read further). */
  readonly children?: CatalogLayerNode[];
  readonly name: string;
  readonly typeName: string;
  readonly position: CatalogPosition;
  /** The page body row (not draggable, not deletable). */
  readonly body: boolean;
  /**
   * The old row's editing-semantics mark: `instance` = a component instance (a project component
   * or a library origin), `origin` = the component being edited (the definition view's root).
   */
  readonly role?: "origin" | "instance";
}

/** What the Layers tree reads from the open project (`CatalogWorkspace`). */
export interface CatalogLayerTreeHost {
  readonly readModel: CatalogReadModel;
  readonly graph: CatalogReader;
  subscribeSteps(listener: CatalogStepListener): () => void;
}

const typeNameOf = (graph: CatalogReader, position: CatalogPosition) => {
  try {
    return definitionTypeName(graph, position.definitionId);
  } catch {
    return position.definitionId;
  }
};
const nameOf = (
  graph: CatalogReader,
  position: CatalogPosition,
  typeName: string,
) => {
  if (position.target.kind !== "node") return typeName;
  const entry = graph.getEntry(position.target.id);
  return (entry?.kind === "node" && entry.name) || typeName;
};
/** A row's mark: the definition view's root is the origin; a component's instance is an instance. */
const roleOf = (
  position: CatalogPosition,
  parentId: string | null,
  definitionView: boolean,
): CatalogLayerNode["role"] => {
  if (definitionView && parentId === null) return "origin";
  const definitionId = String(position.definitionId);
  return position.target.kind === "node" &&
    (definitionId.startsWith("project:definition:") ||
      definitionId.startsWith("lib:definition:origin-"))
    ? "instance"
    : undefined;
};
const sameNode = (a: CatalogLayerNode, b: CatalogLayerNode) =>
  a.role === b.role &&
  a.parentId === b.parentId &&
  a.depth === b.depth &&
  a.hasChildren === b.hasChildren &&
  a.name === b.name &&
  a.typeName === b.typeName &&
  a.position === b.position &&
  a.children?.length === b.children?.length &&
  (a.children ?? []).every((child, index) => child === b.children![index]);

/**
 * ADR-248 Phase 4e-4: the Layers tree of one page over the read model — the page's rows and, for
 * each expanded row, its child rows (a collapsed row reads only whether it has children). Row lists
 * come from the read model's cached reads (a published step recomputes only the lists whose
 * entries changed); a row's name is re-read only when its node changed. An unchanged row keeps its
 * object, so the tree re-renders only the rows that changed.
 */
export class CatalogLayerTreeStore {
  private expanded: ReadonlySet<string> = new Set();
  private snapshot: readonly CatalogLayerNode[] = [];
  private nodes = new Map<string, CatalogLayerNode>();
  /** Row-list subscriptions: "page" or a row identity → unsubscribe. */
  private readonly rowSubscriptions = new Map<string, () => void>();
  /** Visible owned node rows: node id → its row identities. */
  private visibleNodes = new Map<string, string[]>();
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribeSteps: () => void;
  private rowsChanged = false;
  private disposed = false;

  constructor(
    private readonly host: CatalogLayerTreeHost,
    /** A page, or the definition of the definition edit view. */
    readonly ownerId: EntryId<"page"> | EntryId<"definition">,
  ) {
    // Constructed after the read model: its step listener has recomputed the row lists by now.
    this.unsubscribeSteps = host.subscribeSteps(({ result }) => {
      const renamed = [...result.changedIds].some((id) =>
        (this.visibleNodes.get(id) ?? []).some((identity) => {
          const node = this.nodes.get(identity);
          return (
            node &&
            nameOf(host.graph, node.position, node.typeName) !== node.name
          );
        }),
      );
      if (renamed || this.rowsChanged) this.rebuild();
    });
    this.rebuild();
  }

  getSnapshot = (): readonly CatalogLayerNode[] => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  /** Rows to show expanded (user toggles and the selection's ancestors). */
  setExpanded(keys: ReadonlySet<string>): void {
    if (
      keys.size === this.expanded.size &&
      [...keys].every((key) => this.expanded.has(key))
    )
      return;
    this.expanded = new Set(keys);
    this.rebuild();
  }
  /** A row by identity (only the rows built: visible ones and their parents). */
  node(identity: string): CatalogLayerNode | undefined {
    return this.nodes.get(identity);
  }
  dispose(): void {
    this.disposed = true;
    this.unsubscribeSteps();
    for (const unsubscribe of this.rowSubscriptions.values()) unsubscribe();
    this.rowSubscriptions.clear();
    this.listeners.clear();
  }

  private rebuild(): void {
    if (this.disposed) return;
    this.rowsChanged = false;
    const { readModel, graph } = this.host;
    const previous = this.nodes;
    const nodes = new Map<string, CatalogLayerNode>();
    const visibleNodes = new Map<string, string[]>();
    const wanted = new Set<string>(["page"]);
    const build = (
      position: CatalogPosition,
      parentId: string | null,
      depth: number,
    ): CatalogLayerNode => {
      wanted.add(position.identity);
      const rows = readModel.childRows(position);
      const typeName = typeNameOf(graph, position);
      const role = roleOf(
        position,
        parentId,
        this.ownerId.startsWith("project:definition:"),
      );
      const expanded = rows.length > 0 && this.expanded.has(position.identity);
      const next: CatalogLayerNode = {
        id: position.identity,
        parentId,
        depth,
        hasChildren: rows.length > 0,
        ...(expanded
          ? {
              children: rows.map((row) =>
                build(row, position.identity, depth + 1),
              ),
            }
          : {}),
        name: nameOf(graph, position, typeName),
        typeName,
        position,
        body: parentId === null && isBodyType(typeName),
        ...(role ? { role } : {}),
      };
      const old = previous.get(next.id);
      const node = old && sameNode(old, next) ? old : next;
      nodes.set(node.id, node);
      if (position.target.kind === "node") {
        const list = visibleNodes.get(position.target.id) ?? [];
        list.push(node.id);
        visibleNodes.set(position.target.id, list);
      }
      return node;
    };
    let rows: readonly CatalogPosition[] = [];
    try {
      rows = this.ownerId.startsWith("project:definition:")
        ? readModel.definitionRows(this.ownerId as EntryId<"definition">)
        : readModel.pageRows(this.ownerId as EntryId<"page">);
    } catch {
      // The page is gone (removed): the panel switches page on the session's next state.
    }
    const top = rows.map((row) => build(row, null, 0));
    this.nodes = nodes;
    this.visibleNodes = visibleNodes;
    this.syncSubscriptions(wanted);
    const changed =
      top.length !== this.snapshot.length ||
      top.some((node, index) => node !== this.snapshot[index]);
    if (!changed) return;
    this.snapshot = top;
    for (const listener of [...this.listeners]) listener();
  }

  /** Keep each read row list subscribed (a change marks the tree for the step's rebuild). */
  private syncSubscriptions(wanted: ReadonlySet<string>): void {
    const mark = () => {
      this.rowsChanged = true;
    };
    for (const [key, unsubscribe] of this.rowSubscriptions)
      if (!wanted.has(key)) {
        unsubscribe();
        this.rowSubscriptions.delete(key);
      }
    for (const key of wanted) {
      if (this.rowSubscriptions.has(key)) continue;
      const parent =
        key === "page"
          ? this.ownerId.startsWith("project:definition:")
            ? { definitionId: this.ownerId as EntryId<"definition"> }
            : { pageId: this.ownerId as EntryId<"page"> }
          : { position: this.nodes.get(key)!.position };
      this.rowSubscriptions.set(
        key,
        this.host.readModel.subscribeRows(parent, mark),
      );
    }
  }
}

/**
 * A Layers drop as the move command: rows dropped before/after a row go to that row's parent,
 * rows dropped on a row go into it (at the end). The parent must be an owned node (as on the
 * Canvas); the index counts its owned child rows without the dragged ones (on a row = its end). `undefined` = the drop
 * is not a move of owned nodes; the command's own checks (nesting, into itself) still decide.
 */
export function catalogLayerDropCommand(
  tree: Pick<CatalogLayerTreeStore, "node">,
  draggedIds: readonly string[],
  targetId: string,
  dropPosition: "before" | "after" | "on",
  newId: NewId,
): CatalogCommand | undefined {
  const target = tree.node(targetId);
  if (!target) return undefined;
  const parent =
    dropPosition === "on"
      ? target
      : target.parentId
        ? tree.node(target.parentId)
        : undefined;
  if (!parent || parent.position.target.kind !== "node") return undefined;
  const dragged = draggedIds.map((id) => tree.node(id));
  if (
    !dragged.length ||
    dragged.some(
      (node) => !node || node.body || node.position.target.kind !== "node",
    )
  )
    return undefined;
  // Dropped on a row: at its end (a collapsed row's children are not read).
  let index: number | undefined;
  if (dropPosition !== "on") {
    const draggedSet = new Set(draggedIds);
    const siblings = (parent.children ?? []).filter(
      (row) => row.position.target.kind === "node" && !draggedSet.has(row.id),
    );
    const at = siblings.findIndex((row) => row.id === targetId);
    index = at < 0 ? siblings.length : dropPosition === "before" ? at : at + 1;
  }
  return moveNodes({
    ids: dragged.map((node) => (node!.position.target as { id: NodeId }).id),
    parent: { kind: "node", id: parent.position.target.id },
    ...(index !== undefined ? { index } : {}),
    newId,
    label: "Move",
  });
}
