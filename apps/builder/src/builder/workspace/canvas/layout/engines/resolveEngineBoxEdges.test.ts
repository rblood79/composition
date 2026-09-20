import { describe, expect, it } from "vitest";

import { resolveEngineBoxEdges } from "./utils";

/**
 * 엔진 직렬화 box edge — px 숫자 · `%` 문자열 통과 · margin `auto` 보존 · longhand > shorthand.
 * (`resolveMarginAutoSides` 의 auto 방향 케이스를 이어받는다 — 그 helper 는 block/flex 어댑터가
 * 이 함수로 통일되며 소비처 0 이 되어 삭제, 2026-09-20.)
 */
describe("resolveEngineBoxEdges", () => {
  it.each([
    ["auto", ["auto", "auto", "auto", "auto"]],
    ["0 auto", [0, "auto", 0, "auto"]],
    ["auto 0 12px", ["auto", 0, 12, 0]],
    ["1px auto auto 0", [1, "auto", "auto", 0]],
  ] as const)("margin shorthand %s 의 네 방향", (margin, expected) => {
    const e = resolveEngineBoxEdges({ margin }, "margin");
    expect([e.top, e.right, e.bottom, e.left]).toEqual(expected);
  });

  it("longhand 가 shorthand auto 를 덮고, undefined longhand 는 덮지 않는다", () => {
    expect(
      resolveEngineBoxEdges(
        {
          margin: "auto 0",
          marginTop: 0,
          marginRight: "auto",
          marginBottom: undefined,
          marginLeft: "12px",
        },
        "margin",
      ),
    ).toEqual({ top: 0, right: "auto", bottom: "auto", left: 12 });
    expect(resolveEngineBoxEdges(undefined, "margin")).toEqual({
      top: undefined,
      right: undefined,
      bottom: undefined,
      left: undefined,
    });
  });

  it("`%` 는 문자열 그대로 통과 (엔진이 containing block 폭으로 푼다)", () => {
    expect(
      resolveEngineBoxEdges({ padding: "10% 4px", paddingLeft: "25%" }, "padding"),
    ).toEqual({ top: "10%", right: 4, bottom: "10%", left: "25%" });
  });

  it("padding 은 auto 를 받지 않는다 (undefined → 미지정)", () => {
    expect(resolveEngineBoxEdges({ padding: "auto" }, "padding")).toEqual({
      top: undefined,
      right: undefined,
      bottom: undefined,
      left: undefined,
    });
  });
});
