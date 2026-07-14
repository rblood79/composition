/**
 * MonitorPanel Component
 *
 * 메모리 사용량 및 히스토리 모니터링 패널
 * - Memory Tab: 메모리 사용량 차트 및 통계
 * - Realtime Tab: 실시간 모니터링 (FPS, Web Vitals)
 * - 리사이즈 가능한 Bottom Panel에서 렌더링
 *
 * 🛡️ Gateway 패턴 적용 (2025-12-10)
 * - isActive 체크를 최상단에서 수행
 * - Content 컴포넌트 분리로 비활성 시 훅 실행 방지
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from "react-aria-components";
import { Activity, Database, Cpu, Zap, BarChart3 } from "lucide-react";
import { iconProps, iconEditProps, iconLarge } from "../../../utils/ui/uiConstants";
import { performanceMonitor } from "../../utils/performanceMonitor";
import type { PanelProps } from "../core/types";
import { useMemoryStats, formatBytes } from "./hooks/useMemoryStats";
import { useTimeSeriesData } from "./hooks/useTimeSeriesData";
import { useFPSMonitor } from "./hooks/useFPSMonitor";
import { useWebVitals } from "./hooks/useWebVitals";
import { MemoryChart } from "./components/MemoryChart";
import { MemoryActions } from "./components/MemoryActions";
import { ThresholdIndicator } from "./components/ThresholdIndicator";
import { ExportButton } from "./components/ExportButton";
import { RealtimeChart } from "./components/RealtimeChart";
import { FPSMeter } from "./components/FPSMeter";
import { WebVitalsCard } from "./components/WebVitalsCard";
import { ComponentMemoryList } from "./components/ComponentMemoryList";
import { ThresholdSettings } from "./components/ThresholdSettings";
import {
  loadThresholdConfig,
  type ThresholdConfig,
} from "./utils/thresholdConfig";
import { useToast } from "@/builder/hooks";
import { ToastContainer } from "../../components";

const MAX_HISTORY_POINTS = 60; // 최대 60개 데이터 포인트 (10분)

/**
 * MonitorPanel - Gateway 컴포넌트
 * 🛡️ isActive 체크 후 Content 렌더링
 */
export function MonitorPanel({ isActive }: PanelProps) {
  // 🛡️ Gateway: 비활성 시 즉시 반환 (훅 실행 방지)
  if (!isActive) {
    return null;
  }

  return <MonitorPanelContent />;
}

/**
 * MonitorPanelContent - 실제 콘텐츠 컴포넌트
 * 훅은 여기서만 실행됨 (isActive=true일 때만)
 */
function MonitorPanelContent() {
  const [activeTab, setActiveTab] = useState<string>("memory");
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [thresholdConfig, setThresholdConfig] = useState<ThresholdConfig>(
    loadThresholdConfig
  );
  const prevStatsRef = useRef<ReturnType<typeof useMemoryStats>["stats"]>(null);
  const { toasts, showToast, dismissToast } = useToast();

  // Monitor Panel 활성화 시 로그 출력 활성화
  useEffect(() => {
    performanceMonitor.setLogsEnabled(true);
    return () => {
      performanceMonitor.setLogsEnabled(false);
    };
  }, []);

  // 🆕 enabled 파라미터 적용
  const { stats, statusMessage, optimize, isOptimizing } = useMemoryStats({ enabled: true });

  // Phase 5: Real-time monitoring hooks (이미 enabled 지원)
  const { fps } = useFPSMonitor({ enabled: activeTab === "realtime" });
  const { vitals, collectLocalVitals } = useWebVitals({ enabled: activeTab === "realtime" });

  // Time series data for realtime chart
  const getStatsForTimeSeries = useCallback(() => {
    if (!stats) return null;
    return {
      memoryUsage: stats.estimatedMemoryUsage,
      memoryPercent: stats.browserMemory?.usagePercent ?? 0,
      historyEntries: stats.totalEntries,
    };
  }, [stats]);

  const { data: timeSeriesData } = useTimeSeriesData(getStatsForTimeSeries, {
    enabled: activeTab === "realtime",
    maxPoints: 60,
    intervalMs: 1000,
  });

  // 브라우저 메모리 사용량 백분율 계산
  const memoryPercent = stats?.browserMemory?.usagePercent ?? 0;
  const browserMemoryUsagePercent = stats?.browserMemory?.usagePercent;

  // Threshold 경고 알림 (activeTab이 memory일 때만)
  useEffect(() => {
    if (browserMemoryUsagePercent === undefined) return;
    if (activeTab !== "memory") return; // 🛡️ 탭 가드 추가

    const percent = browserMemoryUsagePercent;

    if (percent >= 75) {
      showToast("error", `메모리 사용량이 위험 수준입니다 (${percent.toFixed(1)}%)`);
    } else if (percent >= 60) {
      showToast("warning", `메모리 사용량이 높습니다 (${percent.toFixed(1)}%)`);
    }
  }, [browserMemoryUsagePercent, activeTab, showToast]);

  // 메모리 히스토리 수집 (memory 탭에서만)
  useEffect(() => {
    if (!stats) return;
    if (activeTab !== "memory") return; // 🛡️ 탭 가드 추가

    // 이전 값과 비교하여 실제로 변경된 경우에만 업데이트
    const prevValue = prevStatsRef.current?.estimatedMemoryUsage;
    const newValue = stats.estimatedMemoryUsage;

    if (prevValue !== newValue) {
      prevStatsRef.current = stats;

      // requestAnimationFrame으로 다음 프레임에 업데이트
      requestAnimationFrame(() => {
        setMemoryHistory((prev) => {
          const newHistory = [...prev, newValue];

          // 최대 개수 제한
          if (newHistory.length > MAX_HISTORY_POINTS) {
            return newHistory.slice(-MAX_HISTORY_POINTS);
          }
          return newHistory;
        });
      });
    }
  }, [stats, activeTab]);

  // 최적화 핸들러
  const handleOptimize = useCallback(() => {
    optimize();
    // 최적화 후 히스토리 리셋
    setMemoryHistory([]);
  }, [optimize]);

  return (
    <div className="monitor-panel">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Status Message */}
      {statusMessage && (
        <div className="monitor-status-message">
          {statusMessage}
        </div>
      )}

      <Tabs
        className="monitor-tabs"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
      >
        <TabList className="monitor-tab-list" aria-label="Monitor tabs">
          <Tab id="memory" className="monitor-tab">
            <Activity size={iconEditProps.size} />
            <span>Memory</span>
          </Tab>
          <Tab id="realtime" className="monitor-tab">
            <Zap size={iconEditProps.size} />
            <span>Realtime</span>
          </Tab>
          <Tab id="stats" className="monitor-tab">
            <Database size={iconEditProps.size} />
            <span>Stats</span>
          </Tab>
          <Tab id="browser" className="monitor-tab">
            <Cpu size={iconEditProps.size} />
            <span>Browser</span>
          </Tab>
          <Tab id="analysis" className="monitor-tab">
            <BarChart3 size={iconEditProps.size} />
            <span>Analysis</span>
          </Tab>
        </TabList>

        {/* Memory Tab */}
        <TabPanel id="memory" className="monitor-tab-panel">
          <div className="memory-tab-content">
            {/* Threshold Indicator */}
            {stats?.browserMemory && (
              <ThresholdIndicator
                value={memoryPercent}
                label="Browser Memory"
              />
            )}

            <div className="memory-chart-section">
              <MemoryChart
                data={memoryHistory}
                width={380}
                height={100}
                threshold={50 * 1024 * 1024} // 50MB
              />
            </div>

            <div className="memory-actions-row">
              {stats && (
                <MemoryActions
                  onOptimize={handleOptimize}
                  recommendation={stats.recommendation}
                  isOptimizing={isOptimizing}
                />
              )}
              <ExportButton stats={stats} format="json" />
            </div>
          </div>
        </TabPanel>

        {/* Realtime Tab */}
        <TabPanel id="realtime" className="monitor-tab-panel">
          <div className="realtime-tab-content">
            {/* FPS & Web Vitals Row */}
            <div className="realtime-metrics-row">
              <FPSMeter fps={fps} />
              <WebVitalsCard vitals={vitals} onRefresh={collectLocalVitals} />
            </div>

            {/* Realtime Chart */}
            <div className="realtime-chart-section">
              <div className="realtime-chart-header">
                <span className="realtime-chart-title">Memory Usage (Real-time)</span>
              </div>
              <RealtimeChart
                data={timeSeriesData}
                width={380}
                height={100}
                metric="memoryPercent"
                showThresholds={true}
              />
            </div>
          </div>
        </TabPanel>

        {/* Stats Tab */}
        <TabPanel id="stats" className="monitor-tab-panel">
          <div className="stats-grid">
            {stats && (
              <>
                <StatCard
                  label="Pages"
                  value={stats.pageCount.toString()}
                  icon={<Database size={iconProps.size} />}
                />
                <StatCard
                  label="History Entries"
                  value={stats.totalEntries.toString()}
                  icon={<Activity size={iconProps.size} />}
                />
                <StatCard
                  label="Memory Usage"
                  value={formatBytes(stats.estimatedMemoryUsage)}
                  icon={<Cpu size={iconProps.size} />}
                  highlight={stats.estimatedMemoryUsage > 50 * 1024 * 1024}
                />
              </>
            )}
          </div>
        </TabPanel>

        {/* Browser Tab */}
        <TabPanel id="browser" className="monitor-tab-panel">
          {stats?.browserMemory ? (
            <div className="stats-grid">
              <StatCard
                label="Used Heap"
                value={formatBytes(stats.browserMemory.usedJSHeapSize)}
                icon={<Cpu size={iconProps.size} />}
              />
              <StatCard
                label="Total Heap"
                value={formatBytes(stats.browserMemory.totalJSHeapSize)}
                icon={<Cpu size={iconProps.size} />}
              />
              <StatCard
                label="Heap Limit"
                value={formatBytes(stats.browserMemory.jsHeapSizeLimit)}
                icon={<Cpu size={iconProps.size} />}
              />
              <StatCard
                label="Usage"
                value={`${stats.browserMemory.usagePercent.toFixed(1)}%`}
                icon={<Activity size={iconProps.size} />}
                highlight={stats.browserMemory.usagePercent > 75}
              />
            </div>
          ) : (
            <div className="browser-memory-fallback">
              <Cpu size={iconLarge.size} />
              <p>Browser memory information is only available in Chrome/Edge.</p>
            </div>
          )}
        </TabPanel>

        {/* Analysis Tab */}
        <TabPanel id="analysis" className="monitor-tab-panel">
          <div className="analysis-tab-content">
            <div className="analysis-actions-row">
              <ExportButton stats={stats} format="csv" />
              <ThresholdSettings
                config={thresholdConfig}
                onChange={setThresholdConfig}
              />
            </div>
            <ComponentMemoryList enabled={activeTab === "analysis"} />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

function StatCard({ label, value, icon, highlight }: StatCardProps) {
  return (
    <div className={`stat-card ${highlight ? "highlight" : ""}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
