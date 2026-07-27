/**
 * Cache Metrics Tracker (ADR-100 Phase 4)
 *
 * Dual-surface 캐시, paragraph 캐시, texture 캐시 등의 적중률 추적.
 * 개발 모드에서만 활성화 (production에서는 no-op).
 */

export interface CacheMetricsSnapshot {
  name: string;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  size: number;
  /** miss 사유별 카운트 — 사유가 1건이라도 기록된 경우에만 포함 (빈도 내림차순) */
  missReasons?: Record<string, number>;
}

export class CacheMetrics {
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private currentSize = 0;
  private missReasons = new Map<string, number>();

  constructor(readonly name: string) {}

  recordHit(): void {
    this.hits++;
  }

  /**
   * ADR-153 Phase 1-a: miss 사유 분류 (open-pencil `scenePictureMissReason` 등가).
   * 사유 없는 호출은 기존과 동일하게 카운트만 올린다.
   */
  recordMiss(reason?: string): void {
    this.misses++;
    if (reason) {
      this.missReasons.set(reason, (this.missReasons.get(reason) ?? 0) + 1);
    }
  }

  recordEviction(): void {
    this.evictions++;
  }

  setSize(size: number): void {
    this.currentSize = size;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 1 : this.hits / total;
  }

  get totalRequests(): number {
    return this.hits + this.misses;
  }

  snapshot(): CacheMetricsSnapshot {
    const snapshot: CacheMetricsSnapshot = {
      name: this.name,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(this.hitRate * 10000) / 100, // percentage with 2 decimals
      evictions: this.evictions,
      size: this.currentSize,
    };
    if (this.missReasons.size > 0) {
      snapshot.missReasons = Object.fromEntries(
        [...this.missReasons.entries()].sort((a, b) => b[1] - a[1]),
      );
    }
    return snapshot;
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.currentSize = 0;
    this.missReasons.clear();
  }
}

/** 전역 캐시 메트릭스 레지스트리 */
const registry = new Map<string, CacheMetrics>();

export function getCacheMetrics(name: string): CacheMetrics {
  let metrics = registry.get(name);
  if (!metrics) {
    metrics = new CacheMetrics(name);
    registry.set(name, metrics);
  }
  return metrics;
}

export function getAllCacheMetrics(): CacheMetricsSnapshot[] {
  return Array.from(registry.values()).map((m) => m.snapshot());
}

export function resetAllCacheMetrics(): void {
  for (const m of registry.values()) {
    m.reset();
  }
}

// DevTools 콘솔 검증용 전역 노출 (ADR-153 Phase 1-a) — dev 전용.
// window.__composition_CACHE_METRICS__.snapshotAll() / reset()
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (
    window as unknown as {
      __composition_CACHE_METRICS__?: {
        snapshotAll: typeof getAllCacheMetrics;
        reset: typeof resetAllCacheMetrics;
      };
    }
  ).__composition_CACHE_METRICS__ = {
    snapshotAll: getAllCacheMetrics,
    reset: resetAllCacheMetrics,
  };
}
