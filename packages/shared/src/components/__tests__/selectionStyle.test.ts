import { describe, expect, it } from "vitest";

import { resolveSelectionBehavior, toSelectionStyle } from "../selectionStyle";

/**
 * selectionStyle(RSP) ↔ selectionBehavior(RAC) 변환 계약 (design-data 감사 §1-2 축②, 2026-08-21).
 *
 * 이 변환이 여러 곳에 흩어지면 **기본값이 갈린다** — 실제로 그 상태였다: Tree 렌더러는
 * `"replace"`, GridList 렌더러는 `"toggle"` 을 기본으로 넘겨, 같은 사용자 선택이 한쪽에서만
 * 체크박스를 냈다. fallback 을 인자로 받는 단일 함수가 그 갈림을 구조적으로 막는다.
 */
describe("resolveSelectionBehavior", () => {
  it("selectionStyle 이 최우선 — checkbox→toggle / highlight→replace", () => {
    expect(
      resolveSelectionBehavior({
        selectionStyle: "checkbox",
        fallback: "replace",
      }),
    ).toBe("toggle");
    expect(
      resolveSelectionBehavior({
        selectionStyle: "highlight",
        fallback: "toggle",
      }),
    ).toBe("replace");
  });

  it("selectionStyle 이 selectionBehavior 를 이긴다 (패널 표면이 정본)", () => {
    expect(
      resolveSelectionBehavior({
        selectionStyle: "checkbox",
        selectionBehavior: "replace",
        fallback: "replace",
      }),
    ).toBe("toggle");
  });

  it("selectionStyle 무지정 시 기존 selectionBehavior 존중 (기존 문서 보존)", () => {
    expect(
      resolveSelectionBehavior({
        selectionBehavior: "replace",
        fallback: "toggle",
      }),
    ).toBe("replace");
  });

  it("둘 다 없으면 컴포넌트별 fallback — GridList toggle / Tree replace", () => {
    expect(resolveSelectionBehavior({ fallback: "toggle" })).toBe("toggle");
    expect(resolveSelectionBehavior({ fallback: "replace" })).toBe("replace");
  });

  it("알 수 없는 값은 무시하고 fallback (문서에 남은 오타/legacy 값 방어)", () => {
    expect(
      resolveSelectionBehavior({
        selectionStyle: "checkboxes",
        selectionBehavior: "TOGGLE",
        fallback: "replace",
      }),
    ).toBe("replace");
  });

  it("역변환은 왕복한다", () => {
    expect(toSelectionStyle("toggle")).toBe("checkbox");
    expect(toSelectionStyle("replace")).toBe("highlight");
  });
});
