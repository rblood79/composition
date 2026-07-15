import { describe, expect, it } from "vitest";
import { buildCatalogShapes } from "../buildCatalogShapes";
import type { SizeSpec } from "../../types";

/**
 * Background(fills) alpha → catalog bg shape fillAlpha 계약 (2026-07-15).
 *
 * catalog 색 채널(shape.fill 문자열)은 hex6 전용 — hex8 을 실으면
 * hexStringToNumber 채널 시프트가 어긋나 색이 깨진다. 따라서 fills 의
 * 합성 alpha(hex alpha × fill.opacity)는 builder(buildSpecNodeData)가
 * 데이터 키 `_fillBgAlpha` 로 분해 주입하고, 본 함수가 bg shape 의
 * fillAlpha 에 곱한다 (ADR-142 §3 데이터 분기 — 컴포넌트 식별 아님).
 */
describe("buildCatalogShapes — _fillBgAlpha", () => {
  const SIZE = { borderRadius: 4, borderWidth: 1 } as unknown as SizeSpec;

  it("_fillBgAlpha 를 bg shape fillAlpha 에 곱한다", () => {
    const shapes = buildCatalogShapes(
      undefined,
      {
        style: { backgroundColor: "#863263" },
        _fillBgAlpha: 0.16,
      },
      SIZE,
    );
    const bg = shapes.find((s) => s.id === "bg");
    expect(bg).toBeDefined();
    expect(bg?.fill).toBe("#863263");
    expect(bg?.fillAlpha).toBeCloseTo(0.16, 5);
  });

  it("_fillBgAlpha 미지정 시 기존 fillAlpha 동작을 유지한다", () => {
    const shapes = buildCatalogShapes(
      undefined,
      { style: { backgroundColor: "#863263" } },
      SIZE,
    );
    const bg = shapes.find((s) => s.id === "bg");
    expect(bg?.fillAlpha).toBe(1);
  });
});
