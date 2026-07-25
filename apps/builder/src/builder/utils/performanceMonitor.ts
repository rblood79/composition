/**
 * Performance Monitor
 *
 * 🚀 Phase 7: 성능 메트릭 수집 및 모니터링
 *
 * 기능:
 * - 메모리 사용량 추적 (Heap, Store, History, Cache)
 * - 렌더링 성능 측정 (FPS, Render Time)
 * - 건강 점수 계산 (0-100)
 * - 자동 경고 생성
 *
 * @since 2025-12-10 Phase 7 Performance Monitoring
 */

import { getStoreState } from "../stores";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { visitCanonicalDocumentElements } from "../stores/canonical/canonicalElementsView";
import { historyManager } from "../stores/history";
import { pageCache } from "./LRUPageCache";

// ============================================
// Types
// ============================================

export interface PerformanceMetrics {
  // 요소 통계
  elementCount: number;
  pageCount: number;
  loadedPages: number;

  // 메모리 (bytes)
  storeMemory: number;
  historyMemory: number;
  cacheMemory: number;
  browserHeapUsed: number;
  browserHeapLimit: number;
  heapUsagePercent: number;

  // 렌더링 성능
  lastRenderTime: number;
  avgRenderTime: number;
  maxRenderTime: number;
  fps: number;

  // 건강 상태
  healthScore: number;
  status: "healthy" | "warning" | "critical";
  warnings: string[];

  // 타임스탬프
  timestamp: number;
}

type StoreSnapshot = ReturnType<typeof getStoreState>;

function getActiveCanonicalElementCount(): number | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;

  const doc = canonical.documents.get(projectId);
  if (!doc) return null;

  let count = 0;
  visitCanonicalDocumentElements(doc, () => {
    count += 1;
  });
  return count;
}

function getCanonicalFirstElementCount(state: StoreSnapshot): number {
  const { elements: legacyElements } = state;
  return getActiveCanonicalElementCount() ?? legacyElements?.length ?? 0;
}

export interface PerformanceThresholds {
  /** 메모리 경고 임계값 (%) */
  memoryWarning: number;
  /** 메모리 위험 임계값 (%) */
  memoryCritical: number;
  /** 렌더링 경고 임계값 (ms) */
  renderWarning: number;
  /** 렌더링 위험 임계값 (ms) */
  renderCritical: number;
  /** FPS 경고 임계값 */
  fpsWarning: number;
  /** FPS 위험 임계값 */
  fpsCritical: number;
  /** 요소 수 경고 임계값 */
  elementCountWarning: number;
}

export type MetricsListener = (metrics: PerformanceMetrics) => void;

/** FPS 버스트 1회당 관측 프레임 수 — 구 상시 루프의 frameTimes 창과 동일 */
const FPS_BURST_FRAMES = 60;
/**
 * 버스트가 끝나지 못할 때(탭 hidden 으로 rAF 정지 등) 중단 시한.
 * 시한 초과 시 FPS 샘플 없이도 collect 는 그대로 진행한다.
 */
const FPS_BURST_TIMEOUT_MS = 1000;

// ============================================
// Performance Monitor Class
// ============================================

/**
 * 성능 모니터링 클래스
 *
 * @example
 * ```ts
 * // 메트릭 수집
 * const metrics = performanceMonitor.collect();
 * console.log(`Health: ${metrics.healthScore}%`);
 *
 * // 자동 수집 시작
 * performanceMonitor.startAutoCollect(5000);
 *
 * // 리스너 등록
 * performanceMonitor.addListener((metrics) => {
 *   if (metrics.healthScore < 50) {
 *     console.warn('Performance degraded!');
 *   }
 * });
 * ```
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics | null = null;
  private renderTimes: number[] = [];
  private frameTimes: number[] = [];
  private maxSamples = 60;
  private listeners: Set<MetricsListener> = new Set();
  private autoCollectInterval: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;
  private burstTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastFrameTime = 0;
  private enableLogs = false;

  private thresholds: PerformanceThresholds = {
    memoryWarning: 60,
    memoryCritical: 80,
    renderWarning: 50,
    renderCritical: 100,
    fpsWarning: 50,
    fpsCritical: 30,
    elementCountWarning: 5000,
  };

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    if (thresholds) {
      this.thresholds = { ...this.thresholds, ...thresholds };
    }
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * 메트릭 수집
   */
  collect(): PerformanceMetrics {
    const state = getStoreState();

    // 브라우저 메모리 API (Chrome only)
    const memory = (
      performance as Performance & {
        memory?: {
          usedJSHeapSize: number;
          jsHeapSizeLimit: number;
          totalJSHeapSize: number;
        };
      }
    ).memory;

    const browserHeapUsed = memory?.usedJSHeapSize ?? 0;
    const browserHeapLimit = memory?.jsHeapSizeLimit ?? 1;
    const heapUsagePercent = (browserHeapUsed / browserHeapLimit) * 100;

    // 메모리 추정
    const storeMemory = this.estimateStoreMemory(state);
    const historyMemory = this.getHistoryMemory();
    const cacheMemory = this.estimateCacheMemory();

    // 렌더링 성능
    const lastRenderTime = this.renderTimes[this.renderTimes.length - 1] ?? 0;
    const avgRenderTime = this.calculateAverage(this.renderTimes);
    const maxRenderTime = Math.max(...this.renderTimes, 0);
    const fps = this.calculateFPS();

    // 건강 점수 및 상태
    const elementCount = getCanonicalFirstElementCount(state);
    const healthScore = this.calculateHealthScore({
      heapUsagePercent,
      avgRenderTime,
      fps,
      elementCount,
    });

    const status = this.getStatus(healthScore);
    const warnings = this.generateWarnings({
      heapUsagePercent,
      avgRenderTime,
      fps,
      elementCount,
    });

    this.metrics = {
      elementCount,
      pageCount: state.pages?.length ?? 0,
      loadedPages: state.loadedPages?.size ?? 0,

      storeMemory,
      historyMemory,
      cacheMemory,
      browserHeapUsed,
      browserHeapLimit,
      heapUsagePercent,

      lastRenderTime,
      avgRenderTime,
      maxRenderTime,
      fps,

      healthScore,
      status,
      warnings,

      timestamp: Date.now(),
    };

    // 리스너 알림
    this.notifyListeners(this.metrics);

    return this.metrics;
  }

  /**
   * 렌더링 시간 기록
   */
  recordRenderTime(ms: number): void {
    this.renderTimes.push(ms);
    if (this.renderTimes.length > this.maxSamples) {
      this.renderTimes.shift();
    }
  }

  /**
   * 자동 수집 시작
   *
   * FPS 는 **수집 직전 짧은 rAF 버스트로만** 측정한다 (상시 루프 금지).
   * 30s 간격 기준 duty cycle 약 1.7% — 유휴 프레임 wake 를 남기지 않는다.
   */
  startAutoCollect(intervalMs = 5000): void {
    if (this.autoCollectInterval) {
      this.stopAutoCollect();
    }

    // 주기적 메트릭 수집 — 매 tick 마다 FPS 버스트 측정 후 collect
    this.autoCollectInterval = setInterval(() => {
      this.sampleFPSBurst(() => this.collect());
    }, intervalMs);

    if (this.enableLogs) {
      console.log(
        `📊 [Monitor] Auto-collect started (${intervalMs}ms interval)`,
      );
    }
  }

  /**
   * 자동 수집 중지
   */
  stopAutoCollect(): void {
    if (this.autoCollectInterval) {
      clearInterval(this.autoCollectInterval);
      this.autoCollectInterval = null;
    }

    this.cancelFPSBurst();

    if (this.enableLogs) {
      console.log("📊 [Monitor] Auto-collect stopped");
    }
  }

  /**
   * 리스너 추가
   */
  addListener(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 리스너 제거
   */
  removeListener(listener: MetricsListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 마지막 메트릭 조회
   */
  getLastMetrics(): PerformanceMetrics | null {
    return this.metrics;
  }

  /**
   * 임계값 설정
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 임계값 조회
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * 로그 출력 활성화/비활성화
   * Monitor Panel이 활성화될 때 true로 설정
   */
  setLogsEnabled(enabled: boolean): void {
    this.enableLogs = enabled;
  }

  /**
   * 로그 출력 상태 조회
   */
  isLogsEnabled(): boolean {
    return this.enableLogs;
  }

  /**
   * 렌더 시간 기록 초기화
   */
  reset(): void {
    this.renderTimes = [];
    this.frameTimes = [];
    this.metrics = null;
  }

  /**
   * 메트릭 덤프 (디버깅용)
   */
  dump(): void {
    const metrics = this.collect();
    console.log("📊 [Monitor] Performance Metrics:");
    console.log(`  Health: ${metrics.healthScore}% (${metrics.status})`);
    console.log(
      `  Memory: ${this.formatBytes(metrics.browserHeapUsed)} / ${this.formatBytes(metrics.browserHeapLimit)} (${metrics.heapUsagePercent.toFixed(1)}%)`,
    );
    console.log(`  Elements: ${metrics.elementCount}`);
    console.log(`  FPS: ${metrics.fps.toFixed(1)}`);
    console.log(`  Avg Render: ${metrics.avgRenderTime.toFixed(2)}ms`);
    if (metrics.warnings.length > 0) {
      console.log(`  Warnings: ${metrics.warnings.join(", ")}`);
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * FPS 버스트 측정 — `FPS_BURST_FRAMES` 프레임만 관측하고 스스로 종료한다.
   *
   * **Why**: 구 구현은 상시 rAF 루프로 유휴 상태에서도 초당 100+ 회 깨어나며
   * 0.5초 분량 `frameTimes` 버퍼만 갱신했다 (실제 수집은 30초에 1회 —
   * 즉 버퍼의 99% 가 버려짐). 측정 창(60 프레임)은 그대로 두고 duty cycle 만
   * 줄인다. 2026-07-26 실측: 유휴 118 wake/s → 약 2 wake/s.
   *
   * hidden 탭은 브라우저가 rAF 를 정지시키므로 `FPS_BURST_TIMEOUT_MS` 후
   * 버스트를 접고 `onComplete` 는 그대로 실행한다 (메모리 축 감시 유실 방지).
   */
  private sampleFPSBurst(onComplete: () => void): void {
    // 앞선 버스트가 아직 진행 중이면 (intervalMs < 버스트 길이) 측정만 건너뛰고
    // 수집 주기는 유지한다 — 메모리/요소 수 축 감시가 빠지지 않게
    if (this.rafId !== null || this.burstTimeout !== null) {
      onComplete();
      return;
    }

    this.frameTimes = [];
    this.lastFrameTime = 0;
    let remaining = FPS_BURST_FRAMES;

    const finish = (): void => {
      this.cancelFPSBurst();
      onComplete();
    };

    const step = (timestamp: number): void => {
      this.rafId = null;
      if (this.lastFrameTime > 0) {
        this.frameTimes.push(timestamp - this.lastFrameTime);
      }
      this.lastFrameTime = timestamp;
      remaining -= 1;

      if (remaining > 0) {
        this.rafId = requestAnimationFrame(step);
        return;
      }
      finish();
    };

    this.burstTimeout = setTimeout(finish, FPS_BURST_TIMEOUT_MS);
    this.rafId = requestAnimationFrame(step);
  }

  private cancelFPSBurst(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.burstTimeout !== null) {
      clearTimeout(this.burstTimeout);
      this.burstTimeout = null;
    }
    this.lastFrameTime = 0;
  }

  private calculateFPS(): number {
    if (this.frameTimes.length === 0) return 60;
    const avgFrameTime = this.calculateAverage(this.frameTimes);
    return avgFrameTime > 0 ? Math.min(60, 1000 / avgFrameTime) : 60;
  }

  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  private estimateStoreMemory(state: StoreSnapshot): number {
    try {
      // 대략적인 추정: 요소당 평균 500 bytes
      const elementCount = getCanonicalFirstElementCount(state);
      return elementCount * 500;
    } catch {
      return 0;
    }
  }

  private getHistoryMemory(): number {
    try {
      const stats = historyManager.getMemoryStats();
      return stats.estimatedMemoryUsage;
    } catch {
      return 0;
    }
  }

  private estimateCacheMemory(): number {
    try {
      // LRU 캐시 페이지 수 × 페이지당 평균 크기
      const stats = pageCache.getStats();
      return stats.size * 50000; // 페이지당 50KB 추정
    } catch {
      return 0;
    }
  }

  private calculateHealthScore(params: {
    heapUsagePercent: number;
    avgRenderTime: number;
    fps: number;
    elementCount: number;
  }): number {
    let score = 100;

    // 메모리 사용량 (최대 -40점)
    if (params.heapUsagePercent > this.thresholds.memoryCritical) {
      score -= 40;
    } else if (params.heapUsagePercent > this.thresholds.memoryWarning) {
      score -= 20;
    }

    // 렌더링 시간 (최대 -30점)
    if (params.avgRenderTime > this.thresholds.renderCritical) {
      score -= 30;
    } else if (params.avgRenderTime > this.thresholds.renderWarning) {
      score -= 15;
    }

    // FPS (최대 -20점)
    if (params.fps < this.thresholds.fpsCritical) {
      score -= 20;
    } else if (params.fps < this.thresholds.fpsWarning) {
      score -= 10;
    }

    // 요소 수 (최대 -10점)
    if (params.elementCount > this.thresholds.elementCountWarning) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private getStatus(healthScore: number): "healthy" | "warning" | "critical" {
    if (healthScore >= 70) return "healthy";
    if (healthScore >= 40) return "warning";
    return "critical";
  }

  private generateWarnings(params: {
    heapUsagePercent: number;
    avgRenderTime: number;
    fps: number;
    elementCount: number;
  }): string[] {
    const warnings: string[] = [];

    if (params.heapUsagePercent > this.thresholds.memoryCritical) {
      warnings.push(`메모리 위험: ${params.heapUsagePercent.toFixed(1)}%`);
    } else if (params.heapUsagePercent > this.thresholds.memoryWarning) {
      warnings.push(`메모리 경고: ${params.heapUsagePercent.toFixed(1)}%`);
    }

    if (params.avgRenderTime > this.thresholds.renderCritical) {
      warnings.push(`렌더링 위험: ${params.avgRenderTime.toFixed(0)}ms`);
    } else if (params.avgRenderTime > this.thresholds.renderWarning) {
      warnings.push(`렌더링 경고: ${params.avgRenderTime.toFixed(0)}ms`);
    }

    if (params.fps < this.thresholds.fpsCritical) {
      warnings.push(`FPS 위험: ${params.fps.toFixed(0)}`);
    } else if (params.fps < this.thresholds.fpsWarning) {
      warnings.push(`FPS 경고: ${params.fps.toFixed(0)}`);
    }

    if (params.elementCount > this.thresholds.elementCountWarning) {
      warnings.push(`요소 수 과다: ${params.elementCount}`);
    }

    return warnings;
  }

  private notifyListeners(metrics: PerformanceMetrics): void {
    this.listeners.forEach((listener) => {
      try {
        listener(metrics);
      } catch (error) {
        console.error("[Monitor] Listener error:", error);
      }
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}

// ============================================
// Singleton Instance
// ============================================

/**
 * 전역 성능 모니터 인스턴스
 */
export const performanceMonitor = new PerformanceMonitor();

// ============================================
// React Hook
// ============================================

/**
 * 성능 메트릭 훅
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const metrics = usePerformanceMetrics();
 *
 *   return (
 *     <div>
 *       <span>Health: {metrics?.healthScore}%</span>
 *       <span>FPS: {metrics?.fps.toFixed(0)}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePerformanceMetrics(): PerformanceMetrics | null {
  // Note: This is a simplified version.
  // In a real implementation, you'd use useState + useEffect with listener
  return performanceMonitor.getLastMetrics();
}
