/**
 * MonitorPanel Component
 *
 * 메모리 사용량 및 히스토리 모니터링 패널
 * - Memory Tab: 메모리 사용량 차트 및 통계
 * - Realtime Tab: 실시간 모니터링 (FPS, Web Vitals)
 * - 공통 PanelHeader / Section 구조로 렌더링
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import {
  Activity,
  AppWindow,
  BarChart3,
  Database,
  Files,
  History,
  MemoryStick,
  Percent,
  Zap,
} from "lucide-react";
import { iconProps, iconLarge } from "../../../utils/ui/uiConstants";
import { performanceMonitor } from "../../utils/performanceMonitor";
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
import { PanelHeader, Section, ToastContainer } from "../../components";
import { translateKey, useOptionalI18n } from "../../../i18n";

const MAX_HISTORY_POINTS = 60; // 최대 60개 데이터 포인트 (10분)

export function MonitorPanel() {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;
  const [activeTab, setActiveTab] = useState<string>("memory");
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [thresholdConfig, setThresholdConfig] =
    useState<ThresholdConfig>(loadThresholdConfig);
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
  const { stats, statusMessage, optimize, isOptimizing } = useMemoryStats({
    enabled: true,
  });

  // Phase 5: Real-time monitoring hooks (이미 enabled 지원)
  const { fps } = useFPSMonitor({ enabled: activeTab === "realtime" });
  const { vitals, collectLocalVitals } = useWebVitals({
    enabled: activeTab === "realtime",
  });

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
      showToast(
        "error",
        `메모리 사용량이 위험 수준입니다 (${percent.toFixed(1)}%)`,
      );
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
      const animationFrame = requestAnimationFrame(() => {
        setMemoryHistory((prev) => {
          const newHistory = [...prev, newValue];

          // 최대 개수 제한
          if (newHistory.length > MAX_HISTORY_POINTS) {
            return newHistory.slice(-MAX_HISTORY_POINTS);
          }
          return newHistory;
        });
      });

      return () => cancelAnimationFrame(animationFrame);
    }
  }, [stats, activeTab]);

  // 최적화 핸들러
  const handleOptimize = useCallback(() => {
    optimize();
    // 최적화 후 히스토리 리셋
    setMemoryHistory([]);
  }, [optimize]);

  return (
    <div className="panel monitor-panel">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PanelHeader
        title={i18n ? i18n.t("panels.monitor") : "Monitor"}
        icon={<Activity size={iconProps.size} aria-hidden="true" />}
        panelId="monitor"
      />

      {statusMessage && (
        <div className="monitor-status-message" role="status">
          {statusMessage}
        </div>
      )}

      <Tabs
        className="panel-tabs"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
      >
        <div className="panel-header panel-tabrow">
          <TabList
            className="panel-tablist"
            aria-label={localize("tabs", "Monitor tabs")}
          >
            <Tab id="memory" className="panel-tab">
              <MemoryStick
                color="currentColor"
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
                aria-hidden="true"
              />
              <span className="panel-tab-label">
                {localize("memory", "Memory")}
              </span>
            </Tab>
            <Tab id="realtime" className="panel-tab">
              <Zap
                color="currentColor"
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
                aria-hidden="true"
              />
              <span className="panel-tab-label">
                {localize("realtime", "Realtime")}
              </span>
            </Tab>
            <Tab id="stats" className="panel-tab">
              <Database
                color="currentColor"
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
                aria-hidden="true"
              />
              <span className="panel-tab-label">
                {localize("stats", "Stats")}
              </span>
            </Tab>
            <Tab id="browser" className="panel-tab">
              <AppWindow
                color="currentColor"
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
                aria-hidden="true"
              />
              <span className="panel-tab-label">
                {localize("browser", "Browser")}
              </span>
            </Tab>
            <Tab id="analysis" className="panel-tab">
              <BarChart3
                color="currentColor"
                strokeWidth={iconProps.strokeWidth}
                size={iconProps.size}
                aria-hidden="true"
              />
              <span className="panel-tab-label">
                {localize("analysis", "Analysis")}
              </span>
            </Tab>
          </TabList>
        </div>

        <TabPanel id="memory" className="panel-contents monitor-panel-contents">
          <Section
            id="monitor-memory-usage"
            title={localize("memoryUsage", "Memory Usage")}
          >
            {/* `.section-content` 가 이미 세로 스택 + gap 이라 래퍼를 한 겹 더 두지 않는다. */}
            {stats?.browserMemory && (
              <ThresholdIndicator
                value={memoryPercent}
                label={localize("browserMemory", "Browser Memory")}
              />
            )}
            <MemoryChart
              data={memoryHistory}
              height={100}
              threshold={50 * 1024 * 1024}
            />
          </Section>
          <Section
            id="monitor-memory-actions"
            title={localize("actions", "Actions")}
          >
            {stats && <p className="monitor-hint">{stats.recommendation}</p>}
            <div className="monitor-action-row">
              {stats && (
                <MemoryActions
                  onOptimize={handleOptimize}
                  isOptimizing={isOptimizing}
                />
              )}
              <ExportButton stats={stats} format="json" />
            </div>
          </Section>
        </TabPanel>

        <TabPanel
          id="realtime"
          className="panel-contents monitor-panel-contents"
        >
          <Section
            id="monitor-realtime-metrics"
            title={localize("realtimeMetrics", "Realtime Metrics")}
          >
            <div className="realtime-metrics-row">
              <FPSMeter fps={fps} />
              <WebVitalsCard vitals={vitals} onRefresh={collectLocalVitals} />
            </div>
          </Section>
          <Section
            id="monitor-realtime-memory"
            title={localize("memoryUsage", "Memory Usage")}
          >
            <RealtimeChart
              data={timeSeriesData}
              height={100}
              metric="memoryPercent"
              showThresholds={true}
            />
          </Section>
        </TabPanel>

        <TabPanel id="stats" className="panel-contents monitor-panel-contents">
          <Section
            id="monitor-document-stats"
            title={localize("documentStats", "Document Stats")}
          >
            <div className="fieldset-row monitor-stats-row">
              {stats && (
                <>
                  <MonitorStat
                    label={localize("pages", "Pages")}
                    value={stats.pageCount.toString()}
                    icon={<Files size={iconProps.size} />}
                  />
                  <MonitorStat
                    label={localize("historyEntries", "History Entries")}
                    value={stats.totalEntries.toString()}
                    icon={<History size={iconProps.size} />}
                  />
                  <MonitorStat
                    label={localize("memoryUsage", "Memory Usage")}
                    value={formatBytes(stats.estimatedMemoryUsage)}
                    icon={<MemoryStick size={iconProps.size} />}
                    highlight={stats.estimatedMemoryUsage > 50 * 1024 * 1024}
                  />
                </>
              )}
            </div>
          </Section>
        </TabPanel>

        <TabPanel
          id="browser"
          className="panel-contents monitor-panel-contents"
        >
          <Section
            id="monitor-browser-memory"
            title={localize("browserMemory", "Browser Memory")}
          >
            {stats?.browserMemory ? (
              <div className="fieldset-row monitor-stats-row">
                <MonitorStat
                  label={localize("usedHeap", "Used Heap")}
                  value={formatBytes(stats.browserMemory.usedJSHeapSize)}
                  icon={<MemoryStick size={iconProps.size} />}
                />
                <MonitorStat
                  label={localize("totalHeap", "Total Heap")}
                  value={formatBytes(stats.browserMemory.totalJSHeapSize)}
                  icon={<MemoryStick size={iconProps.size} />}
                />
                <MonitorStat
                  label={localize("heapLimit", "Heap Limit")}
                  value={formatBytes(stats.browserMemory.jsHeapSizeLimit)}
                  icon={<MemoryStick size={iconProps.size} />}
                />
                <MonitorStat
                  label={localize("usage", "Usage")}
                  value={`${stats.browserMemory.usagePercent.toFixed(1)}%`}
                  icon={<Percent size={iconProps.size} />}
                  highlight={stats.browserMemory.usagePercent > 75}
                />
              </div>
            ) : (
              <div className="browser-memory-fallback">
                <AppWindow size={iconLarge.size} />
                <p>
                  {localize(
                    "browserFallback",
                    "Browser memory information is only available in Chrome/Edge.",
                  )}
                </p>
              </div>
            )}
          </Section>
        </TabPanel>

        <TabPanel
          id="analysis"
          className="panel-contents monitor-panel-contents"
        >
          <Section
            id="monitor-component-memory"
            title={localize("componentMemory", "Component Memory")}
          >
            <div className="monitor-action-row">
              <ExportButton stats={stats} format="csv" />
              <ThresholdSettings
                config={thresholdConfig}
                onChange={setThresholdConfig}
              />
            </div>
            <ComponentMemoryList enabled={activeTab === "analysis"} />
          </Section>
        </TabPanel>
      </Tabs>
    </div>
  );
}

interface MonitorStatProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

/**
 * 읽기 전용 지표 한 칸 — Properties/Styles 의 필드와 같은 어법이다:
 * `fieldset.properties-aria` + `legend.fieldset-legend`(라벨) + `.react-aria-Group`(값 상자).
 *
 * 종전에는 `--bg-raised` 카드에 32px 아이콘 상자를 얹은 자체 형태라, 같은 화면에 뜨는
 * 다른 패널의 필드와 라벨 위치·상자 표면·아이콘 크기가 전부 달랐다.
 */
function MonitorStat({ label, value, icon, highlight }: MonitorStatProps) {
  return (
    <fieldset className="properties-aria monitor-stat">
      <legend className="fieldset-legend">{label}</legend>
      <div
        className="react-aria-Group monitor-stat-value"
        data-highlight={highlight ? "true" : undefined}
      >
        {icon}
        <span>{value}</span>
      </div>
    </fieldset>
  );
}
