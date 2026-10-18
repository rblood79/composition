/**
 * 노드 Picture 캐시 (ADR-153 Phase 3)
 *
 * command stream 경로의 요소별 self-draw 블록(자기 shapes/text — 자식 요소 제외)을
 * CanvasKit SkPicture 로 record 해 두고, 내용이 바뀌지 않은 요소는 다음 content
 * 재빌드에서 `canvas.drawPicture()` 재생으로 대체한다. record/replay 진입점은
 * renderCommands.ts — 본 모듈은 저장소와 lifecycle 만 담당한다.
 *
 * ## 키 설계 (위치 제외 — 리뷰 r1 M1)
 *
 * - `dataRef`: skiaNodeRegistry 에 등록된 SkiaNodeData 객체 identity.
 *   `registerSkiaNode` 는 내용 변경 시 항상 새 객체를 등록하므로 identity 불일치 =
 *   내용 변경이다. 유일한 구멍은 transition/animation tick 의 in-place mutation —
 *   그 구간은 volatile 면제(`setVolatileNodeIds`)가 캐시에서 제외한다.
 * - `width`/`height`: 커맨드에 bake 되는 layout 크기 (updateTextChildren 등
 *   크기 의존 변환이 self-draw 내용에 반영됨).
 * - 위치(x/y)는 키에 없다 — record 는 노드-로컬 좌표로 수행하고 이동은 replay 시
 *   외부 `canvas.translate` 가 적용한다. 드래그/이동만으로는 re-record 하지 않는다.
 *
 * ## WASM lifecycle (R2)
 *
 * - SkPicture 는 명시 `.delete()` — 교체/무효화/LRU 퇴거/전체 해제 전 경로.
 * - record 된 Picture 는 참조한 SkImage 를 내부 ref 하므로 imageCache 퇴거보다
 *   먼저 해제되어야 한다 (해제 순서: Picture → Image). imageCache 의 eviction
 *   listener 로 image → 참조 Picture 역참조 invalidate 를 수행한다.
 * - 캔버스 teardown 은 disposable.ts 통합 해제 레지스트리(`destroyAllSkiaCaches`)
 *   경유 — SkiaCanvas unmount 시 전량 해제.
 */

import type { FontMgr, SkPicture, Image as SkImage } from "canvaskit-wasm";
import { getCacheMetrics } from "./cacheMetrics";
import {
  drainPendingWasmDisposals,
  scheduleWasmDisposal,
} from "./deferredDisposal";
import {
  MAX_NODE_PICTURE_BYTES,
  MAX_WARM_NODE_PICTURES,
} from "./canvasMemoryBudget";
import { registerSkiaCacheDestroy } from "./disposable";
import { registerImageEvictionListener } from "./imageCache";
import { renderCounters } from "./renderCounters";

interface NodePictureEntry {
  /** skiaNodeRegistry 등록 객체 identity — 내용 변경 감지 키 */
  dataRef: object;
  width: number;
  height: number;
  picture: SkPicture;
  /** record 시점에 span 이 참조한 SkImage 들 — 퇴거 역참조용 */
  imageRefs: SkImage[] | null;
  /** CanvasKit 추정 바이트 (`approximateBytesUsed`) — 보유량 상한 (ADR-266 HC5). */
  bytes: number;
  /**
   * LRU 스탬프. hit 경로가 Map 을 재삽입하는 대신 이 필드만 갱신한다 —
   * hit 은 프레임마다 요소 수만큼 발생하므로 해시 테이블 구조 변경
   * (delete + set = tombstone 누적 → 주기적 rehash) 을 피한다.
   */
  lastUsed: number;
}

/** 드래그 중인 전체 subtree를 한 drawPicture로 재생하기 위한 단기 캐시. */
interface DragSubtreePictureEntry {
  streamRef: object;
  registryVersion: number;
  picture: SkPicture;
  imageRefs: SkImage[] | null;
  elementIds: ReadonlySet<string>;
}

/**
 * ADR-266 Phase 2 — 상한은 한 화면이 쓰는 picture 수 (working set) 를 따른다 (사용자 결정 1, 2026-10-17).
 *
 * 고정 1,024 는 22 페이지 문서 줌 한 화면 (3,860 ~ 3,961 요소) 보다 작아, 순서대로 기록하면 LRU 가 늘
 * 직전 기록분을 밀어내 다음 기록이 전부 cold 였다 (순차 스캔 thrash). 상한 = 직전 content **full** 기록이
 * picture 로 지나간 요소 수 (hit + record) × 1.25 — 새 record 수가 아니다 (warm 프레임은 record 0 이라
 * 상한이 줄어 thrash 가 재발한다, 리뷰 r1 M2). damage · drag 부분 기록은 working set 을 바꾸지 않는다.
 * 줄이기는 full 기록 60 회 (60Hz 로 1 초) 연속으로 working set 이 상한의 60 % 아래일 때만 (히스테리시스 —
 * 3 회는 줌 제스처의 확대 쪽 몇 프레임만에 1,024 로 줄어 축소 때 전부 다시 기록했다, dev 퇴거 16,896). 기록 중에는
 * 그 기록이 이미 지나간 수 × 1.25 아래로 퇴거하지 않는다 — 처음 큰 화면도 자기 앞부분을 밀어내지 않는다.
 * 보유 바이트 합이 `MAX_NODE_PICTURE_BYTES` 를 넘으면 working set 과 무관하게 퇴거한다 (메모리 상한의 상한).
 * 측정: picture 3,961 개 ≈ 0.99 MB · WASM 힙 고수위 128 MB 불변 (breakdown §기록).
 */
const MIN_NODE_PICTURES = 1024;
const WORKING_SET_HEADROOM = 1.25;
const SHRINK_RATIO = 0.6;
const SHRINK_AFTER_RECORDS = 60;
/** 퇴거는 한 번에 상한의 이 비율까지 — 선형 스캔 · 정렬을 store 마다 하지 않는다. */
const EVICT_TO_RATIO = 0.9;
// 바이트 상한 · 미리 기록 상한은 예산 표 (`canvasMemoryBudget.ts`, ADR-273) — 기존 import 경로를 위해 다시 낸다.
export { MAX_NODE_PICTURE_BYTES, MAX_WARM_NODE_PICTURES };

let capacity = MIN_NODE_PICTURES;
let lowRecords = 0;
/** 지금 content full 기록 중인가 · 그 기록이 picture 로 지나간 요소 수. */
let fullRecord = false;
let touched = 0;
let totalBytes = 0;
/** 미리 기록이 채운 뒤의 상한 하한 (0 = 미리 기록 없음). */
let warmFloor = 0;
/**
 * 미리 기록한 picture 의 글자 넘침 (아직 화면에 재생 전) — 첫 재생이 가져간다 (`takeWarmTextPaint`).
 * entry 가 바뀌거나 사라지면 같이 지운다.
 */
const warmTextPaint = new Map<string, boolean>();

/** elementId → entry. LRU 순서는 `entry.lastUsed` 스탬프가 보유한다. */
const cache = new Map<string, NodePictureEntry>();

/** 활성 drag root 수만큼만 존재하며 drag 종료/stream 교체 시 전량 해제된다. */
const dragSubtreeCache = new Map<string, DragSubtreePictureEntry>();

/** 단조 증가 사용 시각 — LRU 비교 전용 */
let useClock = 0;

/** SkImage → 그 이미지를 참조하는 elementId 집합 (퇴거 시 동시 invalidate) */
const imageIndex = new Map<SkImage, Set<string>>();
const dragImageIndex = new Map<SkImage, Set<string>>();

/** transition/animation tick 이 in-place mutate 중인 노드 — 캐시 대상 제외 */
let volatileIds: ReadonlySet<string> | null = null;

/** ADR-187 presentation overlay가 draw data를 in-place mutate 중인 노드 */
let presentationVolatileIds: ReadonlySet<string> | null = null;

/**
 * ADR-266 Phase 0 (dev 전용): entry 가 왜 사라졌는가 — 다음 `cold` miss 를 사유별로 센다.
 * `store` 가 지운다. 없으면 처음 기록이다.
 */
export type NodePictureLoss =
  "evicted" | "released" | "invalidated" | "cleared";
const lossById = new Map<string, NodePictureLoss>();
const COLD_COUNTER = {
  evicted: "pictureColdEvicted",
  released: "pictureColdReleased",
  invalidated: "pictureColdInvalidated",
  cleared: "pictureColdCleared",
} as const;

/** 폰트 로딩으로 fontMgr 가 교체되면 record 된 글리프가 stale — 전량 폐기 기준 */
let lastFontMgr: FontMgr | null = null;

// ── 공개 API ──────────────────────────────────────────────────────────

/**
 * 이번 프레임에 transition/animation 이 mutate 중인 노드 집합을 공급한다.
 * SkiaRenderer 가 매 프레임 호출한다 (비활성 프레임은 null).
 */
export function setVolatileNodeIds(ids: ReadonlySet<string> | null): void {
  volatileIds = ids && ids.size > 0 ? ids : null;
}

/**
 * Editor presentation patch가 활성인 노드를 Picture 캐시에서 제외한다.
 * transition owner와 수명이 다르므로 별도 set으로 유지하고 조회 시 합성한다.
 */
export function setPresentationVolatileNodeIds(
  ids: ReadonlySet<string> | null,
): void {
  presentationVolatileIds = ids && ids.size > 0 ? ids : null;
}

/** 해당 노드가 이번 프레임 volatile(캐시 제외) 인지 판정 */
export function isVolatileNode(elementId: string): boolean {
  return (
    (volatileIds !== null && volatileIds.has(elementId)) ||
    (presentationVolatileIds !== null && presentationVolatileIds.has(elementId))
  );
}

/**
 * 캐시 조회 — dataRef identity + width/height 가 모두 일치할 때만 hit.
 * miss 사유는 dev cacheMetrics 로 분류 기록된다 (cold / data / size).
 */
export function getCachedNodePicture(
  elementId: string,
  dataRef: object,
  width: number,
  height: number,
): SkPicture | null {
  const dev = process.env.NODE_ENV === "development";
  const miss = (reason: string): null => {
    if (dev) getCacheMetrics("nodePicture").recordMiss(reason);
    return null;
  };

  if (fullRecord) touched += 1;
  const entry = cache.get(elementId);
  if (!entry) {
    if (dev) {
      const loss = lossById.get(elementId);
      renderCounters[loss ? COLD_COUNTER[loss] : "pictureColdFirst"] += 1;
    }
    return miss("cold");
  }
  if (entry.dataRef !== dataRef) return miss("data");
  if (entry.width !== width || entry.height !== height) return miss("size");

  entry.lastUsed = ++useClock; // LRU touch (필드 쓰기 — Map 구조 무변경)
  if (dev) getCacheMetrics("nodePicture").recordHit();
  return entry.picture;
}

/** record 결과 저장 — 기존 entry 는 Picture 해제 후 교체. 상한 초과 시 LRU 퇴거. */
export function storeNodePicture(
  elementId: string,
  dataRef: object,
  width: number,
  height: number,
  picture: SkPicture,
  imageRefs: SkImage[] | null,
  /** 미리 기록은 0 — 아직 아무 프레임도 쓰지 않은 entry 는 퇴거 때 가장 먼저 나간다. */
  lastUsed = ++useClock,
): void {
  invalidateNodePicture(elementId); // 기존 entry 가 있으면 Picture 해제 + 역참조 정리
  if (process.env.NODE_ENV === "development") lossById.delete(elementId);

  const bytes = picture.approximateBytesUsed();
  totalBytes += bytes;
  cache.set(elementId, {
    dataRef,
    width,
    height,
    picture,
    imageRefs,
    bytes,
    lastUsed,
  });
  if (imageRefs) {
    for (const img of imageRefs) {
      let ids = imageIndex.get(img);
      if (!ids) {
        ids = new Set();
        imageIndex.set(img, ids);
      }
      ids.add(elementId);
    }
  }

  if (cache.size > effectiveCapacity() || totalBytes > MAX_NODE_PICTURE_BYTES)
    evictLeastRecentlyUsed();
  syncMetricsSize();
}

/**
 * ADR-266 Phase 4: 프레임 밖에서 미리 기록한 picture 저장 (`nodePictureWarmup`). 프레임이 쓰기 전까지는
 * 퇴거 순서가 가장 앞이고, 상한을 `MAX_WARM_NODE_PICTURES` 아래로 내리지 않는다.
 */
export function storeWarmNodePicture(
  elementId: string,
  dataRef: object,
  width: number,
  height: number,
  picture: SkPicture,
  imageRefs: SkImage[] | null,
  /** 그 기록이 글자를 그렸으면 넘쳤는가 (없으면 undefined). */
  textOverflows?: boolean,
): void {
  warmFloor = MAX_WARM_NODE_PICTURES;
  storeNodePicture(elementId, dataRef, width, height, picture, imageRefs, 0);
  if (textOverflows !== undefined && cache.has(elementId))
    warmTextPaint.set(elementId, textOverflows);
}

/** 미리 기록한 picture 의 첫 재생 — 보관한 글자 넘침을 꺼낸다 (한 번만). */
export function takeWarmTextPaint(elementId: string): boolean | undefined {
  if (warmTextPaint.size === 0) return undefined;
  const overflows = warmTextPaint.get(elementId);
  if (overflows !== undefined) warmTextPaint.delete(elementId);
  return overflows;
}

/** 미리 기록을 더 할 자리가 있는가 — 수 · 바이트 (퇴거를 일으키지 않는 범위). */
export function hasNodePictureWarmRoom(): boolean {
  return (
    cache.size < MAX_WARM_NODE_PICTURES &&
    totalBytes < MAX_NODE_PICTURE_BYTES * EVICT_TO_RATIO
  );
}

/** ADR-272 Phase 2: 미리 기록에 남은 자리 (개수) — 바이트 자리가 없으면 0. 차례의 k 제한 선택이 쓴다. */
export function getNodePictureWarmRoom(): number {
  return hasNodePictureWarmRoom() ? MAX_WARM_NODE_PICTURES - cache.size : 0;
}

/** 지금 키로 쓸 수 있는 picture 가 있는가 — LRU · 계측을 건드리지 않는다 (미리 기록의 건너뛰기 판정). */
export function hasNodePicture(
  elementId: string,
  dataRef: object,
  width: number,
  height: number,
): boolean {
  const entry = cache.get(elementId);
  return (
    entry !== undefined &&
    entry.dataRef === dataRef &&
    entry.width === width &&
    entry.height === height
  );
}

/**
 * ADR-266 Phase 4: 같은 그림의 새 데이터로 picture 키를 옮긴다 (`registerMovedSkiaNode` — 자리만 옮긴 노드).
 * entry 가 옛 데이터의 것이 아니면 버린다 (`registerSkiaNode` 와 같다).
 */
export function retargetNodePicture(
  elementId: string,
  from: object,
  to: object,
): void {
  const entry = cache.get(elementId);
  if (entry?.dataRef === from) entry.dataRef = to;
  else invalidateNodePicture(elementId);
}

/** 동일 command stream/revision에서 기록한 drag subtree picture 조회. */
export function getCachedDragSubtreePicture(
  elementId: string,
  streamRef: object,
  registryVersion: number,
): SkPicture | null {
  const entry = dragSubtreeCache.get(elementId);
  if (
    entry &&
    entry.streamRef === streamRef &&
    entry.registryVersion === registryVersion &&
    !hasVolatileElement(entry.elementIds)
  ) {
    if (process.env.NODE_ENV === "development") {
      getCacheMetrics("dragSubtreePicture").recordHit();
    }
    return entry.picture;
  }
  const missReason =
    entry && hasVolatileElement(entry.elementIds) ? "volatile" : "revision";
  if (entry) invalidateDragSubtreePicture(elementId);
  if (process.env.NODE_ENV === "development") {
    getCacheMetrics("dragSubtreePicture").recordMiss(
      entry ? missReason : "cold",
    );
  }
  return null;
}

/** drag subtree picture 저장 — 활성 root 수만큼만 유지한다. */
export function storeDragSubtreePicture(
  elementId: string,
  streamRef: object,
  registryVersion: number,
  picture: SkPicture,
  imageRefs: SkImage[] | null,
  elementIds: ReadonlySet<string>,
): void {
  invalidateDragSubtreePicture(elementId);
  dragSubtreeCache.set(elementId, {
    streamRef,
    registryVersion,
    picture,
    imageRefs,
    elementIds,
  });
  if (imageRefs) {
    for (const image of imageRefs) {
      let ids = dragImageIndex.get(image);
      if (!ids) {
        ids = new Set();
        dragImageIndex.set(image, ids);
      }
      ids.add(elementId);
    }
  }
  syncMetricsSize();
}

function hasVolatileElement(elementIds: ReadonlySet<string>): boolean {
  if (volatileIds) {
    for (const elementId of volatileIds) {
      if (elementIds.has(elementId)) return true;
    }
  }
  if (presentationVolatileIds) {
    for (const elementId of presentationVolatileIds) {
      if (elementIds.has(elementId)) return true;
    }
  }
  return false;
}

export function invalidateDragSubtreePicture(elementId: string): void {
  const entry = dragSubtreeCache.get(elementId);
  if (!entry) return;
  scheduleWasmDisposal(entry.picture);
  dragSubtreeCache.delete(elementId);
  if (entry.imageRefs) {
    for (const image of entry.imageRefs) {
      const ids = dragImageIndex.get(image);
      if (!ids) continue;
      ids.delete(elementId);
      if (ids.size === 0) dragImageIndex.delete(image);
    }
  }
  syncMetricsSize();
}

export function clearDragSubtreePictureCache(): void {
  for (const elementId of [...dragSubtreeCache.keys()]) {
    invalidateDragSubtreePicture(elementId);
  }
}

/** 새 drag plan과 무관한 root/revision picture를 즉시 retire한다. */
export function prepareDragSubtreePictureCache(
  streamRef: object,
  registryVersion: number,
  activeElementIds: ReadonlySet<string>,
): void {
  for (const [elementId, entry] of [...dragSubtreeCache]) {
    if (
      !activeElementIds.has(elementId) ||
      entry.streamRef !== streamRef ||
      entry.registryVersion !== registryVersion
    ) {
      invalidateDragSubtreePicture(elementId);
    }
  }
}

/**
 * 단일 노드 entry 폐기 (Picture 해제 + image 역참조 정리). true = entry 가 있었다.
 * `loss` 는 dev 계측 사유 (ADR-266 Phase 0) — 동작에 쓰지 않는다.
 */
export function invalidateNodePicture(
  elementId: string,
  loss: NodePictureLoss = "invalidated",
): boolean {
  const entry = cache.get(elementId);
  if (!entry) return false;
  disposeEntry(elementId, entry);
  cache.delete(elementId);
  warmTextPaint.delete(elementId);
  if (process.env.NODE_ENV === "development") lossById.set(elementId, loss);
  syncMetricsSize();
  return true;
}

/**
 * SkImage 퇴거 직전 호출 — 그 이미지를 참조하는 Picture 를 먼저 해제한다.
 * (해제 순서: Picture → Image. 역순이면 replay 시 use-after-free)
 */
function invalidateNodePicturesByImage(image: SkImage): void {
  const ids = imageIndex.get(image);
  if (ids) {
    // invalidateNodePicture 가 imageIndex 를 정리하므로 복사본 순회
    for (const id of [...ids]) {
      invalidateNodePicture(id);
    }
  }
  const dragIds = dragImageIndex.get(image);
  if (dragIds) {
    for (const id of [...dragIds]) {
      invalidateDragSubtreePicture(id);
    }
  }
}

/**
 * 전체 폐기 — 페이지 전환(clearSkiaRegistry)/캔버스 teardown/fontMgr 교체.
 *
 * delete 는 `deferredDisposal` 큐 경유 — fontMgr 교체 경로가 walk 초입
 * (`executeRenderCommands`) 에서 불리므로 즉시 delete 는 같은 프레임에 이미
 * `drawPicture` 로 제출된 Picture 의 use-after-free 가 된다. teardown 처럼
 * 프레임 밖 정리는 호출측이 drain 을 이어 부른다 (ADR-174 Phase 1).
 */
/**
 * ADR-266: content full 기록의 시작 · 끝 (`CatalogCanvasScene.contentNode` 의 `renderSkia`). 끝에서 그
 * 기록의 working set 으로 상한을 맞춘다. damage 기록은 부르지 않는다.
 */
export function beginNodePictureFullRecord(): void {
  fullRecord = true;
  touched = 0;
}

export function endNodePictureFullRecord(): void {
  if (!fullRecord) return;
  fullRecord = false;
  const target = Math.max(
    MIN_NODE_PICTURES,
    Math.ceil(touched * WORKING_SET_HEADROOM),
  );
  if (target >= capacity) {
    capacity = target;
    lowRecords = 0;
  } else if (touched < capacity * SHRINK_RATIO) {
    lowRecords += 1;
    if (lowRecords >= SHRINK_AFTER_RECORDS) {
      capacity = target;
      lowRecords = 0;
      if (cache.size > effectiveCapacity()) evictLeastRecentlyUsed();
    }
  } else lowRecords = 0;
  touched = 0;
  syncMetricsSize();
}

/** 상한을 처음 값으로 — 캔버스 teardown (다음 캔버스는 자기 working set 으로 다시 자란다) · 테스트. */
export function resetNodePictureCapacity(): void {
  capacity = MIN_NODE_PICTURES;
  warmFloor = 0;
  lowRecords = 0;
  fullRecord = false;
  touched = 0;
}

/** 지금 상한 (디버그 · 테스트). */
export function getNodePictureCapacity(): number {
  return capacity;
}

/** 보유 picture 의 CanvasKit 추정 바이트 합 (디버그 · 테스트). */
export function getNodePictureBytes(): number {
  return totalBytes;
}

/** 기록 중에는 그 기록이 지나간 요소를 밀어내지 않는다 · 미리 기록이 채운 수 아래로 내리지 않는다. */
/** 지금 적용되는 개수 상한 — working set 상한 · 기록 중 하한 · 미리 기록 하한 중 큰 값 (ADR-273 보유량 표). */
export function getNodePictureEffectiveCapacity(): number {
  return effectiveCapacity();
}

function effectiveCapacity(): number {
  const base = fullRecord
    ? Math.max(capacity, Math.ceil(touched * WORKING_SET_HEADROOM))
    : capacity;
  return Math.max(base, warmFloor);
}

export function clearNodePictureCache(): void {
  for (const [id, entry] of cache) {
    scheduleWasmDisposal(entry.picture);
    if (process.env.NODE_ENV === "development") lossById.set(id, "cleared");
  }
  cache.clear();
  warmTextPaint.clear();
  totalBytes = 0;
  imageIndex.clear();
  clearDragSubtreePictureCache();
  dragImageIndex.clear();
  syncMetricsSize();
}

/**
 * fontMgr 세대 확인 — 폰트 로딩 완료로 fontMgr 가 교체되면 기존 record 의
 * 글리프(폴백 폰트)가 stale 이므로 전량 폐기한다. (nodeRendererText 의
 * paragraphCache 와 동일 규율)
 */
export function ensureNodePictureFontGeneration(fontMgr: FontMgr | null): void {
  if (fontMgr === lastFontMgr) return;
  if (lastFontMgr !== null) {
    clearNodePictureCache();
  }
  lastFontMgr = fontMgr;
}

/**
 * dev 토글 — `window.__composition_NODE_PICTURE_CACHE__ = false` 로 비활성화.
 * cross-check A/B 스크린샷 비교(캐시 on/off 시각 동일성)용. production 은 항상 on.
 */
export function isNodePictureCacheEnabled(): boolean {
  if (process.env.NODE_ENV === "development") {
    return (
      (window as unknown as Record<string, unknown>)
        .__composition_NODE_PICTURE_CACHE__ !== false
    );
  }
  return true;
}

/** 캐시 크기 (디버그/테스트용) */
export function getNodePictureCacheSize(): number {
  return cache.size;
}

// ── Internal ──────────────────────────────────────────────────────────

/**
 * 상한 · 바이트 상한을 넘으면 `lastUsed` 가 오래된 것부터 상한의 90 % (바이트도 90 %) 까지 한 번에
 * 퇴거한다. 한 번의 정렬로 여러 entry 를 내보내 store 마다 1,024 entry 를 훑던 선형 스캔 (ADR-266 C3 —
 * production 편집 프로필 1 위) 을 없앤다. 지금 기록이 지나간 entry 는 스탬프가 가장 새로워 마지막에 간다.
 */
function evictLeastRecentlyUsed(): void {
  const countTarget = Math.floor(effectiveCapacity() * EVICT_TO_RATIO);
  const bytesTarget = Math.floor(MAX_NODE_PICTURE_BYTES * EVICT_TO_RATIO);
  if (cache.size <= countTarget && totalBytes <= bytesTarget) return;
  const oldest = [...cache].sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
  const dev = process.env.NODE_ENV === "development";
  for (const [id] of oldest) {
    if (cache.size <= countTarget && totalBytes <= bytesTarget) break;
    if (cache.size <= 1) break;
    invalidateNodePicture(id, "evicted");
    if (dev) {
      getCacheMetrics("nodePicture").recordEviction();
      renderCounters.pictureEvictions += 1;
    }
  }
}

/** dev 계측 채널에 현재 크기 반영 — `__composition_CACHE_METRICS__` 스냅샷용 */
function syncMetricsSize(): void {
  if (process.env.NODE_ENV === "development") {
    getCacheMetrics("nodePicture").setSize(cache.size);
    getCacheMetrics("dragSubtreePicture").setSize(dragSubtreeCache.size);
  }
}

function disposeEntry(elementId: string, entry: NodePictureEntry): void {
  totalBytes -= entry.bytes;
  // 즉시 delete 금지 — walk 중 LRU 퇴거/교체가 이번 프레임에 이미 그려진
  // (아직 flush 안 된) Picture 를 파괴하면 그 노드의 self-draw 가 소실된다.
  scheduleWasmDisposal(entry.picture);
  if (entry.imageRefs) {
    for (const img of entry.imageRefs) {
      const ids = imageIndex.get(img);
      if (!ids) continue;
      ids.delete(elementId);
      if (ids.size === 0) imageIndex.delete(img);
    }
  }
}

// 통합 해제 경로 등록 (ADR-153 Phase 2 레지스트리) — 캔버스 teardown 시 전량 해제.
// teardown 은 프레임 밖이므로 pending 폐기까지 즉시 배수해 WASM 누수를 막는다.
registerSkiaCacheDestroy("nodePictureCache", () => {
  clearNodePictureCache();
  resetNodePictureCapacity();
  drainPendingWasmDisposals();
});

// image 퇴거 역참조 — imageCache 가 SkImage.delete() 를 부르기 직전 통지 (R2)
registerImageEvictionListener(invalidateNodePicturesByImage);

// HMR: 모듈 교체 시 WASM Picture 누수 방지 (paragraphCache 와 동일 패턴)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearNodePictureCache();
    drainPendingWasmDisposals();
  });
}

// dev 전용 디버그 전역 — live 검증(G2/G3)에서 캐시 상태 probe 용
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (
    window as unknown as Record<string, unknown>
  ).__composition_NODE_PICTURE_CACHE_DEBUG__ = {
    size: getNodePictureCacheSize,
    clear: clearNodePictureCache,
    // ADR-266 HC5: 보유 picture 의 CanvasKit 추정 바이트 합 (WASM 힙 고수위는 예약 크기라 보유량을 못 본다).
    bytes: getNodePictureBytes,
    capacity: getNodePictureCapacity,
  };
}
