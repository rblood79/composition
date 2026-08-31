import { describe, expect, it } from "vitest";
import { applyCommonTaffyStyle } from "../utils";

/**
 * ADR-923 Phase 2 — baseline 계약 입력 3종의 TS 통과 규칙.
 *
 * `applyCommonTaffyStyle` 은 세 display 브랜치(flex/block/grid) 공용 choke point:
 * - `verticalAlign`: CSS 키워드 문자열 그대로 (엔진 tree.rs 가 u8 매핑)
 * - `lineHeight`: **px 로 선해석** — 배율(숫자/단위 없는 문자열)은 fontSize 기준
 *   (엔진은 폰트 메트릭이 없어 배율을 해석할 수 없다 — NodeStyle.line_height 는
 *   Option<f32> px 스칼라 계약)
 * - `leafBaseline`: enrichWithIntrinsicSize 가 주입한 측정 스칼라 통과 (숫자 그대로)
 */
describe("ADR-923 Phase 2 — applyCommonTaffyStyle baseline 입력 통과", () => {
  it("verticalAlign 키워드 문자열을 그대로 통과시킨다", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { verticalAlign: "middle" }, {});
    expect(result.verticalAlign).toBe("middle");
  });

  it("lineHeight 배율을 fontSize 로 px 해석한다 (1.5 × 20 = 30)", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { lineHeight: 1.5, fontSize: 20 }, {});
    expect(result.lineHeight).toBe(30);
  });

  it("lineHeight px 문자열은 그 값 그대로 (fontSize 무관)", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { lineHeight: "24px", fontSize: 99 }, {});
    expect(result.lineHeight).toBe(24);
  });

  it("leafBaseline 숫자 스칼라를 그대로 통과시킨다", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { leafBaseline: 12.5 }, {});
    expect(result.leafBaseline).toBe(12.5);
  });

  it("미설정이면 세 필드 모두 결과에 없다 (엔진 Option None 계약)", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { width: 100 }, {});
    expect(result.verticalAlign).toBeUndefined();
    expect(result.lineHeight).toBeUndefined();
    expect(result.leafBaseline).toBeUndefined();
  });

  it("lineHeight: normal 은 통과시키지 않는다 (엔진 AUTO — 폰트 내장 line-height 는 leaf 측정이 담당)", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { lineHeight: "normal", fontSize: 16 }, {});
    expect(result.lineHeight).toBeUndefined();
  });

  it("unitless lineHeight 는 상속 computed fontSize 로 환산한다 (r7m2 — inline 부재 시 기본 16 금지)", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { lineHeight: 1.5 }, {}, 20);
    expect(result.lineHeight).toBe(30);
  });

  it("inline fontSize 가 computed fontSize 보다 우선한다 (computed 는 inline 포함이 원칙이나 방어 계약)", () => {
    const result: Record<string, unknown> = {};
    applyCommonTaffyStyle(result, { lineHeight: 1.5, fontSize: 10 }, {}, 20);
    expect(result.lineHeight).toBe(15);
  });
});
