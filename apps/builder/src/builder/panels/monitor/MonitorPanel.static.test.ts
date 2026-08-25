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
    expect(source).toContain(
      'className="panel-contents monitor-panel-contents"',
    );
    expect(source.match(/<Section/g)).toHaveLength(7);
    expect(source).not.toContain("PanelProps");
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
    expect(css).not.toMatch(
      /\.monitor-threshold-popover\s*\{[^}]*position:\s*absolute/s,
    );
  });
});
