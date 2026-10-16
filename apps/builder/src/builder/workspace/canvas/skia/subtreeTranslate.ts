import type { BoundingBox } from "../selection/types";
import { WASM_FLAGS } from "../wasm-bindings/featureFlags";
import * as spatialIndex from "../wasm-bindings/spatialIndex";
import { getDragVisualOffset, hasDragSiblingOffsets } from "./nodeRendererTree";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  buildSelfCommandStream,
  childClipRectOf,
  createCommandReader,
  hasTextPaintOverflow,
  hitBoundsOf,
  publishPatchedCommandStreamSnapshot,
  writeCommandAt,
  type ClipRect,
  type RenderCommand,
  type RenderCommandStream,
  type SubtreeBuildContext,
} from "./renderCommands";
import { renderCounters } from "./renderCounters";

const CMD_ELEMENT_BEGIN = 0;
const CMD_CHILDREN_BEGIN = 2;
const CMD_CHILDREN_END = 3;
const CMD_ELEMENT_END = 4;

export type SubtreeTranslateRejectReason =
  | "subtree-context"
  | "missing-span"
  | "invalid-span"
  | "top-layer"
  | "fixed-or-sticky"
  | "drag-offset";

export interface TranslateSubtreeInput {
  readonly stream: RenderCommandStream;
  readonly rootId: string;
  /** The root's new parent-relative position (its layout rect x · y). */
  readonly x: number;
  readonly y: number;
  /**
   * The context the root's parent hands down: the stored one when the parent is unchanged (the
   * root's own context is the parent's — review r1 H1), the parent's new one after the parent
   * was recorded again (moved, resized or clipping differently — Phase 0 extension).
   */
  readonly context: SubtreeBuildContext;
  /** Publish the bounds snapshot (default) — a batch of moves publishes once at the end. */
  readonly publish?: boolean;
}

export interface TranslateSubtreeResult {
  readonly applied: boolean;
  readonly reason?: SubtreeTranslateRejectReason;
  /** Old ∪ new hit bounds of every element in the subtree (review r1 H2); none = nothing hit. */
  readonly damageBounds?: BoundingBox;
  /** A subtree element paints outside its hit bounds (before or after): draw in full. */
  readonly unsafePaint?: boolean;
  readonly nodes?: number;
  readonly indexUpserts?: number;
}

const union = (
  a: BoundingBox | undefined,
  b: BoundingBox | null | undefined,
) =>
  !b
    ? a
    : !a
      ? { ...b }
      : {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
          height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y),
        };

const cloneClip = (clip: ClipRect): ClipRect => (clip ? { ...clip } : null);

/**
 * ADR-264 — place an already recorded subtree somewhere else without recording it again.
 *
 * Commands are parent-relative (ADR-189), so only the root's `ELEMENT_BEGIN` x · y changes; the
 * descendants' commands stay byte for byte. The absolute maps move by the root's absolute Δ, and
 * clip · hit bounds are not moved but intersected again from the root's context down — the same
 * `childClipRectOf` · `hitBoundsOf` the full build uses (a clip the subtree crosses changes its
 * hit area non-linearly — review r1 M3). Node pictures stay (their key is node data + size).
 * Shapes this cannot place (top layer · fixed / sticky · a drag offset) are rejected before any
 * write; the caller records them again instead.
 */
type TranslateCheck =
  | { readonly reason: SubtreeTranslateRejectReason }
  | {
      readonly reason?: undefined;
      readonly span: { start: number; end: number };
      readonly first: Extract<RenderCommand, { type: 0 }>;
      readonly unsafePaint: boolean;
    };

/** Whether `translateSubtree` can place the subtree — checked before anything is written. */
function checkTranslate(
  stream: RenderCommandStream,
  rootId: string,
  context: SubtreeBuildContext,
): TranslateCheck {
  const oldContext = stream.subtreeBuildContextByElement.get(rootId);
  if (!oldContext) return { reason: "subtree-context" };
  if (context.topLayerSubtree || oldContext.topLayerSubtree)
    return { reason: "top-layer" };
  if (getDragVisualOffset() || hasDragSiblingOffsets())
    return { reason: "drag-offset" };
  const span = stream.subtreeSpans.get(rootId);
  if (!span) return { reason: "missing-span" };
  const at = createCommandReader(stream.commands);
  const first = at(span.start);
  if (
    !first ||
    first.type !== CMD_ELEMENT_BEGIN ||
    first.elementId !== rootId ||
    at(span.end - 1)?.type !== CMD_ELEMENT_END
  )
    return { reason: "invalid-span" };
  let unsafePaint = false;
  if (process.env.NODE_ENV === "development")
    renderCounters.translateCheckCommands += span.end - span.start;
  for (let index = span.start; index < span.end; index += 1) {
    const command = at(index)!;
    if (command.type !== CMD_ELEMENT_BEGIN) continue;
    const id = command.elementId;
    // ADR-266: a node's internal child draw (`emitInternalChildDraw` — a button label, a rule
    // shape) is wrapped with an empty id. It is not an element: its commands are local to the
    // owner and hold no bounds, so placing the owner places it.
    if (!id) continue;
    if (stream.topLayerElementIds.has(id)) return { reason: "top-layer" };
    const scrollKey = stream.scrollContextKeyByElement.get(id) ?? "";
    if (
      command.isFixed ||
      scrollKey.includes("|self:fixed") ||
      scrollKey.includes("|self:sticky")
    )
      return { reason: "fixed-or-sticky" };
    if (!stream.boundsMap.has(id)) return { reason: "invalid-span" };
    if (stream.damageUnsafeElementIds.has(id) || hasTextPaintOverflow(id))
      unsafePaint = true;
  }
  return { span, first, unsafePaint };
}

/** A checked placement — `applySubtreeTranslate` writes it without scanning the subtree again. */
export type SubtreeTranslatePlan = Exclude<
  TranslateCheck,
  { reason: SubtreeTranslateRejectReason }
>;

/**
 * ADR-266 Phase 4: check once, then apply — a caller placing many roots (`movePageRoots`) checks
 * them all before writing any and hands each check to `applySubtreeTranslate` (it scanned every
 * root twice: once to decide, once inside `translateSubtree`).
 */
export function planSubtreeTranslate(
  stream: RenderCommandStream,
  rootId: string,
  context: SubtreeBuildContext,
): TranslateCheck {
  return checkTranslate(stream, rootId, context);
}

export function applySubtreeTranslate(
  input: TranslateSubtreeInput,
  plan: SubtreeTranslatePlan,
): TranslateSubtreeResult {
  return applyTranslate(input, plan);
}

export function translateSubtree(
  input: TranslateSubtreeInput,
): TranslateSubtreeResult {
  const { stream, rootId, context } = input;
  const check = checkTranslate(stream, rootId, context);
  if (check.reason) return { applied: false, reason: check.reason };
  return applyTranslate(input, check);
}

function applyTranslate(
  input: TranslateSubtreeInput,
  check: Exclude<TranslateCheck, { reason: SubtreeTranslateRejectReason }>,
): TranslateSubtreeResult {
  const { stream, rootId, context } = input;
  const { first, unsafePaint } = check;
  // Read the span now: a splice earlier in the same region may have shifted it since the check.
  const span = stream.subtreeSpans.get(rootId) ?? check.span;
  const at = createCommandReader(stream.commands);
  const oldRoot = stream.boundsMap.get(rootId)!;
  const dx = context.parentAbsX + input.x - oldRoot.x;
  const dy = context.parentAbsY + input.y - oldRoot.y;
  writeCommandAt(stream.commands, span.start, {
    ...first,
    x: input.x + context.cmdOffsetX,
    y: input.y + context.cmdOffsetY,
  });
  stream.subtreeBuildContextByElement.set(rootId, {
    ...context,
    clipRect: cloneClip(context.clipRect),
  });

  let damage: BoundingBox | undefined;
  let nodes = 0;
  let indexUpserts = 0;
  const elements: string[] = [];
  const clips: ClipRect[] = [context.clipRect];
  for (let index = span.start; index < span.end; index += 1) {
    const command = at(index)!;
    if (command.type === CMD_ELEMENT_BEGIN) {
      const id = command.elementId;
      // An internal child draw (empty id): owner-local, no maps to move. Its END pops this mark.
      if (!id) {
        elements.push(id);
        continue;
      }
      const clip = clips[clips.length - 1]!;
      const old = stream.boundsMap.get(id)!;
      const bounds = { ...old, x: old.x + dx, y: old.y + dy };
      const oldHit = stream.hitBoundsMap.get(id);
      const hit = hitBoundsOf(bounds, clip);
      damage = union(union(damage, oldHit), hit);
      stream.boundsMap.set(id, bounds);
      stream.clipContextByElement.set(id, cloneClip(clip));
      if (id !== rootId) {
        const stored = stream.subtreeBuildContextByElement.get(id);
        if (stored)
          stream.subtreeBuildContextByElement.set(id, {
            ...stored,
            parentAbsX: stored.parentAbsX + dx,
            parentAbsY: stored.parentAbsY + dy,
            clipRect: cloneClip(clip),
          });
      }
      if (hit) stream.hitBoundsMap.set(id, { ...hit });
      else stream.hitBoundsMap.delete(id);
      if (WASM_FLAGS.SPATIAL_INDEX) {
        // The full build's snapshot (`syncSpatialIndex`) indexes only boxes with area.
        if (hit && hit.width > 0 && hit.height > 0) {
          spatialIndex.updateElement(id, hit.x, hit.y, hit.width, hit.height);
          indexUpserts += 1;
        } else if (oldHit) spatialIndex.removeElement(id);
      }
      elements.push(id);
      nodes += 1;
    } else if (command.type === CMD_CHILDREN_BEGIN) {
      const owner = stream.boundsMap.get(elements[elements.length - 1]!)!;
      clips.push(
        childClipRectOf(owner.x, owner.y, command, clips[clips.length - 1]!),
      );
    } else if (command.type === CMD_CHILDREN_END) clips.pop();
    else if (command.type === CMD_ELEMENT_END) elements.pop();
  }
  if (input.publish !== false) publishPatchedCommandStreamSnapshot(stream);
  if (process.env.NODE_ENV === "development") {
    renderCounters.translateCalls += 1;
    renderCounters.translateNodes += nodes;
    renderCounters.translateIndexUpserts += indexUpserts;
  }
  return {
    applied: true,
    ...(damage ? { damageBounds: damage } : {}),
    unsafePaint,
    nodes,
    indexUpserts,
  };
}

const sameClip = (a: ClipRect, b: ClipRect) =>
  a === b ||
  (!!a &&
    !!b &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height);

/** Two build contexts give the same commands and maps to a subtree recorded under them. */
export function sameBuildContext(
  a: SubtreeBuildContext,
  b: SubtreeBuildContext,
): boolean {
  return (
    a.parentAbsX === b.parentAbsX &&
    a.parentAbsY === b.parentAbsY &&
    a.cmdOffsetX === b.cmdOffsetX &&
    a.cmdOffsetY === b.cmdOffsetY &&
    a.parentElementId === b.parentElementId &&
    a.zOrderKey === b.zOrderKey &&
    a.scrollContextKey === b.scrollContextKey &&
    a.topLayerSubtree === b.topLayerSubtree &&
    sameClip(a.clipRect, b.clipRect)
  );
}

export interface SubtreePatchOutcome {
  readonly applied: boolean;
  readonly reason?: string;
  readonly damageBounds?: BoundingBox;
  readonly unsafePaint?: boolean;
}

export interface PlaceRegionInput {
  readonly stream: RenderCommandStream;
  readonly rootId: string;
  readonly childrenMap: Map<string, CanvasSceneNode[]>;
  readonly layoutMap: ReadonlyMap<string, ComputedLayout>;
  readonly revision: {
    presentationRevision: number;
    baseCanonicalRevision: number;
  };
  /** Its record or child list changed: recorded again as a subtree. */
  readonly isSeed: (id: string) => boolean;
  /** It or a descendant has a changed rect or record. */
  readonly onPath: (id: string) => boolean;
  /** Its rect changed in x · y only (size · engine input same, no descendant changed). */
  readonly movedOnly: (id: string) => boolean;
  /** Record `id`'s subtree again under its stored context (the commit-lane splice). */
  readonly patchSubtree: (id: string) => SubtreePatchOutcome;
}

export interface PlaceRegionResult {
  readonly applied: boolean;
  readonly reason?: string;
  readonly damageBounds?: BoundingBox;
  readonly unsafePaint: boolean;
  /** Subtrees recorded again (`patchSubtree`). */
  readonly patched: readonly string[];
  readonly selfPatches: number;
  readonly selfWrites: number;
  readonly translated: readonly string[];
}

type Plan =
  | { readonly kind: "none" }
  | { readonly kind: "patch"; readonly id: string }
  | {
      readonly kind: "translate";
      readonly id: string;
      readonly input: TranslateSubtreeInput;
      readonly check: Exclude<
        TranslateCheck,
        { reason: SubtreeTranslateRejectReason }
      >;
    }
  | {
      readonly kind: "self";
      readonly id: string;
      readonly context: SubtreeBuildContext;
      readonly built: RenderCommandStream;
      readonly prefix: readonly [number, number, number];
      readonly suffix: readonly [number, number, number];
      readonly children: readonly Plan[];
    };

/**
 * ADR-264 Phase 2 — bring a patch region up to date without recording what only moved.
 *
 * From the region root down: a changed record (seed) is recorded again as a subtree; an ancestor
 * whose box changed (path node) records only its own commands — in place, when their count is
 * unchanged — and hands its children their new context; a subtree that only moved, or whose
 * context changed (its parent moved or clips differently), is placed by `translateSubtree`; an
 * untouched subtree under an unchanged context stays. The whole plan is made before any write; a
 * node that cannot be planned falls back to a subtree patch at the nearest node whose context is
 * unchanged — at worst the region root, which is today's splice.
 */
export function placeRegion(input: PlaceRegionInput): PlaceRegionResult {
  const { stream } = input;
  const stored = (id: string) => stream.subtreeBuildContextByElement.get(id);
  const plan = (id: string, context: SubtreeBuildContext): Plan | null => {
    const own = stored(id);
    const same = !!own && sameBuildContext(own, context);
    const patch: Plan | null = same ? { kind: "patch", id } : null;
    /** Planning gave up here: count why (dev) and record this subtree again if we can. */
    const fallback = (reason: keyof typeof renderCounters): Plan | null => {
      if (process.env.NODE_ENV === "development") renderCounters[reason] += 1;
      return patch;
    };
    if (input.isSeed(id))
      return same ? patch : fallback("placeFallbackSeedContext");
    const layout = input.layoutMap.get(id);
    const translate = (): Plan | null => {
      if (!layout) return patch;
      const move: TranslateSubtreeInput = {
        stream,
        rootId: id,
        x: layout.x,
        y: layout.y,
        context,
        publish: false,
      };
      const check = checkTranslate(stream, id, context);
      return check.reason
        ? fallback("placeFallbackTranslate")
        : { kind: "translate", id, input: move, check };
    };
    if (!input.onPath(id)) return same ? { kind: "none" } : translate();
    if (input.movedOnly(id)) return translate();
    // A path node: its own commands, then its children under the contexts it hands down.
    if (context.topLayerSubtree || !own || own.topLayerSubtree)
      return fallback("placeFallbackShape");
    const span = stream.subtreeSpans.get(id);
    if (!span) return fallback("placeFallbackShape");
    const { stream: built, childContexts } = buildSelfCommandStream({
      rootId: id,
      childrenMap: input.childrenMap,
      layoutMap: input.layoutMap,
      context,
      revision: input.revision,
    });
    const builtSpan = built.subtreeSpans.get(id);
    if (!builtSpan || built.topLayerElementIds.has(id))
      return fallback("placeFallbackShape");
    const kids = stream.childrenSpans.get(id);
    const builtKids = built.childrenSpans.get(id);
    if (!!kids !== !!builtKids) return fallback("placeFallbackShape");
    // [old start, built start, length] of the commands before the children and after them.
    const prefix = [
      span.start,
      builtSpan.start,
      (kids ? kids.start + 1 : span.end - 1) - span.start,
    ] as const;
    const suffix = [
      kids ? kids.end - 1 : span.end - 1,
      builtKids ? builtKids.end - 1 : builtSpan.end - 1,
      kids ? span.end - kids.end + 1 : 1,
    ] as const;
    if (
      prefix[2] !==
        (builtKids ? builtKids.start + 1 : builtSpan.end - 1) -
          builtSpan.start ||
      suffix[2] !== (builtKids ? builtSpan.end - builtKids.end + 1 : 1)
    )
      return fallback("placeFallbackShape");
    const children: Plan[] = [];
    for (const child of input.childrenMap.get(id) ?? []) {
      const childContext = childContexts.get(child.id);
      const childPlan = childContext && plan(child.id, childContext);
      if (!childPlan) return fallback("placeFallbackChild");
      children.push(childPlan);
    }
    return { kind: "self", id, context, built, prefix, suffix, children };
  };

  const rootContext = stored(input.rootId);
  const top = rootContext ? plan(input.rootId, rootContext) : null;
  let damage: BoundingBox | undefined;
  let unsafePaint = false;
  let selfPatches = 0;
  let selfWrites = 0;
  const patched: string[] = [];
  const translated: string[] = [];
  let failure: string | undefined;
  const apply = (step: Plan) => {
    if (failure || step.kind === "none") return;
    if (step.kind === "patch") {
      const result = input.patchSubtree(step.id);
      if (!result.applied) {
        failure = result.reason ?? "patch-rejected";
        return;
      }
      patched.push(step.id);
      if (result.unsafePaint) unsafePaint = true;
      damage = union(damage, result.damageBounds);
      return;
    }
    if (step.kind === "translate") {
      const result = applyTranslate(step.input, step.check);
      translated.push(step.id);
      if (result.unsafePaint) unsafePaint = true;
      damage = union(damage, result.damageBounds);
      return;
    }
    applySelf(step);
    for (const child of step.children) apply(child);
  };
  const applySelf = (step: Extract<Plan, { kind: "self" }>) => {
    const { id, built } = step;
    const read = createCommandReader(built.commands);
    // Positions now (an earlier splice in the region may have shifted them), lengths as planned.
    const span = stream.subtreeSpans.get(id)!;
    const kids = stream.childrenSpans.get(id);
    const at = [span.start, kids ? kids.end - 1 : span.end - 1];
    [step.prefix, step.suffix].forEach(([, from, length], part) => {
      for (let i = 0; i < length; i += 1)
        writeCommandAt(stream.commands, at[part]! + i, read(from + i)!);
    });
    selfPatches += 1;
    selfWrites += step.prefix[2] + step.suffix[2];
    const oldHit = stream.hitBoundsMap.get(id);
    const hit = built.hitBoundsMap.get(id);
    if (
      stream.damageUnsafeElementIds.has(id) ||
      built.damageUnsafeElementIds.has(id) ||
      hasTextPaintOverflow(id)
    )
      unsafePaint = true;
    if (built.damageUnsafeElementIds.has(id))
      stream.damageUnsafeElementIds.add(id);
    else stream.damageUnsafeElementIds.delete(id);
    damage = union(union(damage, oldHit), hit);
    stream.boundsMap.set(id, { ...built.boundsMap.get(id)! });
    if (hit) stream.hitBoundsMap.set(id, { ...hit });
    else stream.hitBoundsMap.delete(id);
    stream.clipContextByElement.set(
      id,
      cloneClip(built.clipContextByElement.get(id) ?? null),
    );
    stream.subtreeBuildContextByElement.set(id, {
      ...step.context,
      clipRect: cloneClip(step.context.clipRect),
    });
    stream.zOrderKeyByElement.set(id, built.zOrderKeyByElement.get(id)!);
    stream.scrollContextKeyByElement.set(
      id,
      built.scrollContextKeyByElement.get(id)!,
    );
    if (WASM_FLAGS.SPATIAL_INDEX) {
      if (hit && hit.width > 0 && hit.height > 0)
        spatialIndex.updateElement(id, hit.x, hit.y, hit.width, hit.height);
      else if (oldHit) spatialIndex.removeElement(id);
    }
  };
  if (!top) {
    // No stored context for the region root: the caller rebinds (today's rule).
    return {
      applied: false,
      reason: "subtree-context",
      unsafePaint,
      patched,
      selfPatches,
      selfWrites,
      translated,
    };
  }
  apply(top);
  if (translated.length || selfPatches)
    publishPatchedCommandStreamSnapshot(stream);
  if (process.env.NODE_ENV === "development") {
    renderCounters.pathSelfPatches += selfPatches;
    renderCounters.pathSelfWrites += selfWrites;
  }
  return {
    applied: !failure,
    ...(failure ? { reason: failure } : {}),
    ...(damage ? { damageBounds: damage } : {}),
    unsafePaint,
    patched,
    selfPatches,
    selfWrites,
    translated,
  };
}
