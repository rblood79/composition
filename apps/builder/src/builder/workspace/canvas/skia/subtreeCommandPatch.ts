import type { PresentationTargetedLayoutPublication } from "../../../presentation/editorLayoutPublication";
import { renderCounters } from "./renderCounters";
import type { BoundingBox } from "../selection/types";
import { WASM_FLAGS } from "../wasm-bindings/featureFlags";
import * as spatialIndex from "../wasm-bindings/spatialIndex";
import {
  createCommandReader,
  hasTextPaintOverflow,
  publishPatchedCommandStreamSnapshot,
  recordCommitLanePatchFallback,
  recordCommitLanePatchWrites,
  replaceCommandRange,
  type ClipRect,
  type RenderCommand,
  type RenderCommandStream,
  type SelfSpan,
  type SubtreeSpan,
} from "./renderCommands";
import { invalidateNodePicture } from "./nodePictureCache";

const CMD_ELEMENT_BEGIN = 0;
const CMD_ELEMENT_END = 4;

export type SubtreePatchRejectReason =
  | "stale-revision"
  | "base-revision-mismatch"
  | "missing-span"
  | "invalid-span"
  | "command-count-changed"
  | "top-layer"
  | "clip-context-changed"
  | "scroll-context-changed"
  | "z-order-changed"
  | "node-set-changed"
  | "bounds-missing";

export type CommitSubtreePatchRejectReason =
  | "stale-revision"
  | "base-revision-mismatch"
  | "missing-span"
  | "invalid-span"
  | "top-layer"
  | "clip-context-changed"
  | "z-order-changed"
  | "bounds-missing"
  | "write-budget-exceeded";

export interface ApplySubtreeCommandPatchInput {
  readonly current: RenderCommandStream;
  readonly replacement: RenderCommandStream;
  readonly rootId: string;
  readonly publication: Pick<
    PresentationTargetedLayoutPublication,
    "presentationRevision" | "baseCanonicalRevision"
  > &
    Partial<Pick<PresentationTargetedLayoutPublication, "rootKey">>;
  readonly canonicalRevision: number;
}

export interface SubtreeCommandPatchResult {
  readonly applied: boolean;
  readonly reason?: SubtreePatchRejectReason;
  /** 이전/이후 hit bounds 합집합 — content damage clip의 최소 영역. */
  readonly damageBounds?: BoundingBox;
}

export interface ApplyCommitSubtreeCommandPatchInput {
  readonly current: RenderCommandStream;
  readonly replacement: RenderCommandStream;
  readonly rootId: string;
  readonly rootKey?: string;
  readonly revision: number;
  readonly canonicalRevision: number;
}

export interface CommitSubtreeCommandPatchResult {
  readonly applied: boolean;
  readonly reason?: CommitSubtreePatchRejectReason;
  /** 실제 splice가 기록한 replacement command 수(k). */
  readonly writeCount?: number;
  /** 이전/이후 hit bounds 합집합 — content damage clip의 최소 영역. */
  readonly damageBounds?: BoundingBox;
  /**
   * 교체 **전 또는 후** 의 서브트리에 hit bounds 밖 paint (`damageUnsafeElementIds`) 가 있었다
   * (ADR-263 H1). 교체 뒤에는 이전 표시가 지워져 사후 검사로는 이전 그림자 · outline 영역을 모른다
   * — 이 patch 의 damage 는 hit bounds 로 충분하지 않으니 full 로 그린다.
   */
  readonly unsafePaint?: boolean;
}

function isValidRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function sameClipRect(
  a: ClipRect | undefined,
  b: ClipRect | undefined,
): boolean {
  if (a === null || b === null) return a === b;
  if (!a || !b) return false;
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

function isValidSpan(
  stream: RenderCommandStream,
  rootId: string,
  span: SubtreeSpan | undefined,
): span is SubtreeSpan {
  if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end)) {
    return false;
  }
  if (
    span.start < 0 ||
    span.end <= span.start ||
    span.end > stream.commands.length
  ) {
    return false;
  }
  const commandAtIndex = createCommandReader(stream.commands);
  const begin = commandAtIndex(span.start);
  const end = commandAtIndex(span.end - 1);
  return (
    begin?.type === CMD_ELEMENT_BEGIN &&
    "elementId" in begin &&
    begin.elementId === rootId &&
    end?.type === CMD_ELEMENT_END
  );
}

function hasCompleteSubtreeSpanContext(
  stream: RenderCommandStream,
  span: SubtreeSpan,
): boolean {
  if (process.env.NODE_ENV === "development")
    renderCounters.patchScanCommands += span.end - span.start;
  const commandAtIndex = createCommandReader(stream.commands);
  for (let index = span.start; index < span.end; index += 1) {
    const command = commandAtIndex(index);
    if (command?.type !== CMD_ELEMENT_BEGIN || !("elementId" in command)) {
      continue;
    }
    if (
      command.elementId.length > 0 &&
      !stream.subtreeSpans.has(command.elementId)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * ADR-263 Phase 5 — span 을 한 번 읽어 element ID 를 모으면서 span context 완전성도 본다
 * (`hasCompleteSubtreeSpanContext` + `getSubtreeElementIds` 두 번 순회를 하나로). 완전하지 않으면 null.
 */
function collectCompleteSubtreeIds(
  stream: RenderCommandStream,
  span: SubtreeSpan,
): Set<string> | null {
  if (process.env.NODE_ENV === "development")
    renderCounters.patchScanCommands += span.end - span.start;
  const ids = new Set<string>();
  const commandAtIndex = createCommandReader(stream.commands);
  for (let index = span.start; index < span.end; index += 1) {
    const command = commandAtIndex(index);
    if (
      command?.type !== CMD_ELEMENT_BEGIN ||
      !("elementId" in command) ||
      command.elementId.length === 0
    )
      continue;
    if (!stream.subtreeSpans.has(command.elementId)) return null;
    ids.add(command.elementId);
  }
  return ids;
}

/** span 안에 포함된 element ID를 반환한다. subtree span은 DFS contiguous 계약을 전제로 한다. */
export function getSubtreeElementIds(
  stream: RenderCommandStream,
  span: SubtreeSpan,
): Set<string> {
  if (process.env.NODE_ENV === "development")
    renderCounters.patchScanCommands += span.end - span.start;
  const ids = new Set<string>();
  const commandAtIndex = createCommandReader(stream.commands);
  for (let index = span.start; index < span.end; index += 1) {
    const command = commandAtIndex(index);
    if (
      command?.type === CMD_ELEMENT_BEGIN &&
      "elementId" in command &&
      command.elementId.length > 0
    ) {
      ids.add(command.elementId);
    }
  }
  return ids;
}

export function hasSameIds(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function copySpanWithOffset(span: SelfSpan | SubtreeSpan, offset: number) {
  return { start: span.start + offset, end: span.end + offset };
}

/**
 * Every per-element map entry of `ids` leaves `stream` — the one list of a stream's element maps a
 * splice clears (a map added to the stream is added here and in `adoptSubtreeEntries`). The spatial
 * index is the caller's.
 */
export function dropSubtreeEntries(
  stream: RenderCommandStream,
  ids: Iterable<string>,
): void {
  for (const id of ids) {
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

/** `replacement`'s entries of `ids` move into `stream`, their command indices shifted by `offset`. */
export function adoptSubtreeEntries(
  stream: RenderCommandStream,
  replacement: RenderCommandStream,
  ids: Iterable<string>,
  offset: number,
): void {
  for (const id of ids) {
    const self = replacement.selfSpans.get(id);
    if (self) stream.selfSpans.set(id, copySpanWithOffset(self, offset));
    const subtree = replacement.subtreeSpans.get(id);
    if (subtree)
      stream.subtreeSpans.set(id, copySpanWithOffset(subtree, offset));
    const children = replacement.childrenSpans.get(id);
    if (children)
      stream.childrenSpans.set(id, copySpanWithOffset(children, offset));
    if (replacement.damageUnsafeElementIds.has(id))
      stream.damageUnsafeElementIds.add(id);
    const clip = replacement.clipContextByElement.get(id);
    if (clip !== undefined) stream.clipContextByElement.set(id, clip);
    const z = replacement.zOrderKeyByElement.get(id);
    if (z !== undefined) stream.zOrderKeyByElement.set(id, z);
    const scroll = replacement.scrollContextKeyByElement.get(id);
    if (scroll !== undefined) stream.scrollContextKeyByElement.set(id, scroll);
    const context = replacement.subtreeBuildContextByElement.get(id);
    if (context !== undefined)
      stream.subtreeBuildContextByElement.set(id, context);
    if (replacement.topLayerElementIds.has(id))
      stream.topLayerElementIds.add(id);
    const kids = replacement.childElementIds.get(id);
    if (kids) stream.childElementIds.set(id, kids);
    const bounds = replacement.boundsMap.get(id);
    if (bounds) stream.boundsMap.set(id, copyBounds(bounds));
    const hit = replacement.hitBoundsMap.get(id);
    if (hit) stream.hitBoundsMap.set(id, copyBounds(hit));
  }
}

function copyBounds(bounds: BoundingBox): BoundingBox {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function unionBounds(
  current: BoundingBox | undefined,
  next: BoundingBox | undefined,
): BoundingBox | undefined {
  if (!current) return next ? copyBounds(next) : undefined;
  if (!next) return copyBounds(current);
  const left = Math.min(current.x, next.x);
  const top = Math.min(current.y, next.y);
  const right = Math.max(current.x + current.width, next.x + next.width);
  const bottom = Math.max(current.y + current.height, next.y + next.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 이전/이후 subtree의 실제 hit 영역만 합쳐 damage를 산출한다. */
export function getSubtreeDamageBounds(
  current: Pick<RenderCommandStream, "hitBoundsMap">,
  replacement: Pick<RenderCommandStream, "hitBoundsMap">,
  currentIds: ReadonlySet<string>,
  replacementIds: ReadonlySet<string>,
): BoundingBox | undefined {
  let damage: BoundingBox | undefined;
  for (const elementId of currentIds) {
    damage = unionBounds(damage, current.hitBoundsMap.get(elementId));
  }
  for (const elementId of replacementIds) {
    damage = unionBounds(damage, replacement.hitBoundsMap.get(elementId));
  }
  return damage;
}

/**
 * 고정 길이 subtree command span을 현재 frame에 원자적으로 반영한다.
 *
 * 명령 배열의 tail이나 canonical 전체 맵을 재구성하지 않는다. 검증이 끝나기
 * 전에는 어느 map/배열/index도 변경하지 않으며, 검증 실패는 caller가 full
 * rebuild/retry를 선택할 수 있는 fail-closed 결과로 반환한다.
 */
export function applySubtreeCommandPatch(
  input: ApplySubtreeCommandPatchInput,
): SubtreeCommandPatchResult {
  const { current, replacement, rootId, publication, canonicalRevision } =
    input;

  const rootKey = publication.rootKey ?? "__default__";
  const currentRootRevision =
    current.presentationRevisionByRootKey.get(rootKey) ??
    current.presentationRevision;

  if (
    !isValidRevision(publication.presentationRevision) ||
    publication.presentationRevision <= currentRootRevision
  ) {
    return { applied: false, reason: "stale-revision" };
  }
  if (
    !isValidRevision(publication.baseCanonicalRevision) ||
    publication.baseCanonicalRevision !== canonicalRevision ||
    current.baseCanonicalRevision !== publication.baseCanonicalRevision ||
    replacement.baseCanonicalRevision !== publication.baseCanonicalRevision
  ) {
    return { applied: false, reason: "base-revision-mismatch" };
  }

  const currentSpan = current.subtreeSpans.get(rootId);
  const replacementSpan = replacement.subtreeSpans.get(rootId);
  if (!currentSpan || !replacementSpan) {
    return { applied: false, reason: "missing-span" };
  }
  if (
    !isValidSpan(current, rootId, currentSpan) ||
    !isValidSpan(replacement, rootId, replacementSpan)
  ) {
    return { applied: false, reason: "invalid-span" };
  }
  if (
    !hasCompleteSubtreeSpanContext(current, currentSpan) ||
    !hasCompleteSubtreeSpanContext(replacement, replacementSpan)
  ) {
    return { applied: false, reason: "invalid-span" };
  }

  const currentLength = currentSpan.end - currentSpan.start;
  const replacementLength = replacementSpan.end - replacementSpan.start;
  if (currentLength !== replacementLength) {
    return { applied: false, reason: "command-count-changed" };
  }

  const currentIds = getSubtreeElementIds(current, currentSpan);
  const replacementIds = getSubtreeElementIds(replacement, replacementSpan);
  if (!currentIds.has(rootId) || !replacementIds.has(rootId)) {
    return { applied: false, reason: "node-set-changed" };
  }
  if (!hasSameIds(currentIds, replacementIds)) {
    return { applied: false, reason: "node-set-changed" };
  }

  for (const elementId of currentIds) {
    if (
      !current.clipContextByElement.has(elementId) ||
      !replacement.clipContextByElement.has(elementId) ||
      !current.scrollContextKeyByElement.has(elementId) ||
      !replacement.scrollContextKeyByElement.has(elementId)
    ) {
      return { applied: false, reason: "invalid-span" };
    }
  }

  for (const elementId of currentIds) {
    if (
      current.topLayerElementIds.has(elementId) ||
      replacement.topLayerElementIds.has(elementId)
    ) {
      return { applied: false, reason: "top-layer" };
    }
  }

  if (
    !current.clipContextByElement.has(rootId) ||
    !replacement.clipContextByElement.has(rootId) ||
    !sameClipRect(
      current.clipContextByElement.get(rootId),
      replacement.clipContextByElement.get(rootId),
    )
  ) {
    return { applied: false, reason: "clip-context-changed" };
  }

  const currentScrollContext = current.scrollContextKeyByElement.get(rootId);
  const replacementScrollContext =
    replacement.scrollContextKeyByElement.get(rootId);
  if (
    !currentScrollContext ||
    !replacementScrollContext ||
    currentScrollContext !== replacementScrollContext
  ) {
    return { applied: false, reason: "scroll-context-changed" };
  }

  for (const elementId of currentIds) {
    const currentKey = current.zOrderKeyByElement.get(elementId);
    const replacementKey = replacement.zOrderKeyByElement.get(elementId);
    if (!currentKey || !replacementKey || currentKey !== replacementKey) {
      return { applied: false, reason: "z-order-changed" };
    }
  }

  for (const elementId of replacementIds) {
    if (!replacement.boundsMap.has(elementId)) {
      return { applied: false, reason: "bounds-missing" };
    }
  }

  const oldHitIds = new Set<string>();
  for (const elementId of currentIds) {
    if (current.hitBoundsMap.has(elementId)) oldHitIds.add(elementId);
  }
  const nextHitIds = new Set<string>();
  for (const elementId of replacementIds) {
    if (replacement.hitBoundsMap.has(elementId)) nextHitIds.add(elementId);
  }

  const damageBounds = getSubtreeDamageBounds(
    current,
    replacement,
    currentIds,
    replacementIds,
  );

  // 아래부터는 동기 JS 구간이다. 모든 reject 조건은 위에서 끝났으므로 부분 적용이 없다.
  const fixedReplacement = [];
  for (let index = 0; index < replacementLength; index += 1) {
    fixedReplacement.push(replacement.commands[replacementSpan.start + index]!);
  }
  replaceCommandRange(
    current.commands,
    currentSpan.start,
    currentSpan.end,
    fixedReplacement,
  );

  dropSubtreeEntries(current, currentIds);
  adoptSubtreeEntries(
    current,
    replacement,
    replacementIds,
    currentSpan.start - replacementSpan.start,
  );

  if (WASM_FLAGS.SPATIAL_INDEX) {
    for (const elementId of oldHitIds) spatialIndex.removeElement(elementId);
    for (const elementId of nextHitIds) {
      const bounds = current.hitBoundsMap.get(elementId);
      if (!bounds) continue;
      spatialIndex.updateElement(
        elementId,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      );
    }
  }

  current.presentationRevisionByRootKey.set(
    rootKey,
    publication.presentationRevision,
  );
  current.presentationRevision = Math.max(
    current.presentationRevision,
    publication.presentationRevision,
  );
  current.baseCanonicalRevision = publication.baseCanonicalRevision;

  publishPatchedCommandStreamSnapshot(current);

  return damageBounds ? { applied: true, damageBounds } : { applied: true };
}

/**
 * ADR-189 commit lane용 가변 길이 subtree splice.
 *
 * presentation lane의 동일 node-set/동일 command-count 계약은 유지하면서,
 * commit lane에서는 자식 추가·삭제와 텍스트 길이 변화로 span 길이가 달라지는
 * 경우를 허용한다. command buffer가 piece-table이면 tail offset을 한 칸씩
 * 다시 쓰지 않고 cursor span map이 논리 위치를 지연 해석한다.
 */
export function applyCommitSubtreeCommandPatch(
  input: ApplyCommitSubtreeCommandPatchInput,
): CommitSubtreeCommandPatchResult {
  const fail = (
    reason: CommitSubtreePatchRejectReason,
  ): CommitSubtreeCommandPatchResult => {
    recordCommitLanePatchFallback();
    return { applied: false, reason };
  };
  const { current, replacement, rootId, canonicalRevision, revision } = input;
  if (process.env.NODE_ENV === "development") renderCounters.patchCalls += 1;
  const rootKey = input.rootKey ?? "__default__";
  const currentRootRevision =
    current.presentationRevisionByRootKey.get(rootKey) ??
    current.presentationRevision;

  if (!isValidRevision(revision) || revision <= currentRootRevision) {
    return fail("stale-revision");
  }
  if (
    !isValidRevision(canonicalRevision) ||
    current.baseCanonicalRevision !== canonicalRevision ||
    replacement.baseCanonicalRevision !== canonicalRevision
  ) {
    return fail("base-revision-mismatch");
  }

  const currentSpan = current.subtreeSpans.get(rootId);
  const replacementSpan = replacement.subtreeSpans.get(rootId);
  if (!currentSpan || !replacementSpan) return fail("missing-span");
  if (
    !isValidSpan(current, rootId, currentSpan) ||
    !isValidSpan(replacement, rootId, replacementSpan)
  ) {
    return fail("invalid-span");
  }

  const currentRootClip = current.clipContextByElement.get(rootId);
  const replacementRootClip = replacement.clipContextByElement.get(rootId);
  if (
    (currentRootClip !== undefined || replacementRootClip !== undefined) &&
    !sameClipRect(currentRootClip, replacementRootClip)
  ) {
    return fail("clip-context-changed");
  }
  // (ADR-269 Phase 1: no scroll context check — a scroll position is the owner's property node,
  // not part of the stored context, so a replacement under it cannot disagree with the stream.)
  const currentZ = current.zOrderKeyByElement.get(rootId);
  const replacementZ = replacement.zOrderKeyByElement.get(rootId);
  if (!currentZ || !replacementZ || currentZ !== replacementZ) {
    return fail("z-order-changed");
  }
  const currentIds = collectCompleteSubtreeIds(current, currentSpan);
  const replacementIds = collectCompleteSubtreeIds(
    replacement,
    replacementSpan,
  );
  if (
    !currentIds ||
    !replacementIds ||
    !currentIds.has(rootId) ||
    !replacementIds.has(rootId)
  ) {
    return fail("invalid-span");
  }
  for (const elementId of currentIds) {
    if (current.topLayerElementIds.has(elementId)) return fail("top-layer");
  }
  for (const elementId of replacementIds) {
    if (replacement.topLayerElementIds.has(elementId)) return fail("top-layer");
  }
  for (const elementId of replacementIds) {
    if (!replacement.boundsMap.has(elementId)) return fail("bounds-missing");
  }

  const damageBounds = getSubtreeDamageBounds(
    current,
    replacement,
    currentIds,
    replacementIds,
  );
  let unsafePaint = false;
  for (const elementId of currentIds)
    if (
      current.damageUnsafeElementIds.has(elementId) ||
      hasTextPaintOverflow(elementId)
    )
      unsafePaint = true;
  for (const elementId of replacementIds)
    if (replacement.damageUnsafeElementIds.has(elementId)) unsafePaint = true;

  const replacementLength = replacementSpan.end - replacementSpan.start;
  const replacementCommands: RenderCommand[] = [];
  const replacementAt = createCommandReader(replacement.commands);
  for (let index = 0; index < replacementLength; index += 1) {
    const command = replacementAt(replacementSpan.start + index);
    if (!command) return fail("invalid-span");
    replacementCommands.push(command);
  }

  // 모든 검증은 위에서 끝났다. 이 지점 이후는 command/map/index를 함께
  // 교체하는 원자 구간이며, write count는 replacement span(k)로만 증가한다.
  replaceCommandRange(
    current.commands,
    currentSpan.start,
    currentSpan.end,
    replacementCommands,
  );
  recordCommitLanePatchWrites(replacementLength);
  if (process.env.NODE_ENV === "development")
    renderCounters.patchWrites += replacementLength;

  const oldHitIds = new Set<string>();
  for (const elementId of currentIds) {
    if (current.hitBoundsMap.has(elementId)) oldHitIds.add(elementId);
    // ADR-263 Phase 5: a picture stays valid while its node data and size do (the cache key
    // `getCachedNodePicture` checks) — only a removed element's picture is released here.
    if (!replacementIds.has(elementId)) invalidateNodePicture(elementId);
  }
  dropSubtreeEntries(current, currentIds);

  const nextHitIds = new Set<string>();
  for (const elementId of replacementIds)
    if (replacement.hitBoundsMap.has(elementId)) nextHitIds.add(elementId);
  adoptSubtreeEntries(
    current,
    replacement,
    replacementIds,
    currentSpan.start - replacementSpan.start,
  );

  if (WASM_FLAGS.SPATIAL_INDEX) {
    for (const elementId of oldHitIds) spatialIndex.removeElement(elementId);
    for (const elementId of nextHitIds) {
      const bounds = current.hitBoundsMap.get(elementId);
      if (!bounds) continue;
      spatialIndex.updateElement(
        elementId,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      );
    }
  }

  current.presentationRevisionByRootKey.set(rootKey, revision);
  current.presentationRevision = Math.max(
    current.presentationRevision,
    revision,
  );
  current.baseCanonicalRevision = canonicalRevision;
  publishPatchedCommandStreamSnapshot(current);

  return damageBounds
    ? {
        applied: true,
        writeCount: replacementLength,
        damageBounds,
        unsafePaint,
      }
    : {
        applied: true,
        writeCount: replacementLength,
        unsafePaint,
      };
}
