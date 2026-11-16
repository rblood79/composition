/**
 * ADR-312 Phase 5 — 범주 축 해석은 한 곳 (본문 Decision 9 · F12). calendar · candlestick 이 시간 축과 같은 parser
 * (`chartTimeParser` — `dimensionFormat` 지시자 · 엄격 ISO · epoch ms) 를 읽는다. 기대 값은 손으로 정한 날짜다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { computeChartScene } from "../computeChartScene";
import { loadChartFamily } from "../families/registry";
import { chartTimeParser } from "../series";
import type { ChartProps, ChartRow, ChartScene } from "../types";

beforeAll(async () => {
  await loadChartFamily("matrix");
});

const SIZE = { width: 640, height: 320 };
const scene = (
  chartType: "calendar" | "candlestick",
  rows: ChartRow[],
  extra: Partial<ChartProps> = {},
): ChartScene =>
  computeChartScene(
    {
      chartType,
      showTooltip: true,
      dimension: "date",
      metric: "value",
      ...extra,
    } as ChartProps,
    rows,
    SIZE,
  );
const titles = (s: ChartScene) => (s.targets ?? []).map((t) => t.title);

describe("ADR-312 Decision 9 — 공용 날짜 parser", () => {
  it("엄격 ISO · 지시자 · epoch ms · 날짜가 아닌 값", () => {
    const iso = chartTimeParser({});
    expect(iso("2026-01-05")).toBe(Date.UTC(2026, 0, 5));
    expect(iso("2026/01/05")).toBeNull(); // 엄격 ISO — 느슨한 Date.parse 가 아니다
    expect(iso(2026)).toBeNull(); // 네 자리 연도 · 순번은 날짜가 아니다
    expect(iso(Date.UTC(2026, 0, 5))).toBe(Date.UTC(2026, 0, 5));
    const dmy = chartTimeParser({ dimensionFormat: "%d/%m/%Y" });
    expect(dmy("05/01/2026")).toBe(Date.UTC(2026, 0, 5));
  });
});

describe("ADR-312 Decision 9 — calendar · candlestick 이 같은 parser", () => {
  const dmy: ChartRow[] = [
    { date: "05/01/2026", value: 3, open: 1, high: 4, low: 1 },
    { date: "06/01/2026", value: 2, open: 3, high: 3, low: 1 },
  ];

  it("calendar — `dimensionFormat` 을 읽는다 (05/01/2026 = 1 월 5 일 — 전에는 Date.parse 로 5 월 1 일)", () => {
    const s = scene("calendar", dmy, { dimensionFormat: "%d/%m/%Y" });
    expect(titles(s)).toEqual(
      expect.arrayContaining(["2026-01-05", "2026-01-06"]),
    );
  });

  it("calendar — 형식이 없으면 엄격 ISO 만 (2026/01/05 는 날짜가 아니다)", () => {
    const s = scene("calendar", [{ date: "2026/01/05", value: 1 }]);
    expect(titles(s)).toEqual([]);
  });

  it("candlestick — `dimensionFormat` 으로 정렬한다 (행 순서가 거꾸로여도 1 월 5 일이 먼저)", () => {
    const s = scene("candlestick", [...dmy].reverse(), {
      dimensionFormat: "%d/%m/%Y",
    });
    expect(titles(s)).toEqual(["05/01/2026", "06/01/2026"]);
  });
});
