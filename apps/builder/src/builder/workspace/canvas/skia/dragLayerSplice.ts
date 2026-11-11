/**
 * The drag layer as a splice (CANVAS_PERF_SCALING_2026-11 B3): a drag moves the dragged subtrees to
 * the stream's top layer (drawn last, unclipped — `deferredDragRoots`) and back when it ends. A full
 * build did it by recording every page again (record count × 2 visits per drag). Here only the
 * dragged subtrees are recorded: on enter each is cut from its place and recorded again on the top
 * layer at the stream's end; on exit the tail is cut and each is recorded again in its place.
 *
 * The result is the stream a full build gives (`dragLayerSplice.test.ts` compares them). Whatever
 * this cannot place exactly is refused before anything is written, and the caller builds the full
 * stream: a dragged root with a fixed or overlay descendant (drawn at the page's level, so the top
 * layer records more than the cut span), a page root, a root missing from its parent's drawn list,
 * and on exit any other write to the stream since enter (`getPatchedStreamEpoch`).
 */
import { WASM_FLAGS } from "../wasm-bindings/featureFlags";
import * as spatialIndex from "../wasm-bindings/spatialIndex";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import {
  buildSubtreeCommandStream,
  createCommandReader,
  getPatchedStreamEpoch,
  publishPatchedCommandStreamSnapshot,
  replaceCommandRange,
  topLayerSubtreeContext,
  type RenderCommand,
  type RenderCommandStream,
  type SubtreeBuildContext,
} from "./renderCommands";
import {
  adoptSubtreeEntries,
  dropSubtreeEntries,
  getSubtreeElementIds,
  hasSameIds,
} from "./subtreeCommandPatch";

const CMD_ELEMENT_BEGIN = 0;
const CMD_CHILDREN_END = 3;

export type DragLayerRefusal =
  | "no-roots"
  | "page-root"
  | "missing-context"
  | "top-layer"
  | "parent-list"
  | "displaced-subtree"
  | "anchor"
  | "stale-stream"
  | "stream-written";

/** Where a dragged root's commands sat: before a sibling's subtree, or at its parent's end. */
type Anchor =
  | { readonly kind: "before"; readonly id: string }
  | { readonly kind: "children-end"; readonly parentId: string };

interface DraggedRoot {
  readonly id: string;
  /** The context it is recorded with in its place. */
  readonly context: SubtreeBuildContext;
  readonly anchor: Anchor;
}

export interface DragLayerState {
  readonly stream: RenderCommandStream;
  /** In stream order (the order a full build appends them). */
  readonly roots: readonly DraggedRoot[];
  /** The parents' drawn lists before the drag. */
  readonly parentLists: ReadonlyMap<string, readonly string[]>;
  readonly epoch: number;
}

export type DragLayerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: DragLayerRefusal };

interface Recording {
  readonly id: string;
  readonly replacement: RenderCommandStream;
  readonly commands: RenderCommand[];
  readonly ids: ReadonlySet<string>;
}

/** A root's move, checked: the span it is cut from and its new recording (same element ids). */
interface Planned {
  readonly root: DraggedRoot;
  readonly cut: { readonly start: number; readonly end: number };
  readonly current: ReadonlySet<string>;
  readonly recording: Recording;
}

interface Scene {
  readonly childrenMap: Map<string, CanvasSceneNode[]>;
  readonly layoutMap: ReadonlyMap<string, ComputedLayout>;
}

const refuse = <T>(reason: DragLayerRefusal): DragLayerResult<T> => ({
  ok: false,
  reason,
});

function record(
  stream: RenderCommandStream,
  scene: Scene,
  id: string,
  context: SubtreeBuildContext,
): Recording {
  const replacement = buildSubtreeCommandStream({
    rootId: id,
    childrenMap: scene.childrenMap,
    layoutMap: scene.layoutMap,
    context,
    revision: {
      presentationRevision: stream.presentationRevision,
      baseCanonicalRevision: stream.baseCanonicalRevision,
    },
  });
  const span = replacement.subtreeSpans.get(id);
  const commands: RenderCommand[] = [];
  const ids = span
    ? getSubtreeElementIds(replacement, span)
    : new Set<string>();
  if (span) {
    const at = createCommandReader(replacement.commands);
    for (let index = span.start; index < span.end; index += 1)
      commands.push(at(index)!);
  }
  return { id, replacement, commands, ids };
}

/** `root` recorded with `context`, or undefined when the recording draws other elements. */
function plan(
  stream: RenderCommandStream,
  scene: Scene,
  root: DraggedRoot,
  cut: { start: number; end: number },
  context: SubtreeBuildContext,
): Planned | undefined {
  const current = getSubtreeElementIds(stream, cut);
  const recording = record(stream, scene, root.id, context);
  return hasSameIds(current, recording.ids)
    ? { root, cut, current, recording }
    : undefined;
}

/** Every map entry of `ids` leaves the stream (and its hit area the spatial index). */
function dropEntries(
  stream: RenderCommandStream,
  ids: ReadonlySet<string>,
): void {
  if (WASM_FLAGS.SPATIAL_INDEX)
    for (const id of ids)
      if (stream.hitBoundsMap.has(id)) spatialIndex.removeElement(id);
  dropSubtreeEntries(stream, ids);
}

/** The recording's entries, its commands now starting at `at` in the stream. */
function takeEntries(
  stream: RenderCommandStream,
  recording: Recording,
  at: number,
): void {
  const { replacement, ids } = recording;
  adoptSubtreeEntries(
    stream,
    replacement,
    ids,
    at - replacement.subtreeSpans.get(recording.id)!.start,
  );
  if (!WASM_FLAGS.SPATIAL_INDEX) return;
  for (const id of ids) {
    const hit = replacement.hitBoundsMap.get(id);
    if (hit) spatialIndex.updateElement(id, hit.x, hit.y, hit.width, hit.height);
  }
}

function setParentList(
  stream: RenderCommandStream,
  parentId: string,
  list: readonly string[],
): void {
  // (A full build records no entry for a parent that drew no child.)
  if (list.length) stream.childElementIds.set(parentId, list);
  else stream.childElementIds.delete(parentId);
}

/** Where a root anchored at `anchor` is inserted. */
function anchorAt(
  stream: RenderCommandStream,
  anchor: Anchor,
): number | undefined {
  if (anchor.kind === "before") return stream.subtreeSpans.get(anchor.id)?.start;
  const end = stream.childrenSpans.get(anchor.parentId)?.end;
  return end === undefined ? undefined : end - 1;
}

function finish(stream: RenderCommandStream): void {
  stream.presentationRevision += 1;
  publishPatchedCommandStreamSnapshot(stream);
}

/** Move the drag roots `ids` to the top layer. Nothing is written when refused. */
export function enterDragLayer(
  stream: RenderCommandStream,
  scene: Scene,
  ids: ReadonlySet<string>,
): DragLayerResult<DragLayerState> {
  // The roots a full build defers: drawn, and not inside another dragged root.
  const drawn = [...ids]
    .map((id) => ({ id, span: stream.subtreeSpans.get(id) }))
    .filter(
      (item): item is { id: string; span: { start: number; end: number } } =>
        !!item.span,
    );
  const roots = drawn
    .filter(
      ({ id, span }) =>
        !drawn.some(
          (other) =>
            other.id !== id &&
            other.span.start <= span.start &&
            span.end <= other.span.end,
        ),
    )
    .sort((a, b) => a.span.start - b.span.start);
  if (!roots.length) return refuse("no-roots");

  const at = createCommandReader(stream.commands);
  const planned: Planned[] = [];
  const parentLists = new Map<string, readonly string[]>();
  for (const { id, span } of roots) {
    const context = stream.subtreeBuildContextByElement.get(id);
    if (!context) return refuse("missing-context");
    if (context.topLayerSubtree) return refuse("top-layer");
    const parentId = context.parentElementId;
    if (parentId === null) return refuse("page-root");
    const list = stream.childElementIds.get(parentId);
    if (!list?.includes(id)) return refuse("parent-list");
    if (!parentLists.has(parentId)) parentLists.set(parentId, [...list]);
    const next = at(span.end);
    let anchor: Anchor;
    if (next?.type === CMD_ELEMENT_BEGIN && "elementId" in next)
      anchor = { kind: "before", id: next.elementId };
    else if (
      next?.type === CMD_CHILDREN_END &&
      stream.childrenSpans.get(parentId)?.end === span.end + 1
    )
      anchor = { kind: "children-end", parentId };
    else return refuse("anchor");
    const move = plan(
      stream,
      scene,
      { id, context, anchor },
      span,
      topLayerSubtreeContext(
        id,
        context.parentAbsX,
        context.parentAbsY,
        parentId,
      ),
    );
    if (!move) return refuse("displaced-subtree");
    planned.push(move);
  }

  // Writes: cut (last first — earlier cursors stay), then append in stream order.
  for (const { cut } of [...planned].reverse())
    replaceCommandRange(stream.commands, cut.start, cut.end, []);
  const starts: number[] = [];
  for (const { recording } of planned) {
    starts.push(stream.commands.length);
    replaceCommandRange(
      stream.commands,
      stream.commands.length,
      stream.commands.length,
      recording.commands,
    );
  }
  planned.forEach(({ current, recording }, index) => {
    dropEntries(stream, current);
    takeEntries(stream, recording, starts[index]!);
  });
  const dragged = new Set(planned.map(({ root }) => root.id));
  for (const [parentId, list] of parentLists)
    setParentList(
      stream,
      parentId,
      list.filter((child) => !dragged.has(child)),
    );
  finish(stream);
  return {
    ok: true,
    value: {
      stream,
      roots: planned.map(({ root }) => root),
      parentLists,
      epoch: getPatchedStreamEpoch(),
    },
  };
}

/** Put the dragged roots back in their places. Nothing is written when refused. */
export function exitDragLayer(
  stream: RenderCommandStream,
  scene: Scene,
  state: DragLayerState,
): DragLayerResult<void> {
  if (state.stream !== stream) return refuse("stale-stream");
  if (state.epoch !== getPatchedStreamEpoch()) return refuse("stream-written");
  const tails: Planned[] = [];
  for (const root of state.roots) {
    const span = stream.subtreeSpans.get(root.id);
    if (!span || !stream.topLayerElementIds.has(root.id))
      return refuse("stale-stream");
    const move = plan(stream, scene, root, span, root.context);
    if (!move) return refuse("displaced-subtree");
    tails.push(move);
  }
  const dragged = new Set(state.roots.map((root) => root.id));
  for (const [parentId, list] of state.parentLists) {
    const now = stream.childElementIds.get(parentId) ?? [];
    const expected = list.filter((child) => !dragged.has(child));
    if (
      now.length !== expected.length ||
      now.some((child, index) => child !== expected[index])
    )
      return refuse("stream-written");
  }

  for (const { root } of tails) {
    const anchor = root.anchor;
    if (
      anchor.kind === "before"
        ? !dragged.has(anchor.id) &&
          (!stream.subtreeSpans.has(anchor.id) ||
            stream.topLayerElementIds.has(anchor.id))
        : !stream.childrenSpans.has(anchor.parentId)
    )
      return refuse("anchor");
  }

  // Writes: cut the tail (last first), then insert each root in its place, last first — a root
  // anchored before another dragged root finds that one already back.
  for (const { cut } of [...tails].sort((a, b) => b.cut.start - a.cut.start))
    replaceCommandRange(stream.commands, cut.start, cut.end, []);
  for (const { current } of tails) dropEntries(stream, current);
  for (const { root, recording } of [...tails].reverse()) {
    const position = anchorAt(stream, root.anchor);
    // The anchors were checked above against the parents' unchanged lists — a missing one now
    // means the stream changed under the epoch.
    if (position === undefined) throw new Error("CATALOG_DRAG_LAYER_ANCHOR");
    replaceCommandRange(
      stream.commands,
      position,
      position,
      recording.commands,
    );
    takeEntries(stream, recording, position);
  }
  for (const [parentId, list] of state.parentLists)
    setParentList(stream, parentId, list);
  finish(stream);
  return { ok: true, value: undefined };
}
