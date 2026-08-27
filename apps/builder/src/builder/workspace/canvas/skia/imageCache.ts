/**
 * CanvasKit 이미지 캐시
 *
 * URL → CanvasKit Image(SkImage) 변환 및 캐싱을 담당한다.
 * fontManager.ts 패턴을 따르며, 이미지를 fetch → ArrayBuffer → MakeImageFromEncoded로 로딩한다.
 *
 * - refCount 기반 참조 관리
 * - LRU 퇴거 정책 (MAX_CACHE_SIZE 초과 시 최소 참조 엔트리 제거)
 * - CORS 모드 설정 (외부 이미지 지원)
 * - 로딩 완료 시 Canvas 재렌더 트리거 콜백 지원 (specShapeConverter 연동)
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.11 이미지 렌더링
 */

import type { CanvasKit, Image as SkImage } from "canvaskit-wasm";
import {
  getCanvasKit,
  initCanvasKit,
  isCanvasKitInitialized,
} from "./initCanvasKit";
import { registerSkiaCacheDestroy } from "./disposable";
import {
  drainPendingWasmDisposals,
  scheduleWasmDisposal,
} from "./deferredDisposal";

// ============================================
// 재렌더 트리거 콜백 레지스트리
// ============================================

/**
 * 이미지 로딩 완료 시 호출할 콜백 목록.
 * specShapeConverter에서 loadSkImage()를 호출한 후 Canvas를 재렌더하려면
 * SkiaOverlay가 이 콜백을 등록해야 한다.
 */
const loadCallbacks = new Set<() => void>();

/**
 * 이미지 로딩 완료 시 호출할 재렌더 콜백을 등록한다.
 * @returns 등록 해제 함수
 */
export function registerImageLoadCallback(cb: () => void): () => void {
  loadCallbacks.add(cb);
  return () => {
    loadCallbacks.delete(cb);
  };
}

/** 등록된 모든 재렌더 콜백을 호출한다 */
function notifyImageLoaded(): void {
  for (const cb of loadCallbacks) {
    cb();
  }
}

// ============================================
// 퇴거 리스너 (ADR-153 Phase 3 — R2 해제 순서)
// ============================================

/**
 * 캐시된 SkImage 가 `.delete()` 되기 **직전** 호출되는 리스너.
 * record 된 SkPicture 가 이미지를 내부 ref 하므로, 참조 Picture 를 먼저
 * 해제해야 한다 (해제 순서: Picture → Image). nodePictureCache 가 구독한다.
 */
type ImageEvictionListener = (image: SkImage) => void;

const evictionListeners = new Set<ImageEvictionListener>();

/** SkImage 퇴거 리스너를 등록한다. @returns 등록 해제 함수 */
export function registerImageEvictionListener(
  cb: ImageEvictionListener,
): () => void {
  evictionListeners.add(cb);
  return () => {
    evictionListeners.delete(cb);
  };
}

/**
 * 캐시된 SkImage 해제의 **단일 경로**.
 * 리스너 통지가 폐기보다 먼저라는 순서를 함수 경계로 보장한다 —
 * 호출 규율로 두면 새 퇴거 경로가 추가될 때 조용히 깨진다 (R2).
 *
 * 실제 `.delete()` 는 지연 큐 경유다. 퇴거는 `loadSkImage` 의 비동기 완료
 * 안에서도 일어나므로 프레임의 record 와 flush 사이에 낄 수 있는데, 이미
 * draw 로 제출된 SkImage 를 flush 전에 파괴하면 그 draw 가 소실된다
 * (deferredDisposal.ts §규율 — "프레임 중 캐시 퇴거의 delete 는 전부 이 큐").
 */
function destroyCachedImage(image: SkImage): void {
  for (const cb of evictionListeners) {
    cb(image); // 해제 순서: Picture → Image
  }
  scheduleWasmDisposal(image);
}

/** GPU 메모리 보호를 위한 캐시 상한 (엔트리 수) */
const MAX_CACHE_SIZE = 100;

interface CacheEntry {
  image: SkImage;
  refCount: number;
  /** 마지막 접근 시각 (LRU 퇴거용) */
  lastAccess: number;
}

// ============================================
// 이미지 자연 치수 캐시 (레이아웃 엔진용)
// ============================================

export interface ImageNaturalDimensions {
  width: number;
  height: number;
}

/** URL → 자연 치수 캐시 (이미지 로드 후 동기적 조회용)
 * HMR-resilient: window 전역에 저장하여 모듈 리로드 시에도 유지 */
const dimensionsCache: Map<string, ImageNaturalDimensions> =
  ((globalThis as Record<string, unknown>).__composition_imageDimsCache as Map<
    string,
    ImageNaturalDimensions
  >) ??
  ((globalThis as Record<string, unknown>).__composition_imageDimsCache =
    new Map<string, ImageNaturalDimensions>());

/**
 * 이미지의 자연 치수를 동기적으로 조회한다.
 * 레이아웃 엔진에서 fit-content/auto 사이징에 사용.
 * dimensionsCache에 없으면 CanvasKit cache에서 복구 시도.
 */
export function getImageNaturalDimensions(
  url: string,
): ImageNaturalDimensions | null {
  const cached = dimensionsCache.get(url);
  if (cached) return cached;

  // CanvasKit cache에 이미지가 있으면 거기서 dimensions 복구
  const entry = cache.get(url);
  if (entry) {
    const dims = { width: entry.image.width(), height: entry.image.height() };
    dimensionsCache.set(url, dims);
    return dims;
  }

  return null;
}

/** URL → CanvasKit Image 캐시 */
const cache = new Map<string, CacheEntry>();

/** 진행 중인 로딩 Promise (중복 요청 방지) */
const pending = new Map<string, Promise<SkImage | null>>();

/** 캐시 세대 번호 — clearImageCache() 시 증가하여 in-flight 결과를 무효화 (I-H5) */
let cacheGeneration = 0;

/**
 * URL에서 이미지를 로드하여 CanvasKit Image로 변환한다.
 * 캐시된 이미지가 있으면 즉시 반환한다.
 *
 * @returns CanvasKit Image 또는 null (로딩 실패)
 */
export async function loadSkImage(url: string): Promise<SkImage | null> {
  if (!url) return null;

  const requestGeneration = cacheGeneration;

  // 문서/fixture는 CanvasKit WASM 초기화와 병렬로 store에 들어올 수 있다.
  // 여기서 null로 조기 반환하면 StoreRenderBridge가 src를 이미 본 것으로
  // 기록해 같은 문서 수명 동안 재시도하지 않으므로 raster가 영구 placeholder로
  // 남는다. initCanvasKit의 전역 Promise가 중복 초기화를 막으므로 준비 완료를
  // 기다린 뒤 최초 fetch/decode를 계속한다.
  if (!isCanvasKitInitialized()) {
    try {
      await initCanvasKit();
    } catch {
      // 호출부는 fire-and-forget이며 반환 계약은 실패 시 null이다. 초기화 자체의
      // 진단은 initAllWasm 소유이므로 여기서 rejection을 다시 전파하지 않는다.
      return null;
    }
  }

  // 초기화 대기 중 canvas teardown/clear가 발생한 요청은 이후 fetch/decode로
  // 살아나면 안 된다. cache generation을 준비 대기 전부터 고정한다.
  if (cacheGeneration !== requestGeneration) {
    return null;
  }

  // 캐시 히트
  const entry = cache.get(url);
  if (entry) {
    entry.refCount++;
    entry.lastAccess = performance.now();
    return entry.image;
  }

  // 이미 로딩 중이면 대기 (refCount는 캐시 등록 후 별도 증가)
  const existing = pending.get(url);
  if (existing) {
    const genBefore = cacheGeneration;
    const image = await existing;
    // 대기 중 캐시가 초기화되었으면 stale 결과 무시 (I-H5)
    if (cacheGeneration !== genBefore) {
      return null;
    }
    if (image) {
      const cachedEntry = cache.get(url);
      if (cachedEntry) {
        cachedEntry.refCount++;
        cachedEntry.lastAccess = performance.now();
      }
    }
    return image;
  }

  const currentGeneration = cacheGeneration;
  const promise = fetchAndDecode(url);
  pending.set(url, promise);

  try {
    const image = await promise;
    pending.delete(url);

    // fetch 중 캐시가 초기화되었으면 stale 이미지 폐기 (I-H5)
    if (cacheGeneration !== currentGeneration) {
      image?.delete();
      return null;
    }

    if (image) {
      if (cache.size >= MAX_CACHE_SIZE) {
        evictLRU();
      }
      cache.set(url, { image, refCount: 1, lastAccess: performance.now() });
      // 자연 치수 캐시 저장 (레이아웃 엔진 fit-content/auto용)
      dimensionsCache.set(url, {
        width: image.width(),
        height: image.height(),
      });
      // 이미지 로딩 완료 → Canvas 재렌더 트리거 (specShapeConverter 연동)
      notifyImageLoaded();
    }
    return image;
  } catch {
    pending.delete(url);
    return null;
  }
}

/**
 * 캐시에서 동기적으로 이미지를 조회한다.
 * 로딩이 완료된 이미지만 반환한다.
 */
export function getSkImage(url: string): SkImage | null {
  const entry = cache.get(url);
  if (entry) {
    entry.lastAccess = performance.now();
  }
  return entry?.image ?? null;
}

/**
 * 이미지 참조를 해제한다.
 *
 * refCount 가 0 이 되어도 **즉시 폐기하지 않는다** — 엔트리를 캐시에 남겨
 * LRU 퇴거 후보로 둔다. 즉시 폐기하면 후보 풀이 항상 비게 되고, 그러면
 * `evictLRU` 가 아직 참조 중인 이미지를 강제 퇴거하는 경로로 떨어진다
 * (그 위험은 evictLRU 주석 참조).
 */
export function releaseSkImage(url: string): void {
  const entry = cache.get(url);
  if (!entry) return;

  entry.refCount = Math.max(0, entry.refCount - 1);
}

/** 전체 캐시 초기화 */
export function clearImageCache(): void {
  cacheGeneration++; // in-flight fetch 결과를 무효화 (I-H5)
  for (const entry of cache.values()) {
    destroyCachedImage(entry.image);
  }
  cache.clear();
  pending.clear();
  dimensionsCache.clear();
  lastOverflowWarnSize = 0;
  // 프레임 밖 일괄 정리 — 지연 큐를 곧바로 배수 (deferredDisposal.ts §drain 지점)
  drainPendingWasmDisposals();
}

/** 캐시 크기 (디버그용) */
export function getImageCacheSize(): number {
  return cache.size;
}

// 통합 해제 경로 등록 (ADR-153 Phase 2) — 캔버스 teardown 시 SkImage 전량 명시 해제
registerSkiaCacheDestroy("imageCache", clearImageCache);

// ============================================
// Internal
// ============================================

/** 상한 초과 경고 rate limit 기준선 — 프레임마다 로그가 쌓이지 않게 한다 */
let lastOverflowWarnSize = 0;

/**
 * refCount 0 인 엔트리 중 가장 오래된 것을 퇴거한다.
 *
 * **참조 중(refCount > 0)인 엔트리는 퇴거하지 않는다.** 캐시 상한은 미참조
 * 풀에 대한 정책이지 살아 있는 작업 집합에 대한 것이 아니다. 구 구현은
 * 후보가 없으면 가장 오래된 엔트리를 강제 퇴거했는데, SkImage 는
 * `SkiaNodeData.image.skImage` 에 **핸들로 저장**돼 다음 프레임에도 그려진다
 * (buildImageNodeData / specShapeConverter). 삭제된 핸들에 `.width()` 를 부르는
 * 순간 WASM 이 크래시한다 — 서로 다른 이미지 100개를 넘긴 문서에서 새 이미지를
 * 로드할 때마다 재현된다.
 *
 * 후보가 없으면 퇴거를 건너뛰고 상한을 넘긴다. 그 메모리는 문서가 실제로
 * 참조 중인 이미지 집합이고, 마지막 참조가 풀리는 순간 후보가 되어 다음
 * 삽입에서 정리된다.
 */
function evictLRU(): void {
  let oldestUnref: { url: string; entry: CacheEntry } | null = null;

  for (const [url, entry] of cache) {
    if (entry.refCount > 0) continue;
    if (!oldestUnref || entry.lastAccess < oldestUnref.entry.lastAccess) {
      oldestUnref = { url, entry };
    }
  }

  if (!oldestUnref) {
    warnCacheOverflow();
    return;
  }

  destroyCachedImage(oldestUnref.entry.image);
  cache.delete(oldestUnref.url);
}

/** 참조 중 엔트리만으로 상한을 넘긴 상황을 MAX_CACHE_SIZE 단위로 1회 알린다 */
function warnCacheOverflow(): void {
  if (cache.size < lastOverflowWarnSize + MAX_CACHE_SIZE) return;
  lastOverflowWarnSize = cache.size;
  console.warn(
    `[imageCache] 참조 중인 이미지 ${cache.size}개가 상한(${MAX_CACHE_SIZE})을 넘었습니다. ` +
      `releaseSkImage 를 부르지 않는 획득 경로가 있는지 확인하세요.`,
  );
}

async function fetchAndDecode(url: string): Promise<SkImage | null> {
  try {
    const ck: CanvasKit = getCanvasKit();

    // CORS 모드: 외부 이미지(CDN, 사용자 업로드)도 로드 가능하도록 설정
    const response = await fetch(url, {
      mode: "cors",
      credentials: "same-origin",
    });
    if (!response.ok) {
      console.warn(`[imageCache] Fetch failed: ${url} (${response.status})`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    const image = ck.MakeImageFromEncoded(data);

    if (!image) {
      console.warn(`[imageCache] Decode failed: ${url}`);
      return null;
    }

    return image;
  } catch (e) {
    console.warn(`[imageCache] Load error: ${url}`, e);
    return null;
  }
}
