/**
 * useFPSMonitor Hook
 *
 * 프레임 레이트 모니터링
 * - requestAnimationFrame 기반 FPS 측정
 * - 통계 (current, average, min, max) 계산
 * - 히스토리 추적
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface FPSData {
  current: number;
  average: number;
  min: number;
  max: number;
  history: number[]; // 최근 60개
}

interface UseFPSMonitorOptions {
  enabled?: boolean;
  historySize?: number;
}

export function useFPSMonitor(options: UseFPSMonitorOptions = {}) {
  const { enabled = true, historySize = 60 } = options;

  const [fps, setFPS] = useState<FPSData>({
    current: 0,
    average: 0,
    min: 60,
    max: 0,
    history: [],
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const enabledRef = useRef(enabled);
  const historySizeRef = useRef(historySize);

  // Keep refs updated
  useEffect(() => {
    enabledRef.current = enabled;
    historySizeRef.current = historySize;
  }, [enabled, historySize]);

  useEffect(() => {
    if (!enabled) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    // Initialize lastTimeRef on first enable
    lastTimeRef.current = performance.now();

    function measureFrame() {
      const now = performance.now();
      frameCountRef.current++;
      const elapsed = now - lastTimeRef.current;

      // 1초마다 FPS 계산
      if (elapsed >= 1000) {
        const currentFPS = Math.round((frameCountRef.current * 1000) / elapsed);

        // 히스토리 업데이트
        historyRef.current = [
          ...historyRef.current.slice(-(historySizeRef.current - 1)),
          currentFPS,
        ];

        // 통계 계산
        const history = historyRef.current;
        const average = Math.round(
          history.reduce((a, b) => a + b, 0) / history.length,
        );
        const min = Math.min(...history);
        const max = Math.max(...history);

        setFPS({
          current: currentFPS,
          average,
          min,
          max,
          history: [...history],
        });

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      if (enabledRef.current) {
        rafIdRef.current = requestAnimationFrame(measureFrame);
      }
    }

    rafIdRef.current = requestAnimationFrame(measureFrame);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled]);

  const reset = useCallback(() => {
    historyRef.current = [];
    setFPS({
      current: 0,
      average: 0,
      min: 60,
      max: 0,
      history: [],
    });
  }, []);

  return { fps, reset };
}
