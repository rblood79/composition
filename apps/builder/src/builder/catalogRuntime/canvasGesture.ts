import {
  containerTypeSet,
  getRatioDependentAxis,
  resolveNestingViolation,
  type FillAxes,
  type NestingViolation,
} from "@composition/shared";
import {
  copyNodes,
  moveNodes,
  pasteNodes,
  setFields,
  setFillSizing,
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  stageOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import { catalogColorWheelSizeOfBox } from "../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  BreakpointName,
  CatalogReader,
  DefinitionId,
  EditTarget,
  LayoutField,
  NodeId,
  NodeParent,
  WriteValue,
} from "../../../../../packages/shared/src/catalog/document/types";
import { parseAspectRatio } from "../utils/aspectRatio";
import { catalogBoxModel } from "./boxModel";
import { catalogInsertParent } from "./insertParent";
import {
  resolveResizeRequest,
  type ResizeRatioLockInput,
} from "../workspace/canvas/interaction/resizeGeometry";
import {
  applySpacingStep,
  hitTestSpacingBands,
  resolveSpacingSidesForModifiers,
  spacingDeltaFromPointer,
  type SpacingBand,
} from "../workspace/canvas/interaction/spacingGeometry";
import {
  SPACING_SIDES,
  type SpacingActiveTarget,
  type SpacingProperty,
} from "../workspace/canvas/interaction/spacingTypes";
import type { CatalogSpacingLive } from "./spacingLive";
import {
  boxesIntersect,
  hitTestHandle,
  type BoundingBox,
  type HandleConfig,
  type HandlePosition,
} from "../workspace/canvas/selection/types";
import {
  catalogSpacingBands,
  type CatalogSpacingPreview,
} from "./canvasSpacing";
import type {
  CatalogConsumerNode,
  CatalogRecordPreview,
} from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";

import {
  SNAP_THRESHOLD_SCREEN_PX,
  resolveCentreGuides,
  resolveSnappedPosition,
  type SnapCandidateRect,
  type SnapGuide,
  type SnapGuideLines,
} from "../workspace/canvas/interaction/snapGuides";
import {
  coveredSpan,
  gridLayout,
  gridPlacement,
  lengthPx,
  lineSpan,
  type GridArea,
  type GridItemLines,
  type GridLayout,
} from "./canvasGridCells";
import {
  resolveDragDistanceGuides,
  type MeasureGuide,
} from "../workspace/canvas/interaction/measureGuides";

/** Screen px a press must travel before it becomes a drag (the old Builder's threshold). */
export const CATALOG_DRAG_THRESHOLD_PX = 3;
/** The page grid's synthetic root: a record under it is a page root (the page body). */
const PAGE_GRID = "catalog:root";
const STRUCTURAL = containerTypeSet("structural", { lowercase: true });
const isNodeSource = (id: string) => id.startsWith("project:node:");

/** What Canvas gestures read and write (the open `CatalogWorkspace` and its Canvas scene). */
export interface CatalogGestureHost {
  readonly records: ReadonlyMap<string, CatalogConsumerNode>;
  readonly graph: CatalogReader;
  /** Scene box of a drawn record (the bound stream's `boundsMap`). */
  bounds(id: string): BoundingBox | undefined;
  /** Topmost drawn record under a scene point. */
  pick(x: number, y: number): string | undefined;
  selection(): readonly CatalogSelectionItem[];
  /** The edit target of a drawn record (ADR-261 — drops write to it, not to its source node). */
  itemOfRecord(id: string): CatalogSelectionItem | undefined;
  /** The entered container (its direct children are the marquee's level). */
  editingContext(): string | undefined;
  selectRecords(ids: readonly string[], options?: { additive?: boolean }): void;
  breakpoint(): BreakpointName;
  execute(command: CatalogCommand): void;
  newId: NewId;
  /** The page of a page body record, when that page can move (not the home page). */
  movablePageOf?(record: string): string | undefined;
  /**
   * The command a page frame drop at a scene point commits, with the other selected pages dragged
   * by the same offset (`undefined` = refused/unchanged).
   */
  pageDropCommand?(
    page: string,
    topLeft: { x: number; y: number },
    followers?: readonly { page: string; topLeft: { x: number; y: number } }[],
  ): CatalogCommand | undefined;
  /** Laid-out page frames (page drags snap to the other pages). */
  pageFrames?(): ReadonlyMap<string, BoundingBox>;
  /** Manual guides in scene coordinates, without those of `excludePages` (they move along). */
  guideLines?(excludePages?: ReadonlySet<string>): SnapGuideLines;
  /**
   * Live reflow: show a resize / spacing drag's values on its record while it moves (no `patch`
   * = put the record's own values back, before the release commits them).
   */
  reflow?(record: string, patch?: CatalogRecordPreview): void;
  /**
   * A drag the nesting rules refused at the container under the pointer: committed to the nearest
   * ancestor that accepts it (`relocated`, after the step), or cancelled (`rejected`).
   */
  notifyNesting?(notice: CatalogNestingNotice): void;
  /** The Styles box model's padding link: ON = any padding handle edits all four sides. */
  paddingLinked?(): boolean;
  /** The spacing drag the Styles panel follows (its value and sides); `null` when it ends. */
  spacingLive?(live: CatalogSpacingLive | null): void;
}

export type CatalogNestingNotice =
  | { kind: "relocated"; violation: NestingViolation; target: string }
  | { kind: "rejected"; violation: NestingViolation };

const PADDING_KEY = {
  top: "paddingTop",
  right: "paddingRight",
  bottom: "paddingBottom",
  left: "paddingLeft",
} as const;

/** The Styles panel's view of a spacing drag: the properties it edits and their current value. */
function spacingLiveOf(
  gesture: Extract<Gesture, { kind: "spacing" }>,
): CatalogSpacingLive {
  const properties: SpacingProperty[] = gesture.band.side
    ? gesture.sides.map((side) => PADDING_KEY[side])
    : [gesture.band.property];
  return {
    identity: gesture.item.identity,
    properties,
    values: Object.fromEntries(
      properties.map((property) => [property, gesture.value]),
    ),
  };
}

/** What a drag snaps to, gathered once when it starts moving. */
interface SnapContext {
  candidates: SnapCandidateRect[];
  lines: SnapGuideLines;
}

/** Where a flow drag drops: the container record, its node and the index among the rest. */
export interface CatalogDropTarget {
  readonly container: string;
  /** Where the nodes go: an owned node, or an instance's slot position (its `fillSlot`). */
  readonly parent: NodeParent;
  readonly index: number;
  /** The slot among the container's flow children (the dragged out) — the reflow's opened slot. */
  readonly slot: number;
  /** The container's flow: a row or a column reflows its siblings, a grid shows the line. */
  readonly axis: "row" | "column" | "grid";
  /** The insertion line (scene coordinates; zero width or height). */
  readonly line: BoundingBox;
  /** The container under the pointer refused the nodes: this is its nearest accepting ancestor. */
  readonly relocated?: NestingViolation;
  /** An absolute drag leaving for a page body: the nodes stay absolute there (no line). */
  readonly keepsAbsolute?: true;
  /** A grid container: every cell (outlined while dragging over it, Figma). */
  readonly cells?: readonly BoundingBox[];
  /** A drop into an empty grid cell: that cell (filled instead of a line, Figma). */
  readonly cell?: BoundingBox;
  /** That cell's row and column (0-based): the drop pins the nodes there (Figma). */
  readonly gridCell?: { readonly row: number; readonly column: number };
  /** Over the dragged item's own grid cell: the drop changes nothing. */
  readonly stays?: true;
}

/** A move as the Canvas draws it (`dragPresentation`). */
export interface CatalogDragPresentation {
  /** The dragged records, drawn at the pointer offset (none for a copy). */
  readonly records: readonly string[];
  readonly dx: number;
  readonly dy: number;
  /** The siblings' target offsets (the reflow around the drop). */
  readonly siblings: ReadonlyMap<string, { dx: number; dy: number }>;
  /** Over another container than its own (Figma draws it translucent there). */
  readonly outside: boolean;
}

const EMPTY_BOX: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };

/** An absolutely placed node in a move: its authored placement (it moves by the offset). */
interface MovingAbsolute {
  readonly record: string;
  readonly id: NodeId;
  readonly left: number;
  readonly top: number;
}

/** A spacing handle pressed without a drag (the inline number input edits its value). */
export type CatalogSpacingClick = Readonly<
  Extract<Gesture, { kind: "spacing" }>
>;

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
      /** The authored absolute placement of the leader (`node.placement`): it moves by offset. */
      absolute?: { left: number; top: number };
      /** Every absolutely placed node of the selection (the leader's included). */
      absolutes: MovingAbsolute[];
      active: boolean;
      dx: number;
      dy: number;
      drop?: CatalogDropTarget;
      /** Alt held at the press: the release drops copies (the originals stay). */
      copy: boolean;
      /** ⌘ held (Figma): a container smaller than the dragged box takes it too. */
      bypassSize?: boolean;
      /** Control held (Figma Ignore auto layout · Framer ⌃ drag): the drop places it absolutely. */
      placeAbsolute?: boolean;
      /** The nesting rules refused the container under the pointer and every ancestor. */
      refusal?: NestingViolation;
      snap?: SnapContext;
      snapGuides?: readonly SnapGuide[];
      /** The zoom of the last update (the centre line's threshold is screen px). */
      zoom: number;
    }
  | {
      kind: "spacing";
      startX: number;
      startY: number;
      item: CatalogSelectionItem;
      band: SpacingBand;
      /** The bands that move together (Alt: both sides of the axis, Alt+Shift: all four). */
      bandIds: string[];
      sides: ("top" | "right" | "bottom" | "left")[];
      start: number;
      active: boolean;
      value: number;
    }
  | {
      kind: "page";
      startX: number;
      startY: number;
      page: string;
      startBox: BoundingBox;
      /** The other selected movable pages: they follow the leader's offset. */
      followers: { page: string; startBox: BoundingBox }[];
      active: boolean;
      dx: number;
      dy: number;
      snap?: SnapContext;
      snapGuides?: readonly SnapGuide[];
    }
  | {
      kind: "marquee";
      startX: number;
      startY: number;
      additive: boolean;
      /** The records of the current level (page body children, or the context's children). */
      candidates: string[];
      active: boolean;
      rect: BoundingBox;
      hits: string[];
    }
  | {
      kind: "resize";
      startX: number;
      startY: number;
      handle: HandlePosition;
      item: CatalogSelectionItem;
      startBox: BoundingBox;
      position?: { left: number; top: number };
      /** A ratio with one dependent axis: the drag writes only the driving axis. */
      lock: ResizeRatioLockInput | null;
      active: boolean;
      request: { width?: number; height?: number; left?: number; top?: number };
    };

/**
 * The resize ratio lock of a record (the old Canvas's `resolveResizeRatioLock`): a ratio with one
 * dependent axis (the other fixed or fill) — the drag drives the independent axis only, so the
 * ratio keeps the other.
 */
function ratioLockOf(record: CatalogConsumerNode): ResizeRatioLockInput | null {
  const { visual, sizing } = record;
  const style = {
    aspectRatio: visual.aspectRatio,
    width: sizing.width ?? visual.width,
    height: sizing.height ?? visual.height,
  };
  const dependent = getRatioDependentAxis(
    style,
    record.fillSizing as FillAxes | undefined,
  );
  if (!dependent) return null;
  const ratio = parseAspectRatio(style.aspectRatio);
  return ratio
    ? { driver: dependent === "height" ? "width" : "height", ratio }
    : null;
}

/** What the overlay draws for the gesture in progress. */
export interface CatalogGesturePreview {
  readonly ghost?: BoundingBox;
  /** The other dragged boxes (selected pages, absolutely placed nodes) at the same offset. */
  readonly ghosts?: readonly BoundingBox[];
  readonly line?: BoundingBox;
  /** A grid drop target's cells (outlined) and the empty cell an append fills. */
  readonly cells?: readonly BoundingBox[];
  readonly cell?: BoundingBox;
  /**
   * A reorder in its own row / column: the siblings reflow (`dragPresentation`) and the opened
   * slot shows the drop — no line, no container frame. Into another container the siblings stay
   * and the line and the container frame show it (Figma · pen.dev, measured 2026-10-15).
   */
  readonly reflow?: boolean;
  /** Records drawn at the pointer offset: their selection boxes stay off their old place. */
  readonly moving?: readonly string[];
  readonly container?: BoundingBox;
  /** Marquee: the rectangle and the boxes it would select. */
  readonly marquee?: BoundingBox;
  readonly highlights?: readonly BoundingBox[];
  /** Spacing bands of the dragged container, with the preview values. */
  readonly spacing?: {
    readonly bands: readonly SpacingBand[];
    readonly active: SpacingActiveTarget;
  };
  /** Alignment lines and equal spacing the dragged box snapped to (a flow drag: the centre line). */
  readonly snapGuides?: readonly SnapGuide[];
  /** An absolute drop: the distances to the nearest sibling or parent edge on each side. */
  readonly distances?: readonly MeasureGuide[];
}

/**
 * ADR-248 Phase 4e-3b: Canvas drag gestures over the open project — move (a flow element reorders
 * among its siblings or moves into another structural container; an absolutely placed one moves by
 * offset) and resize by the selection handles (fixed width/height at the current breakpoint). The
 * document does not change during the drag: the overlay draws the preview (a resize / spacing drag
 * also reflows its record on the Canvas, `host.reflow`) and one command commits on release (one
 * history step). Points are scene coordinates; `zoom` converts the threshold.
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
    const placement = record.placement;
    this.gesture = {
      kind: "resize",
      startX: x,
      startY: y,
      handle: handle.position,
      item,
      startBox,
      lock: ratioLockOf(record),
      ...(placement?.kind === "absolute" && item.target.kind === "node"
        ? { position: { left: placement.x, top: placement.y } }
        : {}),
      active: false,
      request: {},
    };
    return true;
  }

  /**
   * A press on a selected element: it drags the selection's document nodes past the threshold
   * (`copy`: Alt held — the release drops copies, the old Canvas's Alt drag duplicate).
   */
  beginMove(
    x: number,
    y: number,
    leader: string,
    options: { copy?: boolean } = {},
  ): boolean {
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
    const placement = leaderRecord.placement;
    // A stylesheet-placed sub-part (`position: absolute` without an authored placement) does not move.
    if (
      placement?.kind !== "absolute" &&
      leaderRecord.layout.position === "absolute"
    )
      return false;
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
      zoom: 1,
      ...(placement?.kind === "absolute"
        ? { absolute: { left: placement.x, top: placement.y } }
        : {}),
      absolutes: moving.flatMap((item) => {
        const own = records.get(item.identity)?.placement;
        return own?.kind === "absolute" && item.target.kind === "node"
          ? [
              {
                record: item.identity,
                id: item.target.id,
                left: own.x,
                top: own.y,
              },
            ]
          : [];
      }),
      active: false,
      dx: 0,
      dy: 0,
      copy: !!options.copy,
    };
    return true;
  }

  /** The single selected structural container (its spacing handles show); not a page body. */
  spacingOwner(): CatalogConsumerNode | undefined {
    const item = this.singleElement();
    const record = item && this.host.records.get(item.identity);
    return record && this.structural(record) ? record : undefined;
  }
  spacingBands(preview?: CatalogSpacingPreview): readonly SpacingBand[] {
    const owner = this.spacingOwner();
    return owner
      ? catalogSpacingBands(
          owner,
          this.host.records,
          (id) => this.host.bounds(id),
          preview,
        )
      : [];
  }
  /** The spacing band under the point (`onHandle`: its handle, which starts a drag). */
  spacingAt(x: number, y: number, zoom: number) {
    return hitTestSpacingBands({ x, y }, this.spacingBands(), zoom);
  }
  /** A press on a spacing handle of the selected container. */
  beginSpacing(
    x: number,
    y: number,
    zoom: number,
    modifiers: { alt?: boolean; shift?: boolean } = {},
  ): boolean {
    const hit = this.spacingAt(x, y, zoom);
    const item = this.singleElement();
    if (!hit?.onHandle || !item) return false;
    const bands = this.spacingBands();
    // The panel's padding link ON: any side edits all four (over the modifiers), as the old
    // spacing interaction did.
    const sides = hit.band.side
      ? this.host.paddingLinked?.()
        ? [...SPACING_SIDES]
        : [
            ...resolveSpacingSidesForModifiers(
              hit.band.side,
              !!modifiers.alt,
              !!modifiers.shift,
            ),
          ]
      : [];
    this.gesture = {
      kind: "spacing",
      startX: x,
      startY: y,
      item,
      band: hit.band,
      bandIds: hit.band.side
        ? bands
            .filter((band) => band.side && sides.includes(band.side))
            .map((band) => band.id)
        : bands.filter((band) => band.kind === "gap").map((band) => band.id),
      sides,
      start: hit.band.value,
      active: false,
      value: hit.band.value,
    };
    return true;
  }

  /** A press on a selected page body of a movable page: past the threshold the frame moves. */
  beginPageDrag(x: number, y: number, record: string): boolean {
    const page = this.host.movablePageOf?.(record);
    const startBox = this.host.bounds(record);
    if (!page || !startBox) return false;
    // The other selected page bodies move with it (the old Canvas's multi page drag).
    const followers = this.host.selection().flatMap((item) => {
      if (item.identity === record) return [];
      if (this.host.records.get(item.identity)?.parentId !== PAGE_GRID)
        return [];
      const other = this.host.movablePageOf?.(item.identity);
      const box = this.host.bounds(item.identity);
      return other && box && other !== page
        ? [{ page: other, startBox: box }]
        : [];
    });
    this.gesture = {
      kind: "page",
      startX: x,
      startY: y,
      page,
      startBox,
      followers,
      active: false,
      dx: 0,
      dy: 0,
    };
    return true;
  }

  /**
   * A press on the page background (a page body or off every page): past the threshold it draws a
   * marquee and selects the elements of the current level it intersects (shift adds to them).
   */
  beginMarquee(x: number, y: number, additive: boolean): void {
    const { records } = this.host;
    const context = this.host.editingContext();
    const candidates: string[] = [];
    for (const record of records.values()) {
      const parent = records.get(record.parentId);
      if (
        context
          ? parent?.sourceId === context || parent?.id === context
          : parent?.parentId === PAGE_GRID
      )
        candidates.push(record.id);
    }
    this.gesture = {
      kind: "marquee",
      startX: x,
      startY: y,
      additive,
      candidates,
      active: false,
      rect: { x, y, width: 0, height: 0 },
      hits: [],
    };
  }

  /** Follow the pointer; returns whether the preview changed. */
  update(
    x: number,
    y: number,
    zoom: number,
    options: {
      axisLock?: boolean;
      /** Snap to other boxes and manual guides (the host's setting; ⌘/Ctrl turns it off). */
      snap?: boolean;
      /** ⌘ held: skip the size rule (a container smaller than the dragged box takes it). */
      bypassSize?: boolean;
      /** Control held: a flow drag drops the nodes absolutely at the dropped position. */
      absolute?: boolean;
    } = {},
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
    if (gesture.kind === "spacing") {
      gesture.value = Math.max(
        0,
        gesture.start +
          applySpacingStep(
            spacingDeltaFromPointer(gesture.band, dx, dy),
            !!options.axisLock,
          ),
      );
      this.showReflow(gesture);
      return true;
    }
    if (gesture.kind === "page") {
      if (options.axisLock) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      gesture.dx = dx;
      gesture.dy = dy;
      this.snap(gesture, zoom, !!options.snap);
      return true;
    }
    if (gesture.kind === "marquee") {
      const rect = {
        x: Math.min(x, gesture.startX),
        y: Math.min(y, gesture.startY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      };
      gesture.rect = rect;
      gesture.hits = gesture.candidates.filter((id) => {
        const box = this.host.bounds(id);
        return !!box && boxesIntersect(rect, box);
      });
      return true;
    }
    if (gesture.kind === "resize") {
      const request = resolveResizeRequest({
        handle: gesture.handle,
        startBounds: gesture.startBox,
        dx,
        dy,
        lock: gesture.lock,
        position: gesture.position ?? null,
      });
      gesture.request =
        gesture.lock || options.snap === false
          ? request
          : this.snapResizeToCells(gesture, request, zoom);
      this.showReflow(gesture);
      return true;
    }
    if (options.axisLock) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    gesture.dx = dx;
    gesture.dy = dy;
    gesture.zoom = zoom;
    // An absolutely placed element snaps (a flow drag reorders; the old Canvas never snapped it).
    if (gesture.absolute) this.snap(gesture, zoom, !!options.snap);
    gesture.bypassSize = !!options.bypassSize;
    gesture.placeAbsolute =
      !gesture.absolute && !gesture.copy && !!options.absolute;
    gesture.drop = gesture.absolute
      ? this.absoluteReparent(x, y, gesture)
      : this.dropTarget(x, y, gesture);
    if (gesture.placeAbsolute && gesture.drop)
      gesture.drop = { ...gesture.drop, keepsAbsolute: true };
    return true;
  }

  /**
   * Snap the dragged box (the old Canvas's `resolveSnappedPosition`, stateless: it lets go once
   * the pointer leaves the threshold). A page snaps to the other page frames and the guides of
   * the other pages; an absolute element to its parent's box, its siblings and every guide.
   */
  private snap(
    gesture: Extract<Gesture, { kind: "move" | "page" }>,
    zoom: number,
    enabled: boolean,
  ): void {
    gesture.snapGuides = undefined;
    if (!enabled) return;
    const context = (gesture.snap ??= this.snapContext(gesture));
    if (
      !context.candidates.length &&
      !context.lines.x.length &&
      !context.lines.y.length
    )
      return;
    const box = gesture.startBox;
    const snapped = resolveSnappedPosition(
      { x: box.x + gesture.dx, y: box.y + gesture.dy },
      { width: box.width, height: box.height },
      context.candidates,
      SNAP_THRESHOLD_SCREEN_PX / Math.max(zoom, 0.001),
      context.lines,
    );
    gesture.dx = snapped.position.x - box.x;
    gesture.dy = snapped.position.y - box.y;
    gesture.snapGuides = snapped.guides;
  }
  /**
   * A grid child's handle resize snaps its moving edges to the grid's cell lines (Figma — the
   * cells are snap targets; 2026-10-16 사용자 보고 「세로 2칸은 snap 이 안 된다」 — a resize had no
   * snap at all, a column edge only met a sibling's edge by chance). Only the size changes; the
   * span stays (사용자 결정 — the node grows over the cells).
   */
  private snapResizeToCells(
    gesture: Extract<Gesture, { kind: "resize" }>,
    request: Extract<Gesture, { kind: "resize" }>["request"],
    zoom: number,
  ): Extract<Gesture, { kind: "resize" }>["request"] {
    const records = this.host.records;
    const record = records.get(gesture.item.identity);
    const parent = record && records.get(record.parentId);
    if (
      !record ||
      !parent ||
      record.placement?.kind === "absolute" ||
      record.layout.position === "absolute"
    )
      return request;
    const cells = this.gridLayoutOf(parent, 0, false)?.cells;
    if (!cells?.length) return request;
    const xs = cells.flatMap((cell) => [cell.x, cell.x + cell.width]);
    const ys = cells.flatMap((cell) => [cell.y, cell.y + cell.height]);
    const threshold = SNAP_THRESHOLD_SCREEN_PX / Math.max(zoom, 0.001);
    const near = (value: number, lines: readonly number[]) => {
      let best: number | undefined;
      for (const line of lines)
        if (
          Math.abs(line - value) <= threshold &&
          (best === undefined || Math.abs(line - value) < Math.abs(best - value))
        )
          best = line;
      return best;
    };
    const box = gesture.startBox;
    const { handle } = gesture;
    const out = { ...request };
    if (out.width !== undefined) {
      if (handle.includes("right")) {
        const line = near(box.x + out.width, xs);
        if (line !== undefined && line > box.x) out.width = line - box.x;
      } else if (handle.includes("left")) {
        const right = box.x + box.width;
        const line = near(right - out.width, xs);
        if (line !== undefined && line < right) out.width = right - line;
      }
    }
    if (out.height !== undefined) {
      if (handle.includes("bottom")) {
        const line = near(box.y + out.height, ys);
        if (line !== undefined && line > box.y) out.height = line - box.y;
      } else if (handle.includes("top")) {
        const bottom = box.y + box.height;
        const line = near(bottom - out.height, ys);
        if (line !== undefined && line < bottom) out.height = bottom - line;
      }
    }
    return out;
  }

  private snapContext(
    gesture: Extract<Gesture, { kind: "move" | "page" }>,
  ): SnapContext {
    const candidates: SnapCandidateRect[] = [];
    if (gesture.kind === "page") {
      for (const [id, rect] of this.host.pageFrames?.() ?? [])
        if (id !== gesture.page) candidates.push({ id, ...rect });
      return {
        candidates,
        lines: this.host.guideLines?.(new Set([gesture.page])) ?? {
          x: [],
          y: [],
        },
      };
    }
    const parentId = this.host.records.get(gesture.leader)?.parentId;
    const parent = parentId ? this.host.records.get(parentId) : undefined;
    const moving = new Set(gesture.records);
    const parentBox = parentId ? this.host.bounds(parentId) : undefined;
    if (parentId && parentBox) candidates.push({ id: parentId, ...parentBox });
    for (const id of parent?.children ?? []) {
      if (moving.has(id)) continue;
      const box = this.host.bounds(id);
      if (box) candidates.push({ id, ...box });
    }
    return {
      candidates,
      lines: this.host.guideLines?.() ?? { x: [], y: [] },
    };
  }

  preview(): CatalogGesturePreview | undefined {
    const gesture = this.gesture;
    if (!gesture?.active) return undefined;
    if (gesture.kind === "spacing")
      return {
        spacing: {
          bands: this.spacingBands(
            gesture.band.side
              ? {
                  padding: Object.fromEntries(
                    gesture.sides.map((side) => [side, gesture.value]),
                  ),
                }
              : { gap: gesture.value },
          ),
          active: {
            bandId: gesture.band.id,
            bandIds: gesture.bandIds,
            mode: "drag",
          },
        },
      };
    if (gesture.kind === "page")
      return {
        ghost: {
          ...gesture.startBox,
          x: gesture.startBox.x + gesture.dx,
          y: gesture.startBox.y + gesture.dy,
        },
        ghosts: gesture.followers.map(({ startBox }) => ({
          ...startBox,
          x: startBox.x + gesture.dx,
          y: startBox.y + gesture.dy,
        })),
        snapGuides: gesture.snapGuides,
      };
    if (gesture.kind === "marquee")
      return {
        marquee: gesture.rect,
        highlights: gesture.hits
          .map((id) => this.host.bounds(id))
          .filter((box): box is BoundingBox => !!box),
      };
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
    // The other absolutely placed nodes move by the same offset (not into a flow container).
    const ghosts =
      gesture.absolute && (!gesture.drop || gesture.drop.keepsAbsolute)
        ? gesture.absolutes
            .filter((item) => item.record !== gesture.leader)
            .map((item) => this.host.bounds(item.record))
            .filter((box): box is BoundingBox => !!box)
            .map((box) => ({
              ...box,
              x: box.x + gesture.dx,
              y: box.y + gesture.dy,
            }))
        : [];
    const moving = gesture.copy ? {} : { moving: gesture.records };
    const guides = this.dragGuides(gesture, ghost);
    if (!gesture.drop) return { ghost, ghosts, ...guides, ...moving };
    return {
      ghost,
      ghosts,
      ...guides,
      ...moving,
      ...(gesture.drop.keepsAbsolute
        ? {}
        : gesture.drop.cell
          ? { cell: gesture.drop.cell }
          : { line: gesture.drop.line }),
      ...(gesture.drop.cells && !gesture.drop.keepsAbsolute
        ? { cells: gesture.drop.cells }
        : {}),
      ...(this.reflows(gesture)
        ? { reflow: true }
        : { container: this.host.bounds(gesture.drop.container) }),
    };
  }

  /**
   * The guides of a move (2026-10-15 사용자 결정 — no key: Alt starts a copy). An absolute drop
   * measures each side to the nearest sibling or the container's edge (with the snap lines); a flow
   * drop shows the container's centre line when the dragged box's centre meets it (no snap).
   */
  private dragGuides(
    gesture: Extract<Gesture, { kind: "move" }>,
    ghost: BoundingBox,
  ): Pick<CatalogGesturePreview, "snapGuides" | "distances"> {
    const drop = gesture.drop;
    const container =
      drop?.container ?? this.host.records.get(gesture.leader)?.parentId;
    const box = container ? this.host.bounds(container) : undefined;
    if (!container || !box) return {};
    if (drop ? drop.keepsAbsolute : gesture.absolute) {
      const moving = new Set(gesture.records);
      const siblings = (this.host.records.get(container)?.children ?? [])
        .filter((id) => !moving.has(id))
        .map((id) => this.host.bounds(id))
        .filter((sibling): sibling is BoundingBox => !!sibling);
      return {
        snapGuides: gesture.snapGuides,
        distances: resolveDragDistanceGuides(ghost, box, siblings),
      };
    }
    if (!drop) return {};
    return {
      snapGuides: resolveCentreGuides(
        ghost,
        box,
        SNAP_THRESHOLD_SCREEN_PX / Math.max(gesture.zoom, 0.001),
      ),
    };
  }

  /**
   * The drag as the Canvas draws it (Figma · Pen.dev): the dragged records at the pointer offset
   * (none for a copy — the originals stay) and the siblings' target offsets of a flow drop — the
   * source closes up behind the dragged, the target opens its slot. A grid keeps its line.
   */
  dragPresentation(): CatalogDragPresentation | undefined {
    const gesture = this.gesture;
    if (gesture?.kind !== "move" || !gesture.active) return undefined;
    const siblings = new Map<string, { dx: number; dy: number }>();
    if (!gesture.copy && !gesture.absolute) this.reflowSiblings(gesture, siblings);
    const drop = gesture.drop;
    return {
      records: gesture.copy ? [] : [...gesture.records],
      dx: gesture.dx,
      dy: gesture.dy,
      siblings,
      outside:
        !!drop &&
        drop.container !== this.host.records.get(gesture.leader)?.parentId,
    };
  }

  /** A reorder within the dragged nodes' own row / column flow (its siblings open the slot). */
  private reflows(gesture: Extract<Gesture, { kind: "move" }>): boolean {
    const drop = gesture.drop;
    return (
      !!drop &&
      !gesture.copy &&
      !gesture.absolute &&
      !drop.keepsAbsolute &&
      drop.axis !== "grid" &&
      drop.container === this.host.records.get(gesture.leader)?.parentId
    );
  }

  private reflowSiblings(
    gesture: Extract<Gesture, { kind: "move" }>,
    out: Map<string, { dx: number; dy: number }>,
  ): void {
    const records = this.host.records;
    const drop = gesture.drop;
    if (!drop) return;
    const dragged = new Set(gesture.records);
    const source = records.get(records.get(gesture.leader)?.parentId ?? "");
    const target = records.get(drop.container);
    const sameFlow = source?.id === drop.container && !drop.keepsAbsolute;
    // The source closes up behind the dragged (it leaves that flow).
    if (source && !sameFlow && this.flowKind(source) !== "grid")
      this.layoutFlow(source, dragged, undefined, out);
    // A reorder opens the slot in its own flow; another container keeps its siblings (the line).
    if (target && this.reflows(gesture))
      this.layoutFlow(target, dragged, drop.slot, out);
  }

  /**
   * Lay a row / column flow out again along its axis (the measured gap between its first boxes):
   * the dragged out, and — with `slot` — a hole of the dragged boxes' size at that slot. Each
   * child's offset from where it is drawn goes into `out`.
   */
  private layoutFlow(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
    slot: number | undefined,
    out: Map<string, { dx: number; dy: number }>,
  ): void {
    const kind = this.flowKind(container);
    if (kind === "grid") return;
    const row = kind === "row";
    const start = (box: BoundingBox) => (row ? box.x : box.y);
    const size = (box: BoundingBox) => (row ? box.width : box.height);
    const all = this.flowEntries(container, new Set());
    if (!all.length) return;
    const gap = this.flowGap(container, kind, all.map(({ box }) => box));
    const moving = all.filter(({ id }) => dragged.has(id));
    const rest = all.filter(({ id }) => !dragged.has(id));
    const hole =
      slot === undefined
        ? 0
        : (moving.length
            ? moving.reduce((sum, { box }) => sum + size(box), 0) +
              gap * (moving.length - 1)
            : dragged.size
              ? [...dragged].reduce(
                  (sum, id) => sum + size(this.host.bounds(id) ?? EMPTY_BOX),
                  0,
                ) + gap * (dragged.size - 1)
              : 0) + gap;
    let cursor = start(all[0]!.box);
    rest.forEach(({ id, box }, index) => {
      if (index === slot) cursor += hole;
      const delta = cursor - start(box);
      if (delta) out.set(id, row ? { dx: delta, dy: 0 } : { dx: 0, dy: delta });
      cursor += size(box) + gap;
    });
  }

  /**
   * Release: commit the gesture as one command (nothing when it never started or would not move);
   * a marquee selects its hits instead (no command). Returns whether a command ran.
   */
  finish(): boolean {
    const gesture = this.gesture;
    this.gesture = undefined;
    this.endReflow();
    if (gesture?.kind === "spacing") this.host.spacingLive?.(null);
    // A spacing handle pressed and released without a drag opens the inline number input.
    this.spacingClick =
      gesture?.kind === "spacing" && !gesture.active ? gesture : undefined;
    if (!gesture?.active) return false;
    if (gesture.kind === "marquee") {
      if (gesture.additive)
        this.host.selectRecords(
          gesture.hits.filter(
            (id) => !this.host.selection().some((item) => item.identity === id),
          ),
          { additive: true },
        );
      else this.host.selectRecords(gesture.hits);
      return false;
    }
    const command = this.commandOf(gesture);
    if (!command) {
      // Refused everywhere, or the accepting ancestor is where it already is: nothing moves.
      const violation =
        gesture.kind === "move"
          ? (gesture.drop?.relocated ?? gesture.refusal)
          : undefined;
      if (violation) this.host.notifyNesting?.({ kind: "rejected", violation });
      return false;
    }
    this.host.execute(command);
    const relocated = gesture.kind === "move" ? gesture.drop : undefined;
    if (relocated?.relocated)
      this.host.notifyNesting?.({
        kind: "relocated",
        violation: relocated.relocated,
        target: this.typeOf(relocated.container) ?? "",
      });
    return true;
  }
  cancel(): void {
    if (this.gesture?.kind === "spacing") this.host.spacingLive?.(null);
    this.gesture = undefined;
    this.spacingClick = undefined;
    this.endReflow();
  }

  /** The record a drag shows its values on (`host.reflow`). */
  private reflowed: string | undefined;
  /**
   * The old Canvas's resize / spacing presentation: the record takes the drag's values while it
   * moves, so its siblings and children reflow live; the document changes only on release.
   */
  private showReflow(
    gesture: Extract<Gesture, { kind: "spacing" | "resize" }>,
  ): void {
    if (!this.host.reflow) return;
    this.reflowed = gesture.item.identity;
    if (gesture.kind === "spacing") {
      this.host.reflow(this.reflowed, {
        visual: gesture.band.side
          ? Object.fromEntries(
              gesture.sides.map((side) => [PADDING_KEY[side], gesture.value]),
            )
          : { gap: gesture.value },
      });
      this.host.spacingLive?.(spacingLiveOf(gesture));
      return;
    }
    const { width, height, left, top } = gesture.request;
    const start = gesture.position;
    // A ColorWheel previews its diameter square (the release writes `size` — `commandOf`).
    const wheel = this.colorWheelSizeOf(gesture);
    this.host.reflow(this.reflowed, {
      sizing:
        wheel !== undefined
          ? { width: wheel, height: wheel }
          : {
              ...(width !== undefined ? { width } : {}),
              ...(height !== undefined ? { height } : {}),
            },
      ...(start && (left !== undefined || top !== undefined)
        ? {
            placement: {
              kind: "absolute",
              x: left ?? start.left,
              y: top ?? start.top,
            },
          }
        : {}),
    });
  }
  private endReflow(): void {
    const record = this.reflowed;
    this.reflowed = undefined;
    if (record) this.host.reflow?.(record);
  }

  private spacingClick: CatalogSpacingClick | undefined;
  /** The spacing handle the last release clicked (once: taking it clears it). */
  takeSpacingClick(): CatalogSpacingClick | undefined {
    const click = this.spacingClick;
    this.spacingClick = undefined;
    return click;
  }
  /**
   * The inline input's value as one step — the same command a drag to that value commits
   * (every moving side gets it); nothing when it is unchanged or not a length.
   */
  spacingValueCommand(
    click: CatalogSpacingClick,
    value: number,
  ): CatalogCommand | undefined {
    if (!Number.isFinite(value) || value < 0) return undefined;
    return this.commandOf({ ...click, active: true, value });
  }

  /** A structural container (drop target, spacing owner): body, frame, Group, Section, Card… */
  private structural(record: CatalogConsumerNode): boolean {
    try {
      return STRUCTURAL.has(
        definitionTypeName(
          this.host.graph,
          record.definitionId as DefinitionId,
        ).toLowerCase(),
      );
    } catch {
      return false;
    }
  }

  private singleElement(): CatalogSelectionItem | undefined {
    const selection = this.host.selection();
    if (selection.length !== 1) return undefined;
    const record = this.host.records.get(selection[0].identity);
    return record && record.parentId !== PAGE_GRID ? selection[0] : undefined;
  }

  private commandOf(
    gesture: Exclude<Gesture, { kind: "marquee" }>,
  ): CatalogCommand | undefined {
    const breakpoint = this.host.breakpoint();
    if (gesture.kind === "page")
      return gesture.dx || gesture.dy
        ? this.host.pageDropCommand?.(
            gesture.page,
            {
              x: gesture.startBox.x + gesture.dx,
              y: gesture.startBox.y + gesture.dy,
            },
            gesture.followers.map(({ page, startBox }) => ({
              page,
              topLeft: {
                x: startBox.x + gesture.dx,
                y: startBox.y + gesture.dy,
              },
            })),
          )
        : undefined;
    if (gesture.kind === "spacing") {
      if (gesture.value === gesture.start) return undefined;
      return setFields({
        targets: [gesture.item.target],
        breakpoint,
        visual: gesture.band.side
          ? Object.fromEntries(
              gesture.sides.map((side) => [
                PADDING_KEY[side],
                { kind: "set", value: gesture.value },
              ]),
            )
          : { gap: { kind: "set", value: gesture.value } },
        label: gesture.band.side ? "Padding" : "Gap",
      });
    }
    if (gesture.kind === "resize") {
      const { width, height, left, top } = gesture.request;
      if (width === undefined && height === undefined) return undefined;
      // ADR-258 후속: a ColorWheel is its S2 `size` square (S2 sizes the wheel from it over any
      // style) — a handle drag edits the diameter, so the track and thumb follow the box.
      const wheel = this.colorWheelSizeOf(gesture);
      const size =
        wheel !== undefined
          ? setFields({
              targets: [gesture.item.target],
              props: { size: { kind: "set", value: wheel } },
              label: "Resize",
            })
          : setFields({
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
              label: "Resize",
            });
      const start = gesture.position;
      if (!start || (left === undefined && top === undefined)) return size;
      // A left/top handle of an absolutely placed node also moves it (the opposite edge stays).
      const place = setWholeField({
        targets: [gesture.item.target],
        field: "placement",
        value: { kind: "absolute", x: left ?? start.left, y: top ?? start.top },
      });
      return (reader) => ({
        label: "Resize",
        ops: [...size(reader).ops, ...place(reader).ops],
      });
    }
    if (gesture.absolute) return this.absoluteMoveCommand(gesture);
    if (gesture.placeAbsolute) return this.placeAbsoluteCommand(gesture);
    const drop = gesture.drop;
    if (!drop) return undefined;
    if (gesture.copy) return this.copyCommand(gesture.ids, gesture.records, drop);
    if (drop.stays) return undefined;
    const leader = this.host.records.get(gesture.leader)!;
    const lines = this.gridLineCommands(gesture.ids, gesture.records, drop);
    const commands: CatalogCommand[] = [];
    if (
      gesture.ids.length !== 1 ||
      leader.parentId !== drop.container ||
      this.siblingIndex(drop.container, gesture.records) !== drop.index
    )
      commands.push(
        moveNodes({
          ids: gesture.ids,
          parent: drop.parent,
          index: drop.index,
          newId: this.host.newId,
        }),
      );
    if (!commands.length && !lines.length) return undefined;
    if (!lines.length) return commands[0];
    const graph = this.host.graph as CatalogGraph;
    return () => composeCommands(graph, "Move", [...commands, ...lines]);
  }

  /**
   * Alt drop: copies at the drop, selected; into an empty grid cell the copies are pinned there
   * (their ids come from the paste).
   */
  private copyCommand(
    ids: readonly NodeId[],
    records: readonly string[],
    drop: CatalogDropTarget,
  ): CatalogCommand {
    const newId = this.host.newId;
    const place = drop.gridCell && drop.cell;
    return (reader) => {
      const paste = pasteNodes({
        clipboard: copyNodes(reader, ids),
        parent: drop.parent,
        index: drop.index,
        newId,
        label: "Duplicate",
      });
      if (!place) return paste(reader);
      const stage = stageOver(reader);
      const plan = paste(stage);
      stage.apply(plan.ops);
      const copies = plan.selectAfter ?? [];
      // The copies take the originals' spans.
      const lines = this.gridLineCommands(copies, records, drop);
      const ops = [...plan.ops];
      for (const command of lines) {
        const next = command(stage);
        stage.apply(next.ops);
        ops.push(...next.ops);
      }
      return { ...plan, ops };
    };
  }

  /**
   * Control drag of flow nodes (Figma Ignore auto layout · Framer ⌃ drag): the nodes go to the front
   * of the drop container (the end of its children, as the Position toggle) and keep where they
   * were dropped as their placement (from its padding box); a fill axis becomes its drawn px. One
   * step.
   */
  private placeAbsoluteCommand(
    gesture: Extract<Gesture, { kind: "move" }>,
  ): CatalogCommand | undefined {
    const { records, graph, newId } = this.host;
    const drop = gesture.drop;
    const container = drop && records.get(drop.container);
    const frame = drop && this.host.bounds(drop.container);
    if (!drop || !container || !frame) return undefined;
    const border = catalogBoxModel(container).borderWidth;
    const inset = typeof border === "number" ? border : 0;
    const commands: CatalogCommand[] = [];
    const trailing = container.children.slice(-gesture.records.length);
    if (!gesture.records.every((record, index) => trailing[index] === record))
      commands.push(moveNodes({ ids: gesture.ids, parent: drop.parent, newId }));
    gesture.records.forEach((record, index) => {
      const box = this.host.bounds(record);
      const id = gesture.ids[index];
      if (!box || !id) return;
      commands.push(
        setWholeField({
          targets: [{ kind: "node", id }],
          field: "placement",
          value: {
            kind: "absolute",
            x: Math.round(box.x + gesture.dx - frame.x - inset),
            y: Math.round(box.y + gesture.dy - frame.y - inset),
          },
        }),
      );
      const entry = graph.getEntry(id);
      const fill = entry?.kind === "node" ? entry.fillSizing : undefined;
      for (const axis of ["width", "height"] as const) {
        if (!fill?.[axis]) continue;
        commands.push(
          setFillSizing({ targets: [{ kind: "node", id }], axis, value: undefined }),
          setFields({
            targets: [{ kind: "node", id }],
            sizing: { [axis]: { kind: "set", value: Math.round(box[axis]) } },
          }),
        );
      }
    });
    return () =>
      composeCommands(graph as CatalogGraph, "Absolute position", commands);
  }

  /**
   * An absolute leader's drop (the old Canvas's manual position drop): over a structural container
   * other than its parent the selection reparents — into a flow container it joins the flow (its
   * placement goes), into a page body (another page's too) it stays absolute at the front. Over its
   * own parent (or nowhere) it only moves by the offset.
   */
  private absoluteReparent(
    x: number,
    y: number,
    gesture: Extract<Gesture, { kind: "move" }>,
  ): CatalogDropTarget | undefined {
    const drop = this.dropTarget(x, y, gesture);
    const leader = this.host.records.get(gesture.leader);
    if (!drop || !leader || drop.container === leader.parentId) {
      gesture.refusal = undefined;
      return undefined;
    }
    if (this.host.records.get(drop.container)?.parentId !== PAGE_GRID)
      return drop;
    return { ...drop, index: 0, keepsAbsolute: true };
  }

  /**
   * The release of an absolute leader's drag: the nodes leaving for another container move there
   * (one step), and every absolutely placed node gets its placement — the offset in place, the
   * position in the new page body, none in a flow container. Alt: copies instead.
   */
  private absoluteMoveCommand(
    gesture: Extract<Gesture, { kind: "move" }>,
  ): CatalogCommand | undefined {
    const { records, newId } = this.host;
    const drop = gesture.drop;
    if (!drop && !gesture.dx && !gesture.dy) return undefined;
    const offset = (item: MovingAbsolute) => ({
      kind: "absolute" as const,
      x: Math.round(item.left + gesture.dx),
      y: Math.round(item.top + gesture.dy),
    });
    if (gesture.copy) {
      if (drop) return this.copyCommand(gesture.ids, gesture.records, drop);
      return this.absoluteCopy(gesture.absolutes, offset);
    }
    const commands: CatalogCommand[] = [];
    const leaving = new Set(
      drop
        ? gesture.records.filter(
            (record) => records.get(record)?.parentId !== drop.container,
          )
        : [],
    );
    if (drop && leaving.size) {
      const moved = gesture.records.flatMap((record, index) =>
        leaving.has(record) ? [index] : [],
      );
      commands.push(
        moveNodes({
          ids: moved.map((index) => gesture.ids[index]!),
          parent: drop.parent,
          index: drop.index,
          newId,
        }),
      );
      if (drop.gridCell)
        commands.push(
          ...this.gridLineCommands(
            moved.map((index) => gesture.ids[index]!),
            moved.map((index) => gesture.records[index]!),
            drop,
          ),
        );
    }
    const container = drop ? this.host.bounds(drop.container) : undefined;
    for (const item of gesture.absolutes) {
      let placement: ReturnType<typeof offset> | undefined = offset(item);
      if (leaving.has(item.record)) {
        const box = this.host.bounds(item.record);
        placement =
          drop?.keepsAbsolute && box && container
            ? {
                kind: "absolute",
                x: Math.round(box.x + gesture.dx - container.x),
                y: Math.round(box.y + gesture.dy - container.y),
              }
            : undefined;
      }
      commands.push(
        setWholeField({
          targets: [{ kind: "node", id: item.id }],
          field: "placement",
          value: placement,
        }),
      );
    }
    const graph = this.host.graph as CatalogGraph;
    return () => composeCommands(graph, "Move", commands);
  }

  /**
   * Alt drag of absolutely placed nodes: a copy right after each in the same parent, at the
   * dragged offset (the originals stay).
   */
  private absoluteCopy(
    items: readonly MovingAbsolute[],
    offset: (item: MovingAbsolute) => {
      kind: "absolute";
      x: number;
      y: number;
    },
  ): CatalogCommand | undefined {
    const { records, newId } = this.host;
    const commands: CatalogCommand[] = [];
    for (const item of items) {
      const record = records.get(item.record);
      const parentRecord = record ? records.get(record.parentId) : undefined;
      const target =
        parentRecord && this.host.itemOfRecord(parentRecord.id)?.target;
      const parent = target && catalogInsertParent(this.host.graph, target);
      if (!record || !parentRecord || !parent) continue;
      const index = parentRecord.children.indexOf(record.id) + 1;
      const placement = offset(item);
      commands.push((reader) => {
        const clipboard = copyNodes(reader, [item.id]);
        return pasteNodes({
          clipboard: {
            ...clipboard,
            entries: clipboard.entries.map((entry) =>
              entry.id === item.id && entry.kind === "node"
                ? { ...entry, placement }
                : entry,
            ),
          },
          parent,
          index,
          newId,
          label: "Duplicate",
        })(reader);
      });
    }
    if (!commands.length) return undefined;
    const graph = this.host.graph as CatalogGraph;
    return () => composeCommands(graph, "Duplicate", commands);
  }

  /** A ColorWheel resize's diameter (its S2 `size`); undefined for any other record. */
  private colorWheelSizeOf(
    gesture: Extract<Gesture, { kind: "resize" }>,
  ): number | undefined {
    if (this.typeOf(gesture.item.identity) !== "ColorWheel") return undefined;
    return catalogColorWheelSizeOfBox(
      gesture.request.width,
      gesture.request.height,
    );
  }

  /** A record's definition type name (the nesting rules' vocabulary). */
  private typeOf(id: string): string | undefined {
    const record = this.host.records.get(id);
    if (!record) return undefined;
    try {
      return definitionTypeName(
        this.host.graph,
        record.definitionId as DefinitionId,
      );
    } catch {
      return undefined;
    }
  }

  /** Why the nesting rules refuse the dragged leader inside `container` (for the notice). */
  private nestingViolation(
    container: string,
    leader: string,
  ): NestingViolation | undefined {
    const childType = this.typeOf(leader);
    if (!childType) return undefined;
    const ancestorTypes: string[] = [];
    for (
      let record = this.host.records.get(container);
      record && record.id !== PAGE_GRID;
      record = this.host.records.get(record.parentId)
    ) {
      const type = this.typeOf(record.id);
      if (type) ancestorTypes.push(type);
    }
    return (
      resolveNestingViolation({
        parentType: ancestorTypes[0] ?? null,
        childType,
        ancestorTypes,
      }) ?? undefined
    );
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
    // A copy leaves the originals in place: they count for the insertion index and line.
    const excluded = gesture.copy ? new Set<string>() : dragged;
    const within = (id: string) => {
      for (
        let record = records.get(id);
        record;
        record = records.get(record.parentId)
      )
        if (dragged.has(record.id)) return true;
      return false;
    };
    gesture.refusal = undefined;
    let refused: NestingViolation | undefined;
    for (
      let record = records.get(this.host.pick(x, y) ?? "");
      record;
      record = records.get(record.parentId)
    ) {
      if (within(record.id)) continue;
      // ADR-261: the record's edit target — an instance's slot position fills that instance, a
      // template position without a slot takes nothing (the origin and the layout stay as they are).
      const target = this.host.itemOfRecord(record.id)?.target;
      const parent = target && catalogInsertParent(graph, target);
      if (!parent) continue;
      if (!this.structural(record)) continue;
      // Figma: an object larger than a container (either side) does not enter it — ⌘ bypasses.
      // Its own parent always takes it back (a reorder).
      if (
        !gesture.bypassSize &&
        record.id !== records.get(gesture.leader)?.parentId
      ) {
        const frame = this.host.bounds(record.id);
        if (
          frame &&
          (gesture.startBox.width > frame.width ||
            gesture.startBox.height > frame.height)
        )
          continue;
      }
      // Past a refused container the nodes go to the end of the accepting ancestor (the old
      // Canvas's nearest droppable ancestor).
      const grid = refused
        ? undefined
        : this.gridTarget(record, excluded, x, y, gesture);
      const slot = refused
        ? this.flowEntries(record, excluded).length
        : (grid?.slot ?? this.flowSlot(record, excluded, x, y));
      const index = this.documentIndex(record, excluded, slot);
      try {
        // The command's own checks (nesting, not into itself) decide whether the drop is allowed.
        moveNodes({
          ids: gesture.ids,
          parent,
          index,
          newId: this.host.newId,
        })(graph);
      } catch (error) {
        if ((error as { code?: unknown })?.code !== "NESTING_NOT_ALLOWED")
          return undefined;
        refused ??=
          this.nestingViolation(record.id, gesture.leader) ??
          ({
            layer: "rac-composition",
            parentType: this.typeOf(record.id) ?? "",
            childType: this.typeOf(gesture.leader) ?? "",
            reason: "",
          } as NestingViolation);
        continue;
      }
      return {
        container: record.id,
        parent,
        index,
        slot,
        axis: this.flowKind(record),
        line: this.insertionLine(record, excluded, slot, gesture.startBox, y),
        ...(grid?.cells ? { cells: grid.cells } : {}),
        ...(grid?.cell ? { cell: grid.cell, gridCell: grid.gridCell } : {}),
        ...(grid?.stays ? { stays: true as const } : {}),
        ...(refused ? { relocated: refused } : {}),
      };
    }
    gesture.refusal = refused;
    return undefined;
  }

  /**
   * The flow axis of a container: a grid (and wrapped rows) is two-dimensional — Figma's grid drop
   * between the cells nearest the cursor.
   */
  private flowKind(
    container: CatalogConsumerNode,
  ): "row" | "column" | "grid" {
    const { display, flexDirection, flexWrap } = container.layout;
    if (display === "grid" || display === "inline-grid") return "grid";
    const flex = display === "flex" || display === "inline-flex";
    const row = flex && !String(flexDirection ?? "row").startsWith("column");
    if (row && String(flexWrap ?? "nowrap").startsWith("wrap")) return "grid";
    return row ? "row" : "column";
  }

  /** The children that take a flow slot (not the dragged, not absolutely placed), with their boxes. */
  private flowEntries(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
  ): { id: string; box: BoundingBox }[] {
    const records = this.host.records;
    return container.children.flatMap((id) => {
      const child = records.get(id);
      if (
        dragged.has(id) ||
        !child ||
        child.placement?.kind === "absolute" ||
        child.layout.position === "absolute"
      )
        return [];
      const box = this.host.bounds(id);
      return box ? [{ id, box }] : [];
    });
  }

  /** The slot among the flow children the point drops into. */
  private flowSlot(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
    x: number,
    y: number,
  ): number {
    const entries = this.flowEntries(container, dragged);
    const kind = this.flowKind(container);
    if (kind !== "grid") {
      let slot = 0;
      for (const { box } of entries)
        if (
          kind === "row"
            ? box.x + box.width / 2 < x
            : box.y + box.height / 2 < y
        )
          slot++;
      return slot;
    }
    // A wrapped row: between the boxes nearest the cursor, in their order.
    let nearest = -1;
    let best = Infinity;
    entries.forEach(({ box }, index) => {
      const dx = Math.max(box.x - x, 0, x - (box.x + box.width));
      const dy = Math.max(box.y - y, 0, y - (box.y + box.height));
      const distance = Math.hypot(dx, dy);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    if (nearest < 0) return 0;
    const box = entries[nearest]!.box;
    const sameRow = y >= box.y && y <= box.y + box.height;
    const after = sameRow
      ? x > box.x + box.width / 2
      : y > box.y + box.height / 2;
    return nearest + (after ? 1 : 0);
  }

  /** A flow slot as the index among the container's children the move writes (the dragged out). */
  private documentIndex(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
    slot: number,
  ): number {
    const rest = container.children.filter((id) => !dragged.has(id));
    const entries = this.flowEntries(container, dragged);
    if (slot < entries.length) return rest.indexOf(entries[slot]!.id);
    const last = entries.at(-1);
    return last ? rest.indexOf(last.id) + 1 : rest.length;
  }

  /**
   * The insertion line of a slot: halfway across the gap between the flow neighbours (the old
   * Canvas's gap-centred line), at the edge when there is one neighbour; vertical in a grid row.
   */
  private insertionLine(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
    slot: number,
    draggedBox: BoundingBox,
    pointerY: number,
  ): BoundingBox {
    const kind = this.flowKind(container);
    const boxes = this.flowEntries(container, dragged).map(({ box }) => box);
    const frame = this.host.bounds(container.id)!;
    const content = this.contentBox(container, frame);
    const vertical = kind !== "column";
    if (kind !== "grid" || !boxes.length) {
      // Figma (measured 2026-10-15, padding 40 · gap 30): the line starts at the content start
      // (inside the padding) and is as long as the dragged box; along the flow it sits half a gap
      // before the first child, in the middle of a gap, half a gap after the last — at the content
      // start in an empty container.
      const gap = boxes.length ? this.flowGap(container, kind, boxes) : 0;
      const start = (box: BoundingBox) => (vertical ? box.x : box.y);
      const end = (box: BoundingBox) =>
        vertical ? box.x + box.width : box.y + box.height;
      const prev = boxes[slot - 1];
      const next = boxes[slot];
      const at = !boxes.length
        ? start(content)
        : prev && next
          ? (end(prev) + start(next)) / 2
          : next
            ? start(next) - gap / 2
            : end(prev!) + gap / 2;
      return vertical
        ? {
            x: at,
            y: content.y,
            width: 0,
            height: Math.min(draggedBox.height, content.height),
          }
        : {
            x: content.x,
            y: at,
            width: Math.min(draggedBox.width, content.width),
            height: 0,
          };
    }
    // A grid (Figma): a vertical line as tall as the cell — mid-gap between two cells of a row,
    // mid-padding at a row's start or end; the pointer's row decides an index at a row break.
    const prev = boxes[slot - 1];
    const next = boxes[slot];
    const inRow = (box: BoundingBox | undefined) =>
      !!box && pointerY >= box.y && pointerY <= box.y + box.height;
    const sameRow = (a: BoundingBox, b: BoundingBox) =>
      a.y < b.y + b.height && b.y < a.y + a.height;
    const right = frame.x + frame.width;
    if (prev && next && sameRow(prev, next))
      return {
        x: (prev.x + prev.width + next.x) / 2,
        y: next.y,
        width: 0,
        height: next.height,
      };
    if (prev && (!next || inRow(prev) || !inRow(next))) {
      const gap = this.flowGap(container, "row", boxes);
      const end = prev.x + prev.width;
      // Another column to its right: mid-gap; the last column: mid-padding.
      const x =
        end + gap < content.x + content.width
          ? end + gap / 2
          : (end + right) / 2;
      return { x, y: prev.y, width: 0, height: prev.height };
    }
    return {
      x: (frame.x + next!.x) / 2,
      y: next!.y,
      width: 0,
      height: next!.height,
    };
  }

  /**
   * A grid drop target (`display: grid`, not a wrapped row — Figma): every cell, and the cell under
   * the pointer (else the nearest). An empty one takes the nodes there (pinned, in reading order
   * among the children); an item's cell drops before or after that item by which side of its own
   * centre the pointer is (the object, as Figma — not the cell); the dragged item's own cell stays.
   */
  private gridTarget(
    container: CatalogConsumerNode,
    dragged: ReadonlySet<string>,
    x: number,
    y: number,
    gesture: Extract<Gesture, { kind: "move" }>,
  ):
    | {
        slot: number;
        cells: readonly BoundingBox[];
        cell?: BoundingBox;
        gridCell?: { row: number; column: number };
        stays?: true;
      }
    | undefined {
    const layout = this.gridLayoutOf(container, gesture.startBox.height);
    if (!layout?.cells.length) return undefined;
    const { cells, occupant, columns } = layout;
    const all = this.flowEntries(container, new Set());
    // The leader takes the cells its size covers: an empty cell is offered only where all are free.
    const spanAt = (cell: number) =>
      this.itemSpan(
        gesture.leader,
        container,
        layout,
        cell % columns,
        Math.floor(cell / columns),
        gesture.startBox,
      );
    // A cell past the drawn rows is not free: a node taller than the rows left would hang below
    // the grid in a 0-high implicit row (2026-10-16 사용자 보고 「배치는 되지만 1칸 이상 그려지지
    // 않음」 — a 2-row node dropped on the last row).
    const free = (cell: number) => {
      const at = occupant[cell];
      return at !== undefined && (at < 0 || dragged.has(all[at]!.id));
    };
    const fits = (cell: number) => {
      const row = Math.floor(cell / columns);
      const column = cell % columns;
      const { columnSpan, rowSpan } = spanAt(cell);
      if (column + columnSpan > columns) return false;
      for (let r = row; r < row + rowSpan; r++)
        for (let c = column; c < column + columnSpan; c++)
          if (!free(r * columns + c)) return false;
      return true;
    };
    let index = -1;
    let best = Infinity;
    cells.forEach((cell, i) => {
      if (occupant[i]! < 0 && !fits(i)) return;
      const dx = Math.max(cell.x - x, 0, x - (cell.x + cell.width));
      const dy = Math.max(cell.y - y, 0, y - (cell.y + cell.height));
      const distance = Math.hypot(dx, dy);
      if (distance < best) {
        best = distance;
        index = i;
      }
    });
    if (index < 0) return { slot: this.flowEntries(container, dragged).length, cells };
    const item = occupant[index]!;
    if (item < 0) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const { columnSpan, rowSpan } = spanAt(index);
      // Reading order: after every other item whose area starts in an earlier cell.
      const slot = all.filter(({ id }, at) => {
        const area = layout.areas[at];
        return (
          !dragged.has(id) &&
          !!area &&
          area.row * columns + area.column < index
        );
      }).length;
      // The span's cells (those drawn — an implicit row past the last is the first cell's height).
      const first = cells[index]!;
      const last =
        cells[(row + rowSpan - 1) * columns + column + columnSpan - 1] ??
        cells[row * columns + column + columnSpan - 1] ??
        first;
      const bottom =
        last.y + last.height +
        (cells[(row + rowSpan - 1) * columns] ? 0 : (rowSpan - 1) * first.height);
      return {
        slot,
        cells,
        cell: {
          x: first.x,
          y: first.y,
          width: last.x + last.width - first.x,
          height: Math.max(first.height, bottom - first.y),
        },
        gridCell: { row, column },
      };
    }
    const before = all
      .slice(0, item)
      .filter(({ id }) => !dragged.has(id)).length;
    const entry = all[item]!;
    if (dragged.has(entry.id)) return { slot: before, cells, stays: true };
    return {
      slot: before + (x > entry.box.x + entry.box.width / 2 ? 1 : 0),
      cells,
    };
  }

  /**
   * A grid container's cells as they are (no append row) — the overlay outlines them while the
   * grid is selected or hovered (Figma). None for any other record.
   */
  gridCellsOfRecord(record: string): BoundingBox[] {
    const container = this.host.records.get(record);
    return (container && this.gridLayoutOf(container, 0, false)?.cells) ?? [];
  }

  /** A flow child's authored grid lines (the record's resolved layout). */
  private gridLines(id: string): GridItemLines {
    const layout = this.host.records.get(id)?.layout;
    return {
      column: layout?.gridColumnStart,
      row: layout?.gridRowStart,
      columnEnd: layout?.gridColumnEnd,
      rowEnd: layout?.gridRowEnd,
    };
  }

  /** A `display: grid` container's cells (`gridLayout`); none for any other container. */
  private gridLayoutOf(
    container: CatalogConsumerNode,
    fallbackHeight: number,
    appendRow = true,
  ): GridLayout | undefined {
    const display = container.layout.display;
    if (display !== "grid" && display !== "inline-grid") return undefined;
    const frame = this.host.bounds(container.id);
    if (!frame) return undefined;
    const entries = this.flowEntries(container, new Set());
    const gap = lengthPx(catalogBoxModel(container).gap) ?? 0;
    return gridLayout({
      content: this.contentBox(container, frame),
      columns: container.layout.gridTemplateColumns as string | undefined,
      columnGap: lengthPx(container.layout.columnGap) ?? gap,
      rowGap: lengthPx(container.layout.rowGap) ?? gap,
      items: entries.map(({ box }) => box),
      lines: entries.map(({ id }) => this.gridLines(id)),
      fallbackHeight,
      rows: container.layout.gridTemplateRows as string | undefined,
      appendRow,
    });
  }

  /**
   * The cells a grid item takes from (`column`, `row`) — Figma: as many as its fixed size covers
   * (the cells keep their size; a CSS `1fr` track would grow to the item instead). In its own grid
   * an item keeps a wider authored span (a hugging item in a wider area).
   */
  private itemSpan(
    record: string,
    container: CatalogConsumerNode,
    layout: GridLayout,
    column: number,
    row: number,
    box: BoundingBox | undefined = this.host.bounds(record),
  ): { columnSpan: number; rowSpan: number } {
    const { tracks } = layout;
    // Only a fixed size says how many cells: a fill or hugging axis follows its cell.
    const node = this.host.records.get(record);
    const fixed = (axis: "width" | "height") =>
      typeof node?.sizing?.[axis] === "number" && !node.fillSizing?.[axis];
    let columnSpan =
      box && fixed("width")
        ? coveredSpan(tracks.columns, column, tracks.columnGap, box.width)
        : 1;
    let rowSpan =
      box && fixed("height")
        ? coveredSpan(tracks.rows, row, tracks.rowGap, box.height)
        : 1;
    if (this.host.records.get(record)?.parentId === container.id) {
      const lines = this.gridLines(record);
      columnSpan = Math.max(
        columnSpan,
        lineSpan(lines.columnEnd) ?? lineSpan(lines.column) ?? 1,
      );
      rowSpan = Math.max(rowSpan, lineSpan(lines.rowEnd) ?? lineSpan(lines.row) ?? 1);
    }
    return { columnSpan: Math.min(columnSpan, layout.columns), rowSpan };
  }

  /**
   * The grid lines a drop writes (Figma — a grid child keeps its cell and takes the cells its size
   * covers). Into an empty cell: the nodes are pinned there (more nodes: the next empty cells in
   * reading order), and an auto-placed sibling the move would shift is pinned where it is — the
   * others stay, the source cell stays empty. Any other drop into a grid unpins a pinned node (it
   * joins the order it was dropped at) and sets its span; out of a grid its lines go.
   */
  private gridLineCommands(
    ids: readonly NodeId[],
    records: readonly string[],
    drop: CatalogDropTarget,
  ): CatalogCommand[] {
    const breakpoint = this.host.breakpoint();
    const clear: WriteValue<string> =
      breakpoint === "desktop" ? { kind: "remove" } : { kind: "set", value: "auto" };
    const has = (value: unknown) => String(value ?? "").trim() !== "";
    /** Starts: a cell (1-based) or `null` = unpin; spans: the cells taken (1 = none). */
    const write = (
      target: EditTarget,
      record: string | undefined,
      starts: { column: number; row: number } | null | undefined,
      spans?: { columnSpan: number; rowSpan: number },
    ) => {
      const lines = record ? this.gridLines(record) : {};
      const layout: Partial<Record<LayoutField, WriteValue<string>>> = {};
      if (starts)
        Object.assign(layout, {
          gridColumnStart: { kind: "set", value: String(starts.column) },
          gridRowStart: { kind: "set", value: String(starts.row) },
        });
      else if (starts === null) {
        if (has(lines.column)) layout.gridColumnStart = clear;
        if (has(lines.row)) layout.gridRowStart = clear;
      }
      if (spans) {
        const end = (span: number, had: unknown) =>
          span > 1
            ? ({ kind: "set", value: `span ${span}` } as const)
            : has(had)
              ? clear
              : undefined;
        const column = end(spans.columnSpan, lines.columnEnd);
        const row = end(spans.rowSpan, lines.rowEnd);
        if (column) layout.gridColumnEnd = column;
        if (row) layout.gridRowEnd = row;
      }
      return Object.keys(layout).length
        ? [setFields({ targets: [target], breakpoint, layout })]
        : [];
    };
    const container = this.host.records.get(drop.container);
    const layout = container && this.gridLayoutOf(container, 0);
    const target = drop.gridCell;
    if (!target || !container || !layout)
      return records.flatMap((record, index) => {
        const node: EditTarget = { kind: "node", id: ids[index]! };
        if (!container || !layout) {
          // Out of a grid: no cell, no span.
          const lines = this.gridLines(record);
          return [lines.column, lines.row, lines.columnEnd, lines.rowEnd].some(has)
            ? write(node, record, null, { columnSpan: 1, rowSpan: 1 })
            : [];
        }
        return write(
          node,
          record,
          null,
          this.itemSpan(record, container, layout, 0, 0),
        );
      });
    const dragged = new Set(records);
    const entries = this.flowEntries(container, new Set());
    const lines = entries.map(({ id }) => this.gridLines(id));
    const before = gridPlacement(lines, layout.columns).cells;
    const columns = layout.columns;
    // The dragged nodes: the target cell, then the next cells where each one's span fits among
    // the cells no sibling takes (reading order).
    const taken = new Set<string>();
    const cover = (area: GridArea) => {
      for (let r = area.row; r < area.row + area.rowSpan; r++)
        for (let c = area.column; c < area.column + area.columnSpan; c++)
          taken.add(`${r}:${c}`);
    };
    entries.forEach(({ id }, at) => {
      if (!dragged.has(id)) cover(before[at]!);
    });
    const placed: GridArea[] = [];
    let cell = target.row * columns + target.column;
    for (const record of records) {
      for (; ; cell++) {
        const row = Math.floor(cell / columns);
        const column = cell % columns;
        const { columnSpan, rowSpan } = this.itemSpan(
          record,
          container,
          layout,
          column,
          row,
        );
        if (column + columnSpan > columns) continue;
        let free = true;
        for (let r = row; free && r < row + rowSpan; r++)
          for (let c = column; c < column + columnSpan; c++)
            if (taken.has(`${r}:${c}`)) free = false;
        if (!free) continue;
        const area = { row, column, rowSpan, columnSpan };
        placed.push(area);
        cover(area);
        cell += columnSpan;
        break;
      }
    }
    const at1 = (area: GridArea) => ({
      column: String(area.column + 1),
      row: String(area.row + 1),
    });
    const spanLines = (area: GridArea) => ({
      columnEnd: area.columnSpan > 1 ? `span ${area.columnSpan}` : undefined,
      rowEnd: area.rowSpan > 1 ? `span ${area.rowSpan}` : undefined,
    });
    // Siblings the move would shift: pinned where they are, until none moves.
    const rest = entries
      .map(({ id }, at) => ({ id, at }))
      .filter(({ id }) => !dragged.has(id));
    const pins = new Set<number>();
    for (;;) {
      const next = gridPlacement(
        [
          ...rest.map(({ at }) =>
            pins.has(at) ? { ...lines[at], ...at1(before[at]!) } : lines[at],
          ),
          ...placed.map((area) => ({ ...at1(area), ...spanLines(area) })),
        ],
        columns,
      ).cells;
      const moved = rest.filter(
        ({ at }, index) =>
          !pins.has(at) &&
          (next[index]!.row !== before[at]!.row ||
            next[index]!.column !== before[at]!.column),
      );
      if (!moved.length) break;
      for (const { at } of moved) pins.add(at);
    }
    return [
      ...records.flatMap((record, index) =>
        write({ kind: "node", id: ids[index]! }, record, {
          column: placed[index]!.column + 1,
          row: placed[index]!.row + 1,
        }, placed[index]),
      ),
      ...[...pins].flatMap((at) => {
        const node = this.host.itemOfRecord(entries[at]!.id)?.target;
        return node
          ? write(node, undefined, {
              column: before[at]!.column + 1,
              row: before[at]!.row + 1,
            })
          : [];
      }),
    ];
  }

  /** A container's content box (inside its border and padding). */
  private contentBox(
    container: CatalogConsumerNode,
    frame: BoundingBox,
  ): BoundingBox {
    const model = catalogBoxModel(container);
    const n = (value: unknown) => (typeof value === "number" ? value : 0);
    const border = n(model.borderWidth);
    const top = border + n(model.padding?.top);
    const left = border + n(model.padding?.left);
    const right = border + n(model.padding?.right);
    const bottom = border + n(model.padding?.bottom);
    return {
      x: frame.x + left,
      y: frame.y + top,
      width: Math.max(0, frame.width - left - right),
      height: Math.max(0, frame.height - top - bottom),
    };
  }

  /**
   * The gap along a row / column flow: the authored one (the axis longhand over `gap`, as the
   * layout input reads them), else the space measured between its first two boxes.
   */
  private flowGap(
    container: CatalogConsumerNode,
    kind: "row" | "column" | "grid",
    boxes: readonly BoundingBox[],
  ): number {
    const authored =
      lengthPx(
        kind === "column" ? container.layout.rowGap : container.layout.columnGap,
      ) ?? lengthPx(catalogBoxModel(container).gap);
    if (authored !== undefined) return Math.max(0, authored);
    if (boxes.length < 2) return 0;
    const [a, b] = boxes as [BoundingBox, BoundingBox];
    return Math.max(0, kind === "column" ? b.y - a.y - a.height : b.x - a.x - a.width);
  }

}
