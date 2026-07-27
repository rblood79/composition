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
import { registerSkiaCacheDestroy } from "./disposable";
import { registerImageEvictionListener } from "./imageCache";

interface NodePictureEntry {
  /** skiaNodeRegistry 등록 객체 identity — 내용 변경 감지 키 */
  dataRef: object;
  width: number;
  height: number;
  picture: SkPicture;
  /** record 시점에 span 이 참조한 SkImage 들 — 퇴거 역참조용 */
  imageRefs: SkImage[] | null;
}

/** GPU/WASM 메모리 보호 상한 (요소당 1 entry — LRU 퇴거) */
const MAX_NODE_PICTURES = 1024;

/** elementId → entry. Map 삽입 순서를 LRU 로 사용 (hit 시 재삽입) */
const cache = new Map<string, NodePictureEntry>();

/** SkImage → 그 이미지를 참조하는 elementId 집합 (퇴거 시 동시 invalidate) */
const imageIndex = new Map<SkImage, Set<string>>();

/** transition/animation tick 이 in-place mutate 중인 노드 — 캐시 대상 제외 */
let volatileIds: ReadonlySet<string> | null = null;

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

/** 해당 노드가 이번 프레임 volatile(캐시 제외) 인지 판정 */
export function isVolatileNode(elementId: string): boolean {
  return volatileIds !== null && volatileIds.has(elementId);
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
  const entry = cache.get(elementId);
  if (!entry) {
    if (process.env.NODE_ENV === "development") {
      getCacheMetrics("nodePicture").recordMiss("cold");
    }
    return null;
  }
  if (entry.dataRef !== dataRef) {
    if (process.env.NODE_ENV === "development") {
      getCacheMetrics("nodePicture").recordMiss("data");
    }
    return null;
  }
  if (entry.width !== width || entry.height !== height) {
    if (process.env.NODE_ENV === "development") {
      getCacheMetrics("nodePicture").recordMiss("size");
    }
    return null;
  }

  // LRU touch — 재삽입으로 최신화
  cache.delete(elementId);
  cache.set(elementId, entry);
  if (process.env.NODE_ENV === "development") {
    getCacheMetrics("nodePicture").recordHit();
  }
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
): void {
  const existing = cache.get(elementId);
  if (existing) {
    disposeEntry(elementId, existing);
    cache.delete(elementId);
  }

  cache.set(elementId, { dataRef, width, height, picture, imageRefs });
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

  if (cache.size > MAX_NODE_PICTURES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey !== undefined) {
      invalidateNodePicture(oldestKey);
    }
  }
}

/** 단일 노드 entry 폐기 (Picture 해제 + image 역참조 정리) */
export function invalidateNodePicture(elementId: string): void {
  const entry = cache.get(elementId);
  if (!entry) return;
  disposeEntry(elementId, entry);
  cache.delete(elementId);
}

/**
 * SkImage 퇴거 직전 호출 — 그 이미지를 참조하는 Picture 를 먼저 해제한다.
 * (해제 순서: Picture → Image. 역순이면 replay 시 use-after-free)
 */
function invalidateNodePicturesByImage(image: SkImage): void {
  const ids = imageIndex.get(image);
  if (!ids) return;
  // invalidateNodePicture 가 imageIndex 를 정리하므로 복사본 순회
  for (const id of [...ids]) {
    invalidateNodePicture(id);
  }
}

/** 전체 폐기 — 페이지 전환(clearSkiaRegistry)/캔버스 teardown/fontMgr 교체 */
export function clearNodePictureCache(): void {
  for (const entry of cache.values()) {
    entry.picture.delete();
  }
  cache.clear();
  imageIndex.clear();
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

function disposeEntry(elementId: string, entry: NodePictureEntry): void {
  entry.picture.delete();
  if (entry.imageRefs) {
    for (const img of entry.imageRefs) {
      const ids = imageIndex.get(img);
      if (!ids) continue;
      ids.delete(elementId);
      if (ids.size === 0) imageIndex.delete(img);
    }
  }
}

// 통합 해제 경로 등록 (ADR-153 Phase 2 레지스트리) — 캔버스 teardown 시 전량 해제
registerSkiaCacheDestroy("nodePictureCache", clearNodePictureCache);

// image 퇴거 역참조 — imageCache 가 SkImage.delete() 를 부르기 직전 통지 (R2)
registerImageEvictionListener(invalidateNodePicturesByImage);

// HMR: 모듈 교체 시 WASM Picture 누수 방지 (paragraphCache 와 동일 패턴)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearNodePictureCache();
  });
}

// dev 전용 디버그 전역 — live 검증(G2/G3)에서 캐시 상태 probe 용
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (
    window as unknown as Record<string, unknown>
  ).__composition_NODE_PICTURE_CACHE_DEBUG__ = {
    size: getNodePictureCacheSize,
    clear: clearNodePictureCache,
  };
}
