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
import { isCanvasKitInitialized, getCanvasKit } from "./initCanvasKit";
import { registerSkiaCacheDestroy } from "./disposable";

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
  if (!url || !isCanvasKitInitialized()) return null;

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
 * refCount가 0이 되면 CanvasKit Image를 삭제한다.
 */
export function releaseSkImage(url: string): void {
  const entry = cache.get(url);
  if (!entry) return;

  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.image.delete();
    cache.delete(url);
  }
}

/** 전체 캐시 초기화 */
export function clearImageCache(): void {
  cacheGeneration++; // in-flight fetch 결과를 무효화 (I-H5)
  for (const entry of cache.values()) {
    entry.image.delete();
  }
  cache.clear();
  pending.clear();
  dimensionsCache.clear();
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

/**
 * refCount가 0인 엔트리 중 가장 오래된 것을 퇴거한다.
 * refCount > 0인 엔트리만 남은 경우 가장 오래된 것을 강제 퇴거.
 */
function evictLRU(): void {
  let oldest: { url: string; entry: CacheEntry } | null = null;
  let oldestUnref: { url: string; entry: CacheEntry } | null = null;

  for (const [url, entry] of cache) {
    // refCount 0인 것 우선 퇴거
    if (entry.refCount <= 0) {
      if (!oldestUnref || entry.lastAccess < oldestUnref.entry.lastAccess) {
        oldestUnref = { url, entry };
      }
    }
    if (!oldest || entry.lastAccess < oldest.entry.lastAccess) {
      oldest = { url, entry };
    }
  }

  const target = oldestUnref ?? oldest;
  if (target) {
    target.entry.image.delete();
    cache.delete(target.url);
  }
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
