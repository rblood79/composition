/**
 * S2 체크리스트 §4.1 Chart (2026-11-22) — S2 에는 Chart 가 없어 글자 단계와 Tooltip 값만 따른다:
 *   - hover 툴팁의 모서리 · 여백 · 글자는 S2 Tooltip (`Tooltip.tsx` — `borderRadius: 'default'` 8 ·
 *     `paddingX: 'edge-to-text'` (control S 높이 × 3/8) · `paddingY: centerPadding()` · `font: 'ui-sm'`) 값을
 *     rule `chart` 채널에 두고 생성 CSS 변수로 DOM 툴팁 셋 (막대 · scatter · family) 이 같이 읽는다;
 *   - 축 글자 11 은 리터럴이 아니라 글자 토큰 (`{typography.text-2xs}` — S2 `ui-xs` 단계 −2, desktop 11 ·
 *     터치 13) 이고, 장면 계산 (`resolveChartMetrics`) 이 그 토큰을 숫자로 풀어 두 consumer 에 준다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChartMetrics, typography } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { CHART_TOOLTIP_SURFACE } from "../../../../../../packages/shared/src/components/chart/chartInteraction";

const REPO = resolve(__dirname, "../../../../../..");
const read = (path: string) => readFileSync(resolve(REPO, path), "utf8");
const chart = COMPONENT_RULES_TABLE.Chart!.chart!;

describe("S2 §4.1 Chart — 툴팁 값 = S2 Tooltip", () => {
  it("S2 Tooltip 의 모서리 · 여백 · 글자 식이 설치본 그대로다", () => {
    const s2 = read(
      "apps/builder/node_modules/@react-spectrum/s2/src/Tooltip.tsx",
    );
    expect(s2).toMatch(
      /borderRadius: 'default',\s*paddingX: 'edge-to-text',\s*paddingY: centerPadding\(\)/,
    );
    expect(s2).toMatch(
      /minHeight: 24,\s*boxSizing: 'border-box',\s*font: 'ui-sm'/,
    );
  });

  it("rule chart 채널이 툴팁 모서리 · 여백 · 글자를 토큰으로 갖는다", () => {
    expect(chart.tooltipRadius).toBe("{radius.md}");
    expect(chart.tooltipPaddingX).toBe("{length.size.height.S*3/8}");
    expect(chart.tooltipPaddingY).toBe(
      "{length.size.height.S*1/2+typography.text-xs--line-height*-1/2}",
    );
    expect(chart.tooltipFontSize).toBe("{typography.text-xs}");
    expect(chart.tooltipLineHeight).toBe("{typography.text-xs--line-height}");
  });

  it("생성 Chart.css 가 툴팁 변수를 catalog 토큰으로 낸다", () => {
    const css = read(
      "packages/shared/src/components/styles/generated/Chart.css",
    );
    expect(css).toContain(
      "--chart-tooltip-radius: var(--catalog-token-radius-md);",
    );
    expect(css).toContain(
      "--chart-tooltip-padding: calc(var(--catalog-token-size-height-S) * 1 / 2 + calc(var(--catalog-token-text-xs) * var(--catalog-token-text-xs--line-height)) * -1 / 2) calc(var(--catalog-token-size-height-S) * 3 / 8);",
    );
    expect(css).toContain(
      "--chart-tooltip-font-size: var(--catalog-token-text-xs);",
    );
    expect(css).toContain(
      "--chart-tooltip-line-height: var(--catalog-token-text-xs--line-height);",
    );
  });

  it("DOM 툴팁 셋이 같은 표면 style 하나를 읽는다 (리터럴 모서리 · 여백 · 글자 없음)", () => {
    expect(CHART_TOOLTIP_SURFACE).toMatchObject({
      borderRadius: "var(--chart-tooltip-radius)",
      padding: "var(--chart-tooltip-padding)",
      fontSize: "var(--chart-tooltip-font-size)",
      lineHeight: "var(--chart-tooltip-line-height)",
    });
    const recharts = read(
      "packages/shared/src/components/chart/RechartsChart.tsx",
    );
    const family = read(
      "packages/shared/src/components/chart/FamilySceneHost.tsx",
    );
    expect(recharts.match(/\.\.\.CHART_TOOLTIP_SURFACE/g)?.length).toBe(2);
    expect(family.match(/\.\.\.CHART_TOOLTIP_SURFACE/g)?.length).toBe(1);
    for (const source of [recharts, family]) {
      expect(source).not.toMatch(/borderRadius: 6,/);
      expect(source).not.toMatch(/padding: "6px 8px"/);
    }
  });
});

describe("S2 §4.1 Chart — 축 글자 = 글자 토큰", () => {
  it("rule metrics 의 글자는 토큰이고 장면 계산은 그 토큰의 px 를 쓴다", () => {
    expect(chart.metrics?.fontSize).toBe("{typography.text-2xs}");
    expect(typography["text-2xs"]).toBe(11);
    expect(resolveChartMetrics(chart).fontSize).toBe(11);
  });
});
