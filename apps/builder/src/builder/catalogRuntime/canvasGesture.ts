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
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  BreakpointName,
  CatalogReader,
  DefinitionId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { parseAspectRatio } from "../utils/aspectRatio";
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
  resolveSnappedPosition,
  type SnapCandidateRect,
  type SnapGuide,
  type SnapGuideLines,
} from "../workspace/canvas/interaction/snapGuides";

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
  readonly parent: NodeId;
  readonly index: number;
  /** The insertion line (scene coordinates; zero width or height). */
  readonly line: BoundingBox;
  /** The container under the pointer refused the nodes: this is its nearest accepting ancestor. */
  readonly relocated?: NestingViolation;
  /** An absolute drag leaving for a page body: the nodes stay absolute there (no line). */
  readonly keepsAbsolute?: true;
}

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
      /** The nesting rules refused the container under the pointer and every ancestor. */
      refusal?: NestingViolation;
      snap?: SnapContext;
      snapGuides?: readonly SnapGuide[];
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
  readonly container?: BoundingBox;
  /** Marquee: the rectangle and the boxes it would select. */
  readonly marquee?: BoundingBox;
  readonly highlights?: readonly BoundingBox[];
  /** Spacing bands of the dragged container, with the preview values. */
  readonly spacing?: {
    readonly bands: readonly SpacingBand[];
    readonly active: SpacingActiveTarget;
  };
  /** Alignment lines and equal spacing the dragged box snapped to. */
  readonly snapGuides?: readonly SnapGuide[];
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
        context ? parent?.sourceId === context : parent?.parentId === PAGE_GRID
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
      gesture.request = resolveResizeRequest({
        handle: gesture.handle,
        startBounds: gesture.startBox,
        dx,
        dy,
        lock: gesture.lock,
        position: gesture.position ?? null,
      });
      this.showReflow(gesture);
      return true;
    }
    if (options.axisLock) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    gesture.dx = dx;
    gesture.dy = dy;
    // An absolutely placed element snaps (a flow drag reorders; the old Canvas never snapped it).
    if (gesture.absolute) this.snap(gesture, zoom, !!options.snap);
    gesture.drop = gesture.absolute
      ? this.absoluteReparent(x, y, gesture)
      : this.dropTarget(x, y, gesture);
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
    if (!gesture.drop) return { ghost, ghosts, snapGuides: gesture.snapGuides };
    return {
      ghost,
      ghosts,
      ...(gesture.drop.keepsAbsolute ? {} : { line: gesture.drop.line }),
      container: this.host.bounds(gesture.drop.container),
    };
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
    this.host.reflow(this.reflowed, {
      sizing: {
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
      const size = setFields({
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
    const drop = gesture.drop;
    if (!drop) return undefined;
    if (gesture.copy) {
      const ids = gesture.ids;
      const newId = this.host.newId;
      return (reader) =>
        pasteNodes({
          clipboard: copyNodes(reader, ids),
          parent: { kind: "node", id: drop.parent },
          index: drop.index,
          newId,
          label: "Duplicate",
        })(reader);
    }
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
      if (drop) {
        const ids = gesture.ids;
        return (reader) =>
          pasteNodes({
            clipboard: copyNodes(reader, ids),
            parent: { kind: "node", id: drop.parent },
            index: drop.index,
            newId,
            label: "Duplicate",
          })(reader);
      }
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
    if (drop && leaving.size)
      commands.push(
        moveNodes({
          ids: gesture.ids.filter((_, index) =>
            leaving.has(gesture.records[index]!),
          ),
          parent: { kind: "node", id: drop.parent },
          index: drop.index,
          newId,
        }),
      );
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
      const parent = record ? records.get(record.parentId) : undefined;
      if (!record || !parent || !isNodeSource(parent.sourceId)) continue;
      const index = parent.children.indexOf(record.id) + 1;
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
          parent: { kind: "node", id: parent.sourceId as NodeId },
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
      if (within(record.id) || !isNodeSource(record.sourceId)) continue;
      if (!this.structural(record)) continue;
      // Past a refused container the nodes go to the end of the accepting ancestor (the old
      // Canvas's nearest droppable ancestor).
      const index = refused
        ? this.flowChildren(record, excluded).length
        : this.insertionIndex(record, excluded, x, y);
      try {
        // The command's own checks (nesting, not into itself) decide whether the drop is allowed.
        moveNodes({
          ids: gesture.ids,
          parent: { kind: "node", id: record.sourceId as NodeId },
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
        parent: record.sourceId as NodeId,
        index,
        line: this.insertionLine(record, excluded, index),
        ...(refused ? { relocated: refused } : {}),
      };
    }
    gesture.refusal = refused;
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
