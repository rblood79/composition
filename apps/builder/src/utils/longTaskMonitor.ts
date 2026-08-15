/**
 * Long Task Monitor
 *
 * 🚀 Phase 9: 측정/가드레일 인프라
 *
 * 기능:
 * - Long Task 자동 감지 (PerformanceObserver)
 * - 함수 실행 시간 측정 (measure)
 * - 비동기 함수 측정 (measureAsync)
 * - 통계 리포트 (avg, max, p95, p99)
 * - postMessage 페이로드 모니터링
 * - 임계값 초과 시 경고
 *
 * @since 2025-12-18 Phase 9
 */

// ============================================
// Types
// ============================================

export interface MetricStats {
  count: number;
  avg: number;
  max: number;
  min: number;
  p95: number;
  p99: number;
  total: number;
}

export interface LongTaskReport {
  metrics: Record<string, MetricStats>;
  longTaskCount: number;
  longTaskTotalDuration: number;
  postMessageStats: {
    count: number;
    totalSizeKB: number;
    avgSizeBytes: number;
  };
  startTime: number;
  reportTime: number;
  durationSeconds: number;
}

export interface ThresholdConfig {
  /** 기본 임계값 (ms) - 이 값 초과 시 경고 */
  default: number;
  /** 작업별 커스텀 임계값 */
  custom: Record<string, number>;
}

// ============================================
// Constants
// ============================================

const SIXTY_HZ_FRAME_BUDGET_MS = 1000 / 60;

/** 기본 성능 임계값 설정 */
const DEFAULT_THRESHOLDS: ThresholdConfig = {
  default: 50, // 50ms 기본 임계값
  custom: {
    // 시나리오별 SLO
    "click-select": 50,
    "multi-select": 80,
    "property-edit": 50,
    "undo-redo": 50,
    "page-switch": 100,
    "element-add": 50,
    "element-remove": 50,
    "drag-move": SIXTY_HZ_FRAME_BUDGET_MS,
    "overlay-update": SIXTY_HZ_FRAME_BUDGET_MS,
    "message-handler": 50,
  },
};

/** 메트릭 히스토리 최대 크기 */
const MAX_METRIC_HISTORY = 1000;

// ============================================
// LongTaskMonitor Class
// ============================================

/**
 * Long Task 모니터링 클래스
 *
 * 사용법:
 * ```typescript
 * import { longTaskMonitor } from '@/utils/longTaskMonitor';
 *
 * // 동기 함수 측정
 * const result = longTaskMonitor.measure('click-select', () => {
 *   return handleElementClick(elementId);
 * });
 *
 * // 비동기 함수 측정
 * const data = await longTaskMonitor.measureAsync('api-call', async () => {
 *   return await fetchData();
 * });
 *
 * // 수동 측정 (시작/끝)
 * const end = longTaskMonitor.start('complex-operation');
 * // ... 복잡한 작업 ...
 * end(); // 측정 종료
 *
 * // 리포트 출력
 * console.table(longTaskMonitor.report().metrics);
 * ```
 */
class LongTaskMonitor {
  private metrics = new Map<string, number[]>();
  private longTaskCount = 0;
  private longTaskTotalDuration = 0;
  private postMessageCount = 0;
  private postMessageTotalSize = 0;
  private startTime = Date.now();
  private thresholds: ThresholdConfig;
  private enabled: boolean;
  private verbose: boolean = false; // console.warn 출력 여부 (기본: 비활성화)
  private observer: PerformanceObserver | null = null;

  constructor(thresholds: ThresholdConfig = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
    this.enabled = import.meta.env.DEV;
  }

  initialize(): void {
    if (!this.enabled || this.observer) return;
    this.setupLongTaskObserver();
  }

  // ============================================
  // Long Task Observer
  // ============================================

  /**
   * Long Task 자동 감지 설정
   * Long Task: 50ms 이상 걸리는 작업 (브라우저 정의)
   */
  private setupLongTaskObserver(): void {
    if (typeof PerformanceObserver === "undefined") {
      console.warn("[LongTaskMonitor] PerformanceObserver not supported");
      return;
    }

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTaskCount++;
          this.longTaskTotalDuration += entry.duration;

          // Long Task 경고 (개발 모드) - 기본적으로 비활성화
          // console.warn 자체가 Long Task를 유발할 수 있으므로 필요시에만 활성화
          // longTaskMonitor.setVerbose(true) 로 활성화 가능
        }
      });

      this.observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // longtask가 지원되지 않는 브라우저
      console.warn("[LongTaskMonitor] longtask observation not supported");
    }
  }

  // ============================================
  // Measurement Methods
  // ============================================

  /**
   * 동기 함수 실행 시간 측정
   *
   * @param name - 측정 이름 (예: 'click-select', 'property-edit')
   * @param fn - 측정할 함수
   * @returns 함수 반환값
   */
  measure<T>(name: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.recordMetric(name, duration);
    return result;
  }

  /**
   * 비동기 함수 실행 시간 측정
   *
   * @param name - 측정 이름
   * @param fn - 측정할 비동기 함수
   * @returns Promise 반환값
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.recordMetric(name, duration);
    return result;
  }

  /**
   * 수동 측정 시작 (종료 함수 반환)
   *
   * @param name - 측정 이름
   * @returns 종료 함수 (호출 시 측정 완료)
   *
   * @example
   * ```typescript
   * const end = longTaskMonitor.start('complex-op');
   * // ... 작업 ...
   * end(); // 측정 종료
   * ```
   */
  start(name: string): () => void {
    if (!this.enabled) {
      return () => {};
    }

    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
    };
  }

  /**
   * 메트릭 기록 (내부 함수)
   */
  private recordMetric(name: string, duration: number): void {
    // 히스토리에 추가
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const history = this.metrics.get(name)!;
    history.push(duration);

    // 히스토리 크기 제한
    if (history.length > MAX_METRIC_HISTORY) {
      history.shift();
    }

    // 임계값 초과 시 경고 - verbose 모드일 때만 출력
    // console.warn 자체가 Long Task를 유발할 수 있으므로 기본 비활성화
    if (this.verbose) {
      const threshold = this.thresholds.custom[name] ?? this.thresholds.default;
      if (duration > threshold) {
        console.warn(
          `[Perf] ${name}: ${duration.toFixed(1)}ms (> ${threshold}ms threshold)`,
        );
      }
    }
  }

  // ============================================
  // postMessage Monitoring
  // ============================================

  /**
   * postMessage 호출 기록
   *
   * @param payloadSize - 페이로드 크기 (bytes)
   */
  recordPostMessage(payloadSize: number): void {
    if (!this.enabled) return;

    this.postMessageCount++;
    this.postMessageTotalSize += payloadSize;

    // 100회마다 로그 (너무 많은 로그 방지)
    if (this.postMessageCount % 100 === 0) {
      console.log(
        `[postMessage] count: ${this.postMessageCount}, ` +
          `total: ${(this.postMessageTotalSize / 1024).toFixed(1)}KB, ` +
          `avg: ${(this.postMessageTotalSize / this.postMessageCount).toFixed(0)}B`,
      );
    }
  }

  // ============================================
  // Reporting
  // ============================================

  /**
   * 성능 리포트 생성
   *
   * @returns 전체 성능 통계
   */
  report(): LongTaskReport {
    const metricsReport: Record<string, MetricStats> = {};

    for (const [name, values] of this.metrics) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);

      metricsReport[name] = {
        count: values.length,
        avg: sum / values.length,
        max: sorted[sorted.length - 1],
        min: sorted[0],
        p95:
          sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
        p99:
          sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1],
        total: sum,
      };
    }

    const now = Date.now();
    return {
      metrics: metricsReport,
      longTaskCount: this.longTaskCount,
      longTaskTotalDuration: this.longTaskTotalDuration,
      postMessageStats: {
        count: this.postMessageCount,
        totalSizeKB: this.postMessageTotalSize / 1024,
        avgSizeBytes:
          this.postMessageCount > 0
            ? this.postMessageTotalSize / this.postMessageCount
            : 0,
      },
      startTime: this.startTime,
      reportTime: now,
      durationSeconds: (now - this.startTime) / 1000,
    };
  }

  /**
   * 콘솔에 리포트 출력
   */
  printReport(): void {
    const report = this.report();

    console.group("📊 Long Task Monitor Report");
    console.log(`Duration: ${report.durationSeconds.toFixed(1)}s`);
    console.log(
      `Long Tasks: ${report.longTaskCount} (total: ${report.longTaskTotalDuration.toFixed(0)}ms)`,
    );
    console.log(
      `postMessage: ${report.postMessageStats.count} calls, ` +
        `${report.postMessageStats.totalSizeKB.toFixed(1)}KB total`,
    );

    if (Object.keys(report.metrics).length > 0) {
      console.log("\nMetrics:");
      console.table(
        Object.fromEntries(
          Object.entries(report.metrics).map(([name, stats]) => [
            name,
            {
              count: stats.count,
              avg: `${stats.avg.toFixed(1)}ms`,
              max: `${stats.max.toFixed(1)}ms`,
              p95: `${stats.p95.toFixed(1)}ms`,
            },
          ]),
        ),
      );
    }

    console.groupEnd();
  }

  // ============================================
  // Control Methods
  // ============================================

  /**
   * 모니터링 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Verbose 모드 설정 (console.warn 출력 여부)
   * 기본값: false (성능 영향 방지)
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * 통계 초기화
   */
  reset(): void {
    this.metrics.clear();
    this.longTaskCount = 0;
    this.longTaskTotalDuration = 0;
    this.postMessageCount = 0;
    this.postMessageTotalSize = 0;
    this.startTime = Date.now();
  }

  /**
   * 특정 메트릭 조회
   */
  getMetric(name: string): MetricStats | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      avg: sum / values.length,
      max: sorted[sorted.length - 1],
      min: sorted[0],
      p95:
        sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
      p99:
        sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1],
      total: sum,
    };
  }

  /**
   * Long Task 통계만 조회
   */
  getLongTaskStats(): {
    count: number;
    totalDuration: number;
    avgDuration: number;
  } {
    return {
      count: this.longTaskCount,
      totalDuration: this.longTaskTotalDuration,
      avgDuration:
        this.longTaskCount > 0
          ? this.longTaskTotalDuration / this.longTaskCount
          : 0,
    };
  }

  /**
   * 임계값 설정
   */
  setThreshold(name: string, threshold: number): void {
    this.thresholds.custom[name] = threshold;
  }

  /**
   * 정리 (옵저버 해제)
   */
  cleanup(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const longTaskMonitor = new LongTaskMonitor();

// ============================================
// Convenience Functions
// ============================================

/**
 * 동기 함수 측정 (단축 함수)
 */
export function measure<T>(name: string, fn: () => T): T {
  return longTaskMonitor.measure(name, fn);
}

/**
 * 비동기 함수 측정 (단축 함수)
 */
export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return longTaskMonitor.measureAsync(name, fn);
}

/**
 * 수동 측정 시작 (단축 함수)
 */
export function startMeasure(name: string): () => void {
  return longTaskMonitor.start(name);
}

// ============================================
// DevTools Integration
// ============================================

export function initLongTaskMonitorDiagnostics(): void {
  longTaskMonitor.initialize();
  if (!import.meta.env.DEV || typeof window === "undefined") return;

  (window as unknown as { longTaskMonitor: LongTaskMonitor }).longTaskMonitor =
    longTaskMonitor;
}
