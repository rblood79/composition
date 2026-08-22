import type { PresentationTargetedLayoutPublication } from "../../../presentation/editorLayoutPublication";
import type { BoundingBox } from "../selection/types";
import { WASM_FLAGS } from "../wasm-bindings/featureFlags";
import * as spatialIndex from "../wasm-bindings/spatialIndex";
import {
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
  | "scroll-context-changed"
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
  const begin = stream.commands[span.start];
  const end = stream.commands[span.end - 1];
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
  for (let index = span.start; index < span.end; index += 1) {
    const command = stream.commands[index];
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

/** span 안에 포함된 element ID를 반환한다. subtree span은 DFS contiguous 계약을 전제로 한다. */
export function getSubtreeElementIds(
  stream: RenderCommandStream,
  span: SubtreeSpan,
): Set<string> {
  const ids = new Set<string>();
  for (const [elementId, candidate] of stream.subtreeSpans) {
    if (
      candidate.start >= span.start &&
      candidate.end <= span.end &&
      candidate.start < candidate.end
    ) {
      ids.add(elementId);
    }
  }
  return ids;
}

function hasSameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function copySpanWithOffset(span: SelfSpan | SubtreeSpan, offset: number) {
  return { start: span.start + offset, end: span.end + offset };
}

function copyBounds(bounds: BoundingBox): BoundingBox {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
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

  for (const elementId of currentIds) {
    current.selfSpans.delete(elementId);
    current.subtreeSpans.delete(elementId);
    current.clipContextByElement.delete(elementId);
    current.zOrderKeyByElement.delete(elementId);
    current.scrollContextKeyByElement.delete(elementId);
    current.subtreeBuildContextByElement.delete(elementId);
    current.topLayerElementIds.delete(elementId);
    current.boundsMap.delete(elementId);
    current.hitBoundsMap.delete(elementId);
  }

  const commandOffset = currentSpan.start - replacementSpan.start;
  for (const elementId of replacementIds) {
    const nextSelfSpan = replacement.selfSpans.get(elementId);
    if (nextSelfSpan) {
      current.selfSpans.set(
        elementId,
        copySpanWithOffset(nextSelfSpan, commandOffset),
      );
    }
    const nextSubtreeSpan = replacement.subtreeSpans.get(elementId);
    if (nextSubtreeSpan) {
      current.subtreeSpans.set(
        elementId,
        copySpanWithOffset(nextSubtreeSpan, commandOffset),
      );
    }
    const nextClip = replacement.clipContextByElement.get(elementId);
    if (nextClip !== undefined) {
      current.clipContextByElement.set(elementId, nextClip);
    }
    const nextZOrderKey = replacement.zOrderKeyByElement.get(elementId);
    if (nextZOrderKey !== undefined) {
      current.zOrderKeyByElement.set(elementId, nextZOrderKey);
    }
    const nextScrollContextKey =
      replacement.scrollContextKeyByElement.get(elementId);
    if (nextScrollContextKey !== undefined) {
      current.scrollContextKeyByElement.set(elementId, nextScrollContextKey);
    }
    const nextBuildContext =
      replacement.subtreeBuildContextByElement.get(elementId);
    if (nextBuildContext !== undefined) {
      current.subtreeBuildContextByElement.set(elementId, nextBuildContext);
    }
    if (replacement.topLayerElementIds.has(elementId)) {
      current.topLayerElementIds.add(elementId);
    }
    const nextBounds = replacement.boundsMap.get(elementId);
    if (nextBounds) current.boundsMap.set(elementId, copyBounds(nextBounds));
    const nextHitBounds = replacement.hitBoundsMap.get(elementId);
    if (nextHitBounds)
      current.hitBoundsMap.set(elementId, copyBounds(nextHitBounds));
  }

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

  return { applied: true };
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
    !isValidSpan(replacement, rootId, replacementSpan) ||
    !hasCompleteSubtreeSpanContext(current, currentSpan) ||
    !hasCompleteSubtreeSpanContext(replacement, replacementSpan)
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
  const currentScroll = current.scrollContextKeyByElement.get(rootId);
  const replacementScroll = replacement.scrollContextKeyByElement.get(rootId);
  if (
    !currentScroll ||
    !replacementScroll ||
    currentScroll !== replacementScroll
  ) {
    return fail("scroll-context-changed");
  }
  const currentZ = current.zOrderKeyByElement.get(rootId);
  const replacementZ = replacement.zOrderKeyByElement.get(rootId);
  if (!currentZ || !replacementZ || currentZ !== replacementZ) {
    return fail("z-order-changed");
  }
  const currentIds = getSubtreeElementIds(current, currentSpan);
  const replacementIds = getSubtreeElementIds(replacement, replacementSpan);
  if (!currentIds.has(rootId) || !replacementIds.has(rootId)) {
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

  const replacementLength = replacementSpan.end - replacementSpan.start;
  const replacementCommands: RenderCommand[] = [];
  for (let index = 0; index < replacementLength; index += 1) {
    const command = replacement.commands[replacementSpan.start + index];
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

  const oldHitIds = new Set<string>();
  for (const elementId of currentIds) {
    if (current.hitBoundsMap.has(elementId)) oldHitIds.add(elementId);
    invalidateNodePicture(elementId);
    current.selfSpans.delete(elementId);
    current.subtreeSpans.delete(elementId);
    current.clipContextByElement.delete(elementId);
    current.zOrderKeyByElement.delete(elementId);
    current.scrollContextKeyByElement.delete(elementId);
    current.subtreeBuildContextByElement.delete(elementId);
    current.topLayerElementIds.delete(elementId);
    current.boundsMap.delete(elementId);
    current.hitBoundsMap.delete(elementId);
  }

  const nextHitIds = new Set<string>();
  const commandOffset = currentSpan.start - replacementSpan.start;
  for (const elementId of replacementIds) {
    const nextSelfSpan = replacement.selfSpans.get(elementId);
    if (nextSelfSpan) {
      current.selfSpans.set(elementId, {
        start: nextSelfSpan.start + commandOffset,
        end: nextSelfSpan.end + commandOffset,
      });
    }
    const nextSubtreeSpan = replacement.subtreeSpans.get(elementId);
    if (nextSubtreeSpan) {
      current.subtreeSpans.set(elementId, {
        start: nextSubtreeSpan.start + commandOffset,
        end: nextSubtreeSpan.end + commandOffset,
      });
    }
    const nextClip = replacement.clipContextByElement.get(elementId);
    if (nextClip !== undefined)
      current.clipContextByElement.set(elementId, nextClip);
    const nextZOrderKey = replacement.zOrderKeyByElement.get(elementId);
    if (nextZOrderKey !== undefined)
      current.zOrderKeyByElement.set(elementId, nextZOrderKey);
    const nextScrollContextKey =
      replacement.scrollContextKeyByElement.get(elementId);
    if (nextScrollContextKey !== undefined) {
      current.scrollContextKeyByElement.set(elementId, nextScrollContextKey);
    }
    const nextBuildContext =
      replacement.subtreeBuildContextByElement.get(elementId);
    if (nextBuildContext !== undefined) {
      current.subtreeBuildContextByElement.set(elementId, nextBuildContext);
    }
    if (replacement.topLayerElementIds.has(elementId)) {
      current.topLayerElementIds.add(elementId);
    }
    const nextBounds = replacement.boundsMap.get(elementId);
    if (nextBounds) current.boundsMap.set(elementId, copyBounds(nextBounds));
    const nextHitBounds = replacement.hitBoundsMap.get(elementId);
    if (nextHitBounds) {
      current.hitBoundsMap.set(elementId, copyBounds(nextHitBounds));
      nextHitIds.add(elementId);
    }
    invalidateNodePicture(elementId);
  }

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

  return {
    applied: true,
    writeCount: replacementLength,
  };
}
