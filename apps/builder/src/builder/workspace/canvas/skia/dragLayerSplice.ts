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
import { getSubtreeElementIds } from "./subtreeCommandPatch";

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
  readonly parentId: string;
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

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/** Every map entry of `ids` leaves the stream (and its hit area the spatial index). */
function dropEntries(
  stream: RenderCommandStream,
  ids: ReadonlySet<string>,
): void {
  for (const id of ids) {
    if (WASM_FLAGS.SPATIAL_INDEX && stream.hitBoundsMap.has(id))
      spatialIndex.removeElement(id);
    stream.selfSpans.delete(id);
    stream.subtreeSpans.delete(id);
    stream.childrenSpans.delete(id);
    stream.damageUnsafeElementIds.delete(id);
    stream.clipContextByElement.delete(id);
    stream.zOrderKeyByElement.delete(id);
    stream.scrollContextKeyByElement.delete(id);
    stream.subtreeBuildContextByElement.delete(id);
    stream.topLayerElementIds.delete(id);
    stream.childElementIds.delete(id);
    stream.boundsMap.delete(id);
    stream.hitBoundsMap.delete(id);
  }
}

/** The recording's entries, its commands now starting at `at` in the stream. */
function takeEntries(
  stream: RenderCommandStream,
  recording: Recording,
  at: number,
): void {
  const { replacement, ids } = recording;
  const offset = at - replacement.subtreeSpans.get(recording.id)!.start;
  const shift = (span: { start: number; end: number } | undefined) =>
    span && { start: span.start + offset, end: span.end + offset };
  for (const id of ids) {
    const self = shift(replacement.selfSpans.get(id));
    if (self) stream.selfSpans.set(id, self);
    const subtree = shift(replacement.subtreeSpans.get(id));
    if (subtree) stream.subtreeSpans.set(id, subtree);
    const children = shift(replacement.childrenSpans.get(id));
    if (children) stream.childrenSpans.set(id, children);
    if (replacement.damageUnsafeElementIds.has(id))
      stream.damageUnsafeElementIds.add(id);
    if (replacement.clipContextByElement.has(id))
      stream.clipContextByElement.set(
        id,
        replacement.clipContextByElement.get(id)!,
      );
    const z = replacement.zOrderKeyByElement.get(id);
    if (z !== undefined) stream.zOrderKeyByElement.set(id, z);
    const scroll = replacement.scrollContextKeyByElement.get(id);
    if (scroll !== undefined) stream.scrollContextKeyByElement.set(id, scroll);
    const context = replacement.subtreeBuildContextByElement.get(id);
    if (context) stream.subtreeBuildContextByElement.set(id, context);
    if (replacement.topLayerElementIds.has(id))
      stream.topLayerElementIds.add(id);
    const kids = replacement.childElementIds.get(id);
    if (kids) stream.childElementIds.set(id, kids);
    const bounds = replacement.boundsMap.get(id);
    if (bounds) stream.boundsMap.set(id, { ...bounds });
    const hit = replacement.hitBoundsMap.get(id);
    if (hit) {
      stream.hitBoundsMap.set(id, { ...hit });
      if (WASM_FLAGS.SPATIAL_INDEX)
        spatialIndex.updateElement(id, hit.x, hit.y, hit.width, hit.height);
    }
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
  const planned: Array<{
    root: DraggedRoot;
    cut: { start: number; end: number };
    current: ReadonlySet<string>;
    recording: Recording;
  }> = [];
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
    const current = getSubtreeElementIds(stream, span);
    const recording = record(
      stream,
      scene,
      id,
      topLayerSubtreeContext(
        id,
        context.parentAbsX,
        context.parentAbsY,
        parentId,
      ),
    );
    if (!sameIds(current, recording.ids)) return refuse("displaced-subtree");
    planned.push({
      root: { id, context, parentId, anchor },
      cut: span,
      current,
      recording,
    });
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
  for (const [parentId, list] of parentLists)
    setParentList(
      stream,
      parentId,
      list.filter((child) => !planned.some(({ root }) => root.id === child)),
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
  const tails: Array<{
    root: DraggedRoot;
    cut: { start: number; end: number };
    current: ReadonlySet<string>;
    recording: Recording;
  }> = [];
  for (const root of state.roots) {
    const span = stream.subtreeSpans.get(root.id);
    if (!span || !stream.topLayerElementIds.has(root.id))
      return refuse("stale-stream");
    const current = getSubtreeElementIds(stream, span);
    const recording = record(stream, scene, root.id, root.context);
    if (!sameIds(current, recording.ids)) return refuse("displaced-subtree");
    tails.push({ root, cut: span, current, recording });
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
    const anchor = root.anchor;
    const position =
      anchor.kind === "before"
        ? stream.subtreeSpans.get(anchor.id)?.start
        : (() => {
            const children = stream.childrenSpans.get(anchor.parentId);
            return children ? children.end - 1 : undefined;
          })();
    // (Checked before the writes would be better; the anchors are the parents' unchanged lists,
    // so a missing one means the stream changed under the epoch — rebuild.)
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
