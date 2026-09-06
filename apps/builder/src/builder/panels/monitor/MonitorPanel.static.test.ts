import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function readMonitorSource(file: string): Promise<string> {
  return readFile(resolve(__dirname, file), "utf-8");
}

describe("MonitorPanel common panel contract", () => {
  it("uses the shared panel shell, header, contents, and sections", async () => {
    const source = await readMonitorSource("MonitorPanel.tsx");

    expect(source).toContain('className="panel monitor-panel"');
    expect(source).toContain("<PanelHeader");
    expect(source).toContain('i18n.t("panels.monitor")');
    expect(source).toContain('panelId="monitor"');
    // 탭 패널 골격은 Styles/Navigator/DataTable 과 같다 — `Tabs` 가 `.panel-header.panel-tabrow`
    // 와 `TabPanel`(= `panelContents()` 합성) 을 감싸고, 스크롤은 각 `TabPanel` 이 갖는다.
    // 종전에는 `.panel-contents` 가 `Tabs` 를 감싸고 `TabPanel` 은 로컬 클래스라
    // 탭 줄까지 본문 패딩·배경을 받고 스크롤이 두 번 정의됐다.
    expect(source).not.toContain("monitor-tab-panel");
    expect(
      source.match(/<TabPanel[^>]*className=\{panelContents\(/g),
    ).toHaveLength(5);
    expect(source.match(/<Section/g)).toHaveLength(7);
    // 섹션은 id 로 접힘 상태를 저장한다 (다른 패널과 동일) — 전부 collapsible={false} 아님.
    expect(source).not.toContain("collapsible={false}");
    expect(source.match(/id="monitor-[a-z-]+"/g)).toHaveLength(7);
    // 읽기 전용 지표는 패널 필드 어법 (fieldset + legend + react-aria-Group).
    expect(source).toContain('className="properties-aria monitor-stat"');
    expect(source).toContain('className="fieldset-legend"');
    expect(source).toContain('className="react-aria-Group monitor-stat-value"');
    expect(source).not.toContain("stat-card");
    expect(source).not.toContain("stats-grid");
    expect(source).not.toContain("PanelProps");
    // Realtime 지표는 5칸 한 격자다 (FPS + Core Web Vitals 4종).
    expect(source).toContain("<RealtimeMetrics");
    expect(source).not.toContain("<FPSMeter");
    expect(source).not.toContain("<WebVitalsCard");
  });

  it("keeps tabs and charts responsive to the placed panel width", async () => {
    const [
      panel,
      memoryChart,
      realtimeChart,
      responsiveChartWidth,
      css,
      panelConfigs,
    ] = await Promise.all([
      readMonitorSource("MonitorPanel.tsx"),
      readMonitorSource("components/MemoryChart.tsx"),
      readMonitorSource("components/RealtimeChart.tsx"),
      readMonitorSource("components/useResponsiveChartWidth.ts"),
      readMonitorSource("monitor-panel.css"),
      readMonitorSource("../core/panelConfigs.ts"),
    ]);

    expect(panel).not.toContain("width={380}");
    expect(memoryChart).toContain('width="100%"');
    expect(memoryChart).toContain("useResponsiveChartWidth(width)");
    expect(memoryChart).not.toContain('preserveAspectRatio="none"');
    expect(realtimeChart).toContain('width="100%"');
    expect(realtimeChart).toContain("useResponsiveChartWidth(width)");
    expect(realtimeChart).not.toContain('preserveAspectRatio="none"');
    expect(responsiveChartWidth).toContain("new ResizeObserver");
    expect(responsiveChartWidth).toContain("getBoundingClientRect().width");
    expect(css).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
    expect(css).toContain("container-type: inline-size");
    expect(css).toContain("@container (max-width: 300px)");
    expect(css).not.toMatch(
      /@container \(max-width: 300px\)[\s\S]*?\.monitor-tab > span\s*\{[^}]*display:\s*none/s,
    );
    expect(panelConfigs).toMatch(
      /id: "monitor",[\s\S]*?minWidth: 233,[\s\S]*?defaultWidth: 600,/,
    );
  });

  it("uses shared accessible controls for analysis and threshold settings", async () => {
    const [componentList, thresholdSettings] = await Promise.all([
      readMonitorSource("components/ComponentMemoryList.tsx"),
      readMonitorSource("components/ThresholdSettings.tsx"),
    ]);

    expect(componentList).toContain("<PropertySelect");
    expect(componentList).toContain("<ActionIconButton");
    expect(componentList).toContain(
      'className="list-group list-group--stack component-memory-items"',
    );
    expect(componentList).toContain(
      'className="list-item component-memory-item"',
    );
    expect(componentList).toContain('className="list-item-icon"');
    expect(componentList).toContain('className="list-item-content"');
    expect(componentList).toContain('className="list-item-name"');
    expect(componentList).toContain('className="list-item-meta"');
    expect(componentList).toContain(
      'className="list-item-badge component-memory-share"',
    );
    expect(componentList).not.toContain("component-memory-item-stats");
    expect(componentList).not.toContain("component-stat");
    const listGroupCss = await readMonitorSource(
      "../../components/styles/list-group.css",
    );
    expect(listGroupCss).toContain(".list-group--stack");
    expect(listGroupCss).toContain(".list-group--stack .list-item");
    expect(componentList).not.toMatch(/<select\b/);
    expect(componentList).not.toMatch(/<button\b/);

    expect(thresholdSettings).toContain("<DialogTrigger");
    expect(thresholdSettings).toContain("<Popover");
    expect(thresholdSettings).toContain("<Dialog");
    expect(thresholdSettings).toContain("<PropertySlider");
    expect(thresholdSettings).toContain("<ActionIconButton");
    expect(thresholdSettings).not.toMatch(/<input\b/);
    expect(thresholdSettings).not.toContain("threshold-settings-popup");
  });

  it("Realtime 지표 5칸이 패널 필드 어법을 쓴다", async () => {
    const [metrics, css] = await Promise.all([
      readMonitorSource("components/RealtimeMetrics.tsx"),
      readMonitorSource("monitor-panel.css"),
    ]);

    // FPS + LCP/CLS/FID/TTFB — 순서까지 고정 (한 격자에 같은 크기).
    expect(metrics.match(/key: "(fps|lcp|cls|inp|ttfb)"/g)).toEqual([
      'key: "fps"',
      'key: "lcp"',
      'key: "cls"',
      'key: "inp"',
      'key: "ttfb"',
    ]);
    expect(metrics).toContain('className="fieldset-row monitor-metrics-row"');
    expect(metrics).toContain('className="properties-aria monitor-metric"');
    expect(metrics).toContain('className="fieldset-legend"');
    expect(metrics).toContain(
      'className="react-aria-Group monitor-metric-value"',
    );
    expect(css).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
  });

  it("scopes Monitor visuals and removes the legacy global selectors", async () => {
    const css = await readMonitorSource("monitor-panel.css");

    expect(css).not.toContain(".component-memory-item-stats");
    expect(css).not.toContain(".component-stat");
    expect(css).not.toContain(".component-tag");
    expect(css).not.toContain(".popup-header");
    expect(css).not.toContain(".popup-content");
    expect(css).not.toContain(".popup-footer");
    expect(css).not.toContain(".btn-primary");
    expect(css).not.toContain(".btn-secondary");
    // 자체 카드 어법으로 되돌아가지 않는다 — 지표는 공용 필드, 액션은 공용 버튼.
    expect(css).not.toContain(".stat-card");
    expect(css).not.toContain(".stats-grid");
    expect(css).not.toContain(".memory-actions-row");
    expect(css).not.toContain(".memory-tab-content");
    expect(css).not.toContain(".analysis-actions-row");
    // Realtime 5칸 — FPS 카드 + Vitals 카드 두 어법으로 되돌아가지 않는다.
    expect(css).not.toContain(".fps-meter");
    expect(css).not.toContain(".web-vitals-card");
    expect(css).not.toContain(".web-vital-item");
    expect(css).not.toContain(".realtime-metrics-row");
    // "라벨 … 값" 요약 줄은 한 정의 (`.monitor-summary`) 다.
    expect(css).not.toContain(".chart-current-value");
    expect(css).not.toContain(".component-memory-total");
    expect(css).toContain(".monitor-summary");
    expect(css).not.toMatch(
      /\.monitor-threshold-popover\s*\{[^}]*position:\s*absolute/s,
    );
  });
});
