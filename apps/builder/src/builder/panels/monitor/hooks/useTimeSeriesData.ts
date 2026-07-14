/**
 * useTimeSeriesData Hook
 *
 * 실시간 시계열 데이터 수집
 * - 주기적인 데이터 포인트 수집
 * - FIFO 방식으로 최대 포인트 수 유지
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface DataPoint {
  timestamp: number;
  memoryUsage: number; // bytes
  memoryPercent: number; // 0-100
  historyEntries: number;
}

interface UseTimeSeriesOptions {
  maxPoints?: number; // default: 60 (60초)
  intervalMs?: number; // default: 1000 (1초)
  enabled?: boolean;
}

export function useTimeSeriesData(
  getStats: () => {
    memoryUsage: number;
    memoryPercent: number;
    historyEntries: number;
  } | null,
  options: UseTimeSeriesOptions = {}
) {
  const { maxPoints = 60, intervalMs = 1000, enabled = true } = options;
  const [data, setData] = useState<DataPoint[]>([]);
  const intervalRef = useRef<number | null>(null);

  const collectPoint = useCallback(() => {
    const stats = getStats();
    if (!stats) return;

    const point: DataPoint = {
      timestamp: Date.now(),
      memoryUsage: stats.memoryUsage,
      memoryPercent: stats.memoryPercent,
      historyEntries: stats.historyEntries,
    };

    setData((prev) => {
      const newData = [...prev, point];
      // 최대 포인트 수 유지 (FIFO)
      return newData.slice(-maxPoints);
    });
  }, [getStats, maxPoints]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 첫 포인트 수집 (다음 프레임에서 실행하여 cascading render 방지)
    const timeoutId = setTimeout(collectPoint, 0);

    // 주기적 수집 시작
    intervalRef.current = window.setInterval(collectPoint, intervalMs);

    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMs, collectPoint]);

  const clearData = useCallback(() => {
    setData([]);
  }, []);

  return { data, clearData };
}
