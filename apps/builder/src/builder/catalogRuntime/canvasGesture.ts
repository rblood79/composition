import { containerTypeSet } from "@composition/shared";
import {
  moveNodes,
  setFields,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  BreakpointName,
  CatalogReader,
  DefinitionId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { resolveResizeRequest } from "../workspace/canvas/interaction/resizeGeometry";
import {
  hitTestHandle,
  type BoundingBox,
  type HandleConfig,
  type HandlePosition,
} from "../workspace/canvas/selection/types";
import type { CatalogConsumerNode } from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";

/** Screen px a press must travel before it becomes a drag (the old Builder's threshold). */
export const CATALOG_DRAG_THRESHOLD_PX = 3;
/** The page grid's synthetic root: a record under it is a page root (the page body). */
const PAGE_GRID = "catalog:root";
const STRUCTURAL = containerTypeSet("structural", { lowercase: true });
const isNodeSource = (id: string) => id.startsWith("project:node:");
const px = (value: string | undefined) => {
  const match =
    value === undefined ? null : /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  return match ? Number(match[1]) : undefined;
};

/** What Canvas gestures read and write (the open `CatalogWorkspace` and its Canvas scene). */
export interface CatalogGestureHost {
  readonly records: ReadonlyMap<string, CatalogConsumerNode>;
  readonly graph: CatalogReader;
  /** Scene box of a drawn record (the bound stream's `boundsMap`). */
  bounds(id: string): BoundingBox | undefined;
  /** Topmost drawn record under a scene point. */
  pick(x: number, y: number): string | undefined;
  selection(): readonly CatalogSelectionItem[];
  breakpoint(): BreakpointName;
  execute(command: CatalogCommand): void;
  newId: NewId;
}

/** Where a flow drag drops: the container record, its node and the index among the rest. */
export interface CatalogDropTarget {
  readonly container: string;
  readonly parent: NodeId;
  readonly index: number;
  /** The insertion line (scene coordinates; zero width or height). */
  readonly line: BoundingBox;
}

type Gesture =
  | {
      kind: "move";
      startX: number;
      startY: number;
      leader: string;
      /** The dragged document nodes (the selection's node targets). */
      ids: NodeId[];
      records: string[];
      startBox: BoundingBox;
      /** CSS left/top of an absolutely placed leader (moves by offset in its parent). */
      absolute?: { left: number; top: number };
      active: boolean;
      dx: number;
      dy: number;
      drop?: CatalogDropTarget;
    }
  | {
      kind: "resize";
      startX: number;
      startY: number;
      handle: HandlePosition;
      item: CatalogSelectionItem;
      startBox: BoundingBox;
      position?: { left: number; top: number };
      active: boolean;
      request: { width?: number; height?: number; left?: number; top?: number };
    };

/** What the overlay draws for the gesture in progress. */
export interface CatalogGesturePreview {
  readonly ghost?: BoundingBox;
  readonly line?: BoundingBox;
  readonly container?: BoundingBox;
}

/**
 * ADR-248 Phase 4e-3b: Canvas drag gestures over the open project — move (a flow element reorders
 * among its siblings or moves into another structural container; an absolutely placed one moves by
 * offset) and resize by the selection handles (fixed width/height at the current breakpoint). The
 * document does not change during the drag: the overlay draws the preview and one command commits
 * on release (one history step). Points are scene coordinates; `zoom` converts the threshold.
 */
export class CatalogCanvasGestures {
  private gesture: Gesture | undefined;

  constructor(private readonly host: CatalogGestureHost) {}

  get active(): boolean {
    return !!this.gesture?.active;
  }
  get pending(): boolean {
    return !!this.gesture;
  }

  /** The single selected element's resize handle under the point (not a page body). */
  handleAt(x: number, y: number, zoom: number): HandleConfig | null {
    const item = this.singleElement();
    if (!item) return null;
    return hitTestHandle(
      { x, y },
      this.host.bounds(item.identity) ?? null,
      zoom,
    );
  }

  beginResize(x: number, y: number, zoom: number): boolean {
    const handle = this.handleAt(x, y, zoom);
    const item = this.singleElement();
    if (!handle || !item) return false;
    const startBox = this.host.bounds(item.identity)!;
    const record = this.host.records.get(item.identity)!;
    const left = px(record.layout.insetLeft);
    const top = px(record.layout.insetTop);
    this.gesture = {
      kind: "resize",
      startX: x,
      startY: y,
      handle: handle.position,
      item,
      startBox,
      ...(record.layout.position === "absolute" &&
      left !== undefined &&
      top !== undefined
        ? { position: { left, top } }
        : {}),
      active: false,
      request: {},
    };
    return true;
  }

  /** A press on a selected element: it drags the selection's document nodes past the threshold. */
  beginMove(x: number, y: number, leader: string): boolean {
    const records = this.host.records;
    const leaderRecord = records.get(leader);
    const startBox = this.host.bounds(leader);
    if (
      !leaderRecord ||
      !startBox ||
      leaderRecord.parentId === PAGE_GRID ||
      !isNodeSource(leaderRecord.sourceId)
    )
      return false;
    const moving = this.host
      .selection()
      .filter(
        (item) =>
          item.target.kind === "node" &&
          records.get(item.identity)?.parentId !== PAGE_GRID,
      );
    if (!moving.some((item) => item.identity === leader)) return false;
    const left = px(leaderRecord.layout.insetLeft);
    const top = px(leaderRecord.layout.insetTop);
    this.gesture = {
      kind: "move",
      startX: x,
      startY: y,
      leader,
      ids: moving.map(
        (item) => item.target.kind === "node" && item.target.id,
      ) as NodeId[],
      records: moving.map((item) => item.identity),
      startBox,
      ...(leaderRecord.layout.position === "absolute" && moving.length === 1
        ? {
            absolute: {
              left:
                left ??
                startBox.x - (this.host.bounds(leaderRecord.parentId)?.x ?? 0),
              top:
                top ??
                startBox.y - (this.host.bounds(leaderRecord.parentId)?.y ?? 0),
            },
          }
        : {}),
      active: false,
      dx: 0,
      dy: 0,
    };
    return true;
  }

  /** Follow the pointer; returns whether the preview changed. */
  update(
    x: number,
    y: number,
    zoom: number,
    options: { axisLock?: boolean } = {},
  ): boolean {
    const gesture = this.gesture;
    if (!gesture) return false;
    let dx = x - gesture.startX;
    let dy = y - gesture.startY;
    if (
      !gesture.active &&
      Math.hypot(dx, dy) * zoom < CATALOG_DRAG_THRESHOLD_PX
    )
      return false;
    gesture.active = true;
    if (gesture.kind === "resize") {
      gesture.request = resolveResizeRequest({
        handle: gesture.handle,
        startBounds: gesture.startBox,
        dx,
        dy,
        lock: null,
        position: gesture.position ?? null,
      });
      return true;
    }
    if (options.axisLock) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    gesture.dx = dx;
    gesture.dy = dy;
    gesture.drop = gesture.absolute
      ? undefined
      : this.dropTarget(x, y, gesture);
    return true;
  }

  preview(): CatalogGesturePreview | undefined {
    const gesture = this.gesture;
    if (!gesture?.active) return undefined;
    if (gesture.kind === "resize") {
      const box = gesture.startBox;
      const { width = box.width, height = box.height } = gesture.request;
      const x = gesture.handle.includes("left")
        ? box.x + box.width - width
        : box.x;
      const y = gesture.handle.includes("top")
        ? box.y + box.height - height
        : box.y;
      return { ghost: { x, y, width, height } };
    }
    const ghost = {
      ...gesture.startBox,
      x: gesture.startBox.x + gesture.dx,
      y: gesture.startBox.y + gesture.dy,
    };
    if (!gesture.drop) return { ghost };
    return {
      ghost,
      line: gesture.drop.line,
      container: this.host.bounds(gesture.drop.container),
    };
  }

  /** Release: commit the gesture as one command (nothing when it never started or would not move). */
  finish(): boolean {
    const gesture = this.gesture;
    this.gesture = undefined;
    if (!gesture?.active) return false;
    const command = this.commandOf(gesture);
    if (!command) return false;
    this.host.execute(command);
    return true;
  }
  cancel(): void {
    this.gesture = undefined;
  }

  private singleElement(): CatalogSelectionItem | undefined {
    const selection = this.host.selection();
    if (selection.length !== 1) return undefined;
    const record = this.host.records.get(selection[0].identity);
    return record && record.parentId !== PAGE_GRID ? selection[0] : undefined;
  }

  private commandOf(gesture: Gesture): CatalogCommand | undefined {
    const breakpoint = this.host.breakpoint();
    if (gesture.kind === "resize") {
      const { width, height, left, top } = gesture.request;
      if (width === undefined && height === undefined) return undefined;
      return setFields({
        targets: [gesture.item.target],
        breakpoint,
        sizing: {
          ...(width !== undefined
            ? { width: { kind: "set", value: width } }
            : {}),
          ...(height !== undefined
            ? { height: { kind: "set", value: height } }
            : {}),
        },
        ...(left !== undefined || top !== undefined
          ? {
              layout: {
                ...(left !== undefined
                  ? { insetLeft: { kind: "set", value: `${left}px` } }
                  : {}),
                ...(top !== undefined
                  ? { insetTop: { kind: "set", value: `${top}px` } }
                  : {}),
              },
            }
          : {}),
        label: "Resize",
      });
    }
    if (gesture.absolute) {
      if (!gesture.dx && !gesture.dy) return undefined;
      return setFields({
        targets: [{ kind: "node", id: gesture.ids[0] }],
        breakpoint,
        layout: {
          insetLeft: {
            kind: "set",
            value: `${Math.round(gesture.absolute.left + gesture.dx)}px`,
          },
          insetTop: {
            kind: "set",
            value: `${Math.round(gesture.absolute.top + gesture.dy)}px`,
          },
        },
        label: "Move",
      });
    }
    const drop = gesture.drop;
    if (!drop) return undefined;
    const leader = this.host.records.get(gesture.leader)!;
    if (
      gesture.ids.length === 1 &&
      leader.parentId === drop.container &&
      this.siblingIndex(drop.container, gesture.records) === drop.index
    )
      return undefined;
    return moveNodes({
      ids: gesture.ids,
      parent: { kind: "node", id: drop.parent },
      index: drop.index,
      newId: this.host.newId,
    });
  }

  /** The leader's index among its parent's children without the dragged records. */
  private siblingIndex(container: string, dragged: readonly string[]): number {
    const children = this.host.records.get(container)?.children ?? [];
    const rest = children.filter(
      (id) => !dragged.includes(id) || id === dragged[0],
    );
    return rest.indexOf(dragged[0]);
  }

  /**
   * The structural container under the point (the dragged records are transparent: over its own
   * box the drop stays in its parent) that accepts the dragged nodes, and the insertion index along
   * the container's flow axis.
   */
  private dropTarget(
    x: number,
    y: number,
    gesture: Extract<Gesture, { kind: "move" }>,
  ): CatalogDropTarget | undefined {
    const { records, graph } = this.host;
    const dragged = new Set(gesture.records);
    const within = (id: string) => {
      for (
        let record = records.get(id);
        record;
        record = records.get(record.parentId)
      )
        if (dragged.has(record.id)) return true;
      return false;
    };
    for (
      let record = records.get(this.host.pick(x, y) ?? "");
      record;
      record = records.get(record.parentId)
    ) {
      if (within(record.id) || !isNodeSource(record.sourceId)) continue;
      let type: string;
      try {
        type = definitionTypeName(graph, record.definitionId as DefinitionId);
      } catch {
        continue;
      }
      if (!STRUCTURAL.has(type.toLowerCase())) continue;
      const index = this.insertionIndex(record, dragged, x, y);
      try {
        // The command's own checks (nesting, not into itself) decide whether the drop is allowed.
        moveNodes({
          ids: gesture.ids,
          parent: { kind: "node", id: record.sourceId as NodeId },
          index,
          newId: this.host.newId,
        })(graph);
      } catch {
        return undefined;
      }
      return {
        container: record.id,
        parent: record.sourceId as NodeId,
        index,
        line: this.insertionLine(record, dragged, index),
      };
    }
    return undefined;
  }

  private horizontal(container: CatalogConsumerNode): boolean {
    const { display, flexDirection } = container.layout;
    return (
      (display === "flex" || display === "inline-flex") &&
      !String(flexDirection ?? "row").startsWith("column")
    );
  }

  private flowChildren(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
  ) {
    return container.children
      .filter((id) => !dragged.has(id))
      .map((id) => this.host.bounds(id))
      .filter((box): box is BoundingBox => !!box);
  }

  private insertionIndex(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
    x: number,
    y: number,
  ): number {
    const horizontal = this.horizontal(container);
    let index = 0;
    for (const box of this.flowChildren(container, dragged))
      if (horizontal ? box.x + box.width / 2 < x : box.y + box.height / 2 < y)
        index++;
    return index;
  }

  private insertionLine(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
    index: number,
  ): BoundingBox {
    const horizontal = this.horizontal(container);
    const boxes = this.flowChildren(container, dragged);
    const frame = this.host.bounds(container.id)!;
    if (!boxes.length)
      return horizontal
        ? { x: frame.x, y: frame.y, width: 0, height: frame.height }
        : { x: frame.x, y: frame.y, width: frame.width, height: 0 };
    const after = index >= boxes.length;
    const box = boxes[Math.min(index, boxes.length - 1)];
    return horizontal
      ? {
          x: after ? box.x + box.width : box.x,
          y: box.y,
          width: 0,
          height: box.height,
        }
      : {
          x: box.x,
          y: after ? box.y + box.height : box.y,
          width: box.width,
          height: 0,
        };
  }
}
