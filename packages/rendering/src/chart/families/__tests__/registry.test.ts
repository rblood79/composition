/**
 * ADR-306 G2 (단위 층) — family 등록 · 지연 로드 (breakdown §4.3).
 * 로드 전 scene 은 상자만 (pending), 로드 뒤 같은 입력이 실제 scene, 실패 뒤 다시 시도, chunk 가 없는
 * family 는 설정 오류. 첫 화면 번들 경계: 진입점이 family 계산 모듈을 정적으로 import 하지 않는다.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { computeChartScene } from "../../computeChartScene";
import { CHART_DEFAULT_PROPS } from "../../computeChartScene";
import type { ChartProps } from "../../types";
import {
  __setChartFamilyLoaderForTest,
  chartFamilyEpoch,
  chartFamilyError,
  getChartFamily,
  loadChartFamily,
  subscribeChartFamilies,
} from "../registry";
import { kpiFamily } from "../kpi";

const gauge: ChartProps = {
  ...CHART_DEFAULT_PROPS,
  chartType: "gauge",
  metric: "value",
};
const rows = [{ value: 42 }];
const size = { width: 320, height: 240 };

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("ADR-306 G2 — family registry", () => {
  it("로드 전 pending (마크 0 · 안내 글자 없음) → 로드 뒤 같은 입력이 실제 scene", async () => {
    restore = __setChartFamilyLoaderForTest("kpi", async () => kpiFamily);
    const before = computeChartScene(gauge, rows, size);
    expect(before.pending).toBe(true);
    expect(before.marks).toEqual([]);
    const epoch = chartFamilyEpoch();
    let heard = 0;
    const off = subscribeChartFamilies(() => {
      heard += 1;
    });
    const a = loadChartFamily("kpi");
    const b = loadChartFamily("kpi");
    expect(a).toBe(b); // 진행 중이면 같은 promise
    await a;
    off();
    expect(heard).toBe(1);
    expect(chartFamilyEpoch()).toBe(epoch + 1);
    const after = computeChartScene(gauge, rows, size);
    expect(after.pending).toBeUndefined();
    expect(
      after.marks.some((m) => m.kind === "path" && m.fillPaint === "accent"),
    ).toBe(true);
  });

  it("실패는 기록되고 다음 호출이 다시 시도한다 (실패 promise 를 남기지 않는다)", async () => {
    let calls = 0;
    restore = __setChartFamilyLoaderForTest("kpi", async () => {
      calls += 1;
      if (calls === 1) throw new Error("network");
      return kpiFamily;
    });
    await expect(loadChartFamily("kpi")).rejects.toThrow("network");
    expect(chartFamilyError("kpi")).toBeInstanceOf(Error);
    expect(getChartFamily("kpi")).toBeUndefined();
    expect(computeChartScene(gauge, rows, size).pending).toBe(true);
    await expect(loadChartFamily("kpi")).resolves.toBe(kpiFamily);
    expect(chartFamilyError("kpi")).toBeUndefined();
    expect(calls).toBe(2);
  });

  it("chunk 가 없는 family 는 설정 오류 scene (pending 이 아니다)", () => {
    // Phase 5 부터 family 5 개가 모두 chunk 를 가진다 — 없는 build 는 로더를 빼서 만든다.
    const restore = __setChartFamilyLoaderForTest("network", undefined);
    try {
      const scene = computeChartScene(
        { ...CHART_DEFAULT_PROPS, chartType: "treemap" },
        rows,
        size,
      );
      expect(scene.pending).toBeUndefined();
      expect(scene.empty).toBe(true);
      expect(scene.diagnostics?.[0]?.code).toBe("chartFamily.unavailable");
    } finally {
      restore();
    }
  });

  it("첫 화면 번들 경계 — 진입점 · scene · 생성 경로는 family 계산 모듈을 정적으로 import 하지 않는다", () => {
    const read = (path: string) =>
      readFileSync(new URL(path, import.meta.url), "utf8");
    for (const file of [
      "../../index.ts",
      "../../computeChartScene.ts",
      "../../authoring.ts",
      "../registry.ts",
    ]) {
      const source = read(file);
      for (const family of [
        "kpi",
        "category",
        "distribution",
        "matrix",
        "network",
        "stats",
        "samples",
      ]) {
        expect(source, file).not.toMatch(
          new RegExp(`from\\s+["'][^"']*families/${family}(/[^"']*)?["']`),
        );
        expect(source, file).not.toMatch(
          new RegExp(`from\\s+["']\\./${family}(/[^"']*)?["']`),
        );
      }
    }
    // registry 는 dynamic import 로만 닿는다.
    expect(read("../registry.ts")).toMatch(/import\("\.\/kpi"\)/);
    expect(read("../registry.ts")).toMatch(/import\("\.\/category"\)/);
    expect(read("../registry.ts")).toMatch(/import\("\.\/distribution"\)/);
    expect(read("../registry.ts")).toMatch(/import\("\.\/matrix"\)/);
    expect(read("../registry.ts")).toMatch(/import\("\.\/network"\)/);
  });
});
