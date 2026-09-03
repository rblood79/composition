import { describe, expect, it } from "vitest";

import { applyBatchStylePatch } from "../elementUpdate";

/**
 * ADR-923 Phase 5 후속 round 3 (fe2m1) — propagation 이 만드는 **부분 style patch** 의 보존 지점.
 *
 * store 쓰기 (`batchUpdateElementProps`) 는 props 최상위 얕은 병합이라, patch 의 `style` 이 부분
 * 객체면 자식의 나머지 style 이 통째로 사라진다 (r2 feh2). 그 보존을 생산자가 "현재 style 전체 복사"
 * 로 하면 `sanitizePropsPatch` 가 그 복사본의 fill 파생 키 (backgroundColor 등) 를 patch 로 보고
 * 지운다 (round 3 fe2m1). 그래서 patch 는 바꾸는 키만 담고 병합은 이 소비 지점이 한다.
 */
describe("applyBatchStylePatch — mergeStyle 부분 patch 병합", () => {
  const current = {
    children: "",
    style: {
      display: "none",
      fontSize: 13,
      color: "rgb(1, 2, 3)",
      backgroundColor: "rgb(9, 9, 9)",
    },
  };

  it("mergeStyle 이면 바꾸는 키만 덮고 나머지 (fill 파생 키 포함) 는 남는다", () => {
    const next = applyBatchStylePatch(
      current,
      { style: { display: "block" } },
      true,
    );
    expect(next.style).toEqual({
      display: "block",
      fontSize: 13,
      color: "rgb(1, 2, 3)",
      backgroundColor: "rgb(9, 9, 9)",
    });
  });

  it("mergeStyle 이 없으면 통째 교체 (Inspector 의 style 키 삭제 계약 보존)", () => {
    const next = applyBatchStylePatch(
      current,
      { style: { display: "block" } },
      undefined,
    );
    expect(next.style).toEqual({ display: "block" });
  });

  it("style 이 없는 patch 나 현재 style 부재는 그대로 통과", () => {
    expect(applyBatchStylePatch(current, { children: "x" }, true)).toEqual({
      children: "x",
    });
    expect(
      applyBatchStylePatch(
        { children: "" },
        { style: { display: "block" } },
        true,
      ),
    ).toEqual({ style: { display: "block" } });
  });
});
