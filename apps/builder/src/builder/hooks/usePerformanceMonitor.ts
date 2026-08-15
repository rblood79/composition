/**
 * Performance Monitor Hook
 *
 * 🚀 Phase 9.3: React 통합 훅
 *
 * 기능:
 * - 컴포넌트 렌더 시간 측정
 * - 콜백 함수 측정
 * - 리포트 접근
 * - 자동 cleanup
 *
 * @since 2025-12-18 Phase 9.3
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { longTaskMonitor, type MetricStats } from "../../utils/longTaskMonitor";
import { postMessageMonitor } from "../../utils/postMessageMonitor";

const SIXTY_HZ_FRAME_BUDGET_MS = 1000 / 60;

// ============================================
// Types
// ============================================

export interface PerformanceHookReturn {
  /** 동기 함수 측정 */
  measure: <T>(name: string, fn: () => T) => T;
  /** 비동기 함수 측정 */
  measureAsync: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  /** 수동 측정 시작 */
  startMeasure: (name: string) => () => void;
  /** 특정 메트릭 조회 */
  getMetric: (name: string) => MetricStats | null;
  /** 리포트 출력 */
  printReport: () => void;
  /** 통계 초기화 */
  reset: () => void;
}

// ============================================
// Hook: usePerformanceMonitor
// ============================================

/**
 * 성능 모니터링 훅
 *
 * @param componentName - 컴포넌트 이름 (렌더 시간 추적용)
 * @returns 측정 함수들
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const perf = usePerformanceMonitor('MyComponent');
 *
 *   const handleClick = useCallback(() => {
 *     perf.measure('click-handler', () => {
 *       // 클릭 처리
 *     });
 *   }, [perf]);
 *
 *   const handleFetch = useCallback(async () => {
 *     await perf.measureAsync('api-fetch', async () => {
 *       // API 호출
 *     });
 *   }, [perf]);
 *
 *   return <button onClick={handleClick}>Click</button>;
 * }
 * ```
 */
export function usePerformanceMonitor(
  componentName?: string,
): PerformanceHookReturn {
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  // 🚀 렌더 시작 시간 기록: useLayoutEffect로 이동 (렌더링 중 불순 함수 호출 금지)
  useLayoutEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current++;
  });

  // 렌더 완료 시 측정 (useEffect는 렌더 후 실행)
  useEffect(() => {
    if (componentName && import.meta.env.DEV) {
      const renderTime = performance.now() - renderStartRef.current;
      longTaskMonitor.measure(`render:${componentName}`, () => {
        // 이미 렌더 완료됨, 시간만 기록
        if (renderTime > SIXTY_HZ_FRAME_BUDGET_MS) {
          // 60Hz 호환성 frame budget 초과 시 기록
          console.debug(
            `[Render] ${componentName} took ${renderTime.toFixed(1)}ms (render #${renderCountRef.current})`,
          );
        }
      });
    }
  });

  // 측정 함수들 (메모이즈)
  const measure = useCallback(<T>(name: string, fn: () => T): T => {
    return longTaskMonitor.measure(name, fn);
  }, []);

  const measureAsync = useCallback(
    async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      return longTaskMonitor.measureAsync(name, fn);
    },
    [],
  );

  const startMeasure = useCallback((name: string): (() => void) => {
    return longTaskMonitor.start(name);
  }, []);

  const getMetric = useCallback((name: string): MetricStats | null => {
    return longTaskMonitor.getMetric(name);
  }, []);

  const printReport = useCallback(() => {
    console.group("📊 Combined Performance Report");
    longTaskMonitor.printReport();
    postMessageMonitor.printReport();
    console.groupEnd();
  }, []);

  const reset = useCallback(() => {
    longTaskMonitor.reset();
    postMessageMonitor.reset();
  }, []);

  return {
    measure,
    measureAsync,
    startMeasure,
    getMetric,
    printReport,
    reset,
  };
}

// ============================================
// Hook: useMeasuredCallback
// ============================================

/**
 * 자동 측정되는 콜백 훅
 *
 * @param name - 측정 이름
 * @param callback - 원본 콜백 함수
 * @param deps - 의존성 배열
 * @returns 측정 래핑된 콜백
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const handleClick = useMeasuredCallback(
 *     'button-click',
 *     (event) => {
 *       // 클릭 처리
 *     },
 *     []
 *   );
 *
 *   return <button onClick={handleClick}>Click</button>;
 * }
 * ```
 */
export function useMeasuredCallback<T extends (...args: unknown[]) => unknown>(
  name: string,
  callback: T,
  _deps: React.DependencyList,
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const measuredCallback = useCallback(
    (...args: Parameters<T>) => {
      return longTaskMonitor.measure(name, () => callbackRef.current(...args));
    },
    [name],
  ) as T;

  return measuredCallback;
}

// ============================================
// Hook: useMeasuredEffect
// ============================================

/**
 * 자동 측정되는 Effect 훅
 *
 * @param name - 측정 이름
 * @param effect - Effect 함수
 * @param deps - 의존성 배열
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useMeasuredEffect(
 *     'data-sync',
 *     () => {
 *       // 동기화 작업
 *       return () => {
 *         // cleanup
 *       };
 *     },
 *     [data]
 *   );
 * }
 * ```
 */
export function useMeasuredEffect(
  name: string,
  effect: React.EffectCallback,
  deps: React.DependencyList,
): void {
  useEffect(() => {
    const end = longTaskMonitor.start(name);
    const cleanup = effect();
    end();

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ============================================
// Utility: withPerformanceMonitoring HOC
// ============================================

/**
 * 성능 모니터링 HOC
 *
 * @param Component - 래핑할 컴포넌트
 * @param componentName - 컴포넌트 이름
 * @returns 모니터링이 추가된 컴포넌트
 *
 * @example
 * ```tsx
 * const MonitoredList = withPerformanceMonitoring(List, 'List');
 *
 * function App() {
 *   return <MonitoredList items={items} />;
 * }
 * ```
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    usePerformanceMonitor(componentName);
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `Monitored(${componentName})`;
  return WrappedComponent;
}
