import { isBodyType } from "@composition/shared";
import { moveNodes } from "../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import { isLibraryOrigin } from "./originView";
import type { CatalogDefinitionViewId } from "./session";
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
  /**
   * A bound collection's data row (4e-6-36): the drawn row's record, at its row template position
   * (selecting it selects that row). Not a document position of its own — neither draggable,
   * deletable nor a drop target.
   */
  readonly projection?: true;
  /**
   * The record selecting this row selects instead: the "+N more" row of the rows a sampled list
   * does not draw selects the row that holds them (as the Canvas hatch selects the list).
   */
  readonly selects?: string;
  /**
   * The slot role a layout slot declares (`header`, `content` …): its row shows it, in the layout
   * and on a page that uses the layout (the slot positions under the page body).
   */
  readonly slot?: string;
}

/** The data rows one row holds (4e-6-36): the drawn rows and the count the sample leaves out. */
export interface CatalogBoundLayerRows {
  readonly rows: readonly {
    id: string;
    name: string;
    typeName: string;
    /** A row with no document position (a Table's data row) selects the row holding it. */
    selects?: string;
  }[];
  readonly more?: number;
}

/** What the Layers tree reads from the open project (`CatalogWorkspace`). */
export interface CatalogLayerTreeHost {
  readonly readModel: CatalogReadModel;
  readonly graph: CatalogReader;
  subscribeSteps(listener: CatalogStepListener): () => void;
  /**
   * The drawn data rows a row holds; `undefined` = none (unbound or rows unknown: the item
   * positions are listed). Absent = no projection.
   */
  boundRows?(position: CatalogPosition): CatalogBoundLayerRows | undefined;
  /** Data rows changed outside the document (the bound rows are read again). */
  subscribeBoundRows?(listener: () => void): () => void;
}

const typeNameOf = (graph: CatalogReader, position: CatalogPosition) => {
  try {
    return definitionTypeName(graph, position.definitionId);
  } catch {
    return position.definitionId;
  }
};
/** The node or template node at a position (a layout slot under a page body is a template node). */
const declaredAt = (graph: CatalogReader, position: CatalogPosition) => {
  const id =
    position.target.kind === "node"
      ? position.target.id
      : position.target.address.templatePath.at(-1);
  if (!id) return undefined;
  const node = id.startsWith("lib:")
    ? graph.library.templates.get(id as `lib:template:${string}`)
    : graph.getEntry(id);
  return node && "children" in node
    ? (node as { name?: string; slot?: { name: string } })
    : undefined;
};
const slotOf = (graph: CatalogReader, position: CatalogPosition) =>
  declaredAt(graph, position)?.slot?.name;
/** A row's name: the node's own name, a slot's role, else its type. */
const nameOf = (
  graph: CatalogReader,
  position: CatalogPosition,
  typeName: string,
) => {
  const node = declaredAt(graph, position);
  const own = position.target.kind === "node" || node?.slot ? node?.name : "";
  return own || node?.slot?.name || typeName;
};
/** A row's mark: the definition view's root is the origin; a component's instance is an instance. */
const roleOf = (
  graph: CatalogReader,
  position: CatalogPosition,
  parentId: string | null,
  definitionView: boolean,
): CatalogLayerNode["role"] => {
  if (definitionView && parentId === null) return "origin";
  const definitionId = String(position.definitionId);
  if (position.target.kind !== "node") return undefined;
  if (definitionId.startsWith("lib:definition:origin-")) return "instance";
  // A page body that is a layout's instance is not a component instance.
  const definition = definitionId.startsWith("project:definition:")
    ? graph.getEntry(definitionId)
    : undefined;
  return definition?.kind === "definition" && definition.usage !== "layout"
    ? "instance"
    : undefined;
};
const sameNode = (a: CatalogLayerNode, b: CatalogLayerNode) =>
  a.role === b.role &&
  a.projection === b.projection &&
  a.selects === b.selects &&
  a.slot === b.slot &&
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
  private readonly unsubscribeBoundRows: () => void;
  private rowsChanged = false;
  private disposed = false;

  constructor(
    private readonly host: CatalogLayerTreeHost,
    /** A page, or the definition of the definition edit view. */
    readonly ownerId: EntryId<"page"> | CatalogDefinitionViewId,
  ) {
    // Constructed after the read model: its step listener has recomputed the row lists by now.
    this.unsubscribeSteps = host.subscribeSteps(({ result }) => {
      const renamed = [...result.changedIds].some((id) =>
        (this.visibleNodes.get(id) ?? []).some((identity) => {
          const node = this.nodes.get(identity);
          return (
            node &&
            (nameOf(host.graph, node.position, node.typeName) !== node.name ||
              slotOf(host.graph, node.position) !== node.slot)
          );
        }),
      );
      if (renamed || this.rowsChanged) this.rebuild();
    });
    this.unsubscribeBoundRows =
      host.subscribeBoundRows?.(() => this.rebuild()) ?? (() => {});
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
    this.unsubscribeBoundRows();
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
      const bound = this.host.boundRows?.(position);
      const typeName = typeNameOf(graph, position);
      const slot = slotOf(graph, position);
      const role = roleOf(graph, position, parentId, this.definitionOwner());
      const children = (): CatalogLayerNode[] =>
        bound
          ? projectRows(position, rows, bound, depth + 1)
          : rows.map((row) => build(row, position.identity, depth + 1));
      const count = bound ? bound.rows.length : rows.length;
      const expanded = count > 0 && this.expanded.has(position.identity);
      const next: CatalogLayerNode = {
        id: position.identity,
        parentId,
        depth,
        hasChildren: count > 0,
        ...(expanded ? { children: children() } : {}),
        name: nameOf(graph, position, typeName),
        typeName,
        position,
        body: parentId === null && isBodyType(typeName),
        ...(role ? { role } : {}),
        ...(slot ? { slot } : {}),
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
    // The positions of the data rows' type (row template and sample items) give way to the drawn
    // data rows, where the row template stood (at the end when the rows have no template — a
    // Table's body); the rows the sample does not draw are one "+N more" row; other rows stay.
    const projectRows = (
      parent: CatalogPosition,
      rows: readonly CatalogPosition[],
      bound: CatalogBoundLayerRows,
      depth: number,
    ): CatalogLayerNode[] => {
      const rowType = bound.rows[0]!.typeName;
      const isItem = (row: CatalogPosition) =>
        typeNameOf(graph, row) === rowType;
      const template = rows.find(isItem);
      const keep = (next: CatalogLayerNode) => {
        const old = previous.get(next.id);
        const node = old && sameNode(old, next) ? old : next;
        nodes.set(node.id, node);
        return node;
      };
      const projected = (): CatalogLayerNode[] => [
        ...bound.rows.map((item) =>
          keep({
            id: item.id,
            parentId: parent.identity,
            depth,
            hasChildren: false,
            name: item.name,
            typeName: item.typeName,
            position: template ?? parent,
            body: false,
            projection: true,
            ...(item.selects ? { selects: item.selects } : {}),
          }),
        ),
        ...(bound.more
          ? [
              keep({
                id: `${parent.identity}::more`,
                parentId: parent.identity,
                depth,
                hasChildren: false,
                name: `+${bound.more} more`,
                typeName: rowType,
                position: template ?? parent,
                body: false,
                projection: true,
                selects: parent.identity,
              }),
            ]
          : []),
      ];
      const out: CatalogLayerNode[] = [];
      for (const row of rows) {
        if (!isItem(row)) out.push(build(row, parent.identity, depth));
        else if (row === template) out.push(...projected());
      }
      if (!template) out.push(...projected());
      return out;
    };
    let rows: readonly CatalogPosition[] = [];
    try {
      rows = this.definitionOwner()
        ? readModel.definitionRows(this.ownerId as CatalogDefinitionViewId)
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

  /** The owner is a definition (the edit view): a project definition or a library origin. */
  private definitionOwner(): boolean {
    return (
      this.ownerId.startsWith("project:definition:") ||
      isLibraryOrigin(this.ownerId)
    );
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
          ? this.definitionOwner()
            ? { definitionId: this.ownerId as CatalogDefinitionViewId }
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
