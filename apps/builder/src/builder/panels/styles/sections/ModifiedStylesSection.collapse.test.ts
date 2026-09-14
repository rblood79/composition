import { describe, expect, it } from "vitest";
import { collapseUniformLonghands } from "./ModifiedStylesSection";

describe("Modified — 균일 longhand 묶음은 shorthand 한 행 (panel-ui 04 「Gap 8px」, 대조 B9)", () => {
  it("rowGap · columnGap 이 같으면 gap 하나, 다르면 둘 그대로", () => {
    expect(
      collapseUniformLonghands(["width", "rowGap", "columnGap"], {
        width: 160,
        rowGap: 8,
        columnGap: 8,
      }),
    ).toEqual(["width", "gap"]);
    expect(
      collapseUniformLonghands(["rowGap", "columnGap"], {
        rowGap: 8,
        columnGap: 12,
      }),
    ).toEqual(["rowGap", "columnGap"]);
  });

  it("코너 4 · 변 4 · padding 4 도 같은 규칙 — 하나라도 빠지면 접지 않는다", () => {
    const corners = {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8,
      borderBottomLeftRadius: 8,
    };
    expect(collapseUniformLonghands(Object.keys(corners), corners)).toEqual([
      "borderRadius",
    ]);
    expect(
      collapseUniformLonghands(["paddingTop", "paddingLeft"], {
        paddingTop: 4,
        paddingLeft: 4,
      }),
    ).toEqual(["paddingTop", "paddingLeft"]);
  });
});

describe("Modified — dirty 목록에 shorthand 가 같이 실린 경우", () => {
  it("균일하면 longhand 를 빼고 gap 하나, 비균일이면 gap 을 빼고 longhand 둘", () => {
    expect(
      collapseUniformLonghands(["gap", "rowGap", "columnGap", "width"], {
        rowGap: 8,
        columnGap: 8,
        width: 160,
      }),
    ).toEqual(["gap", "width"]);
    expect(
      collapseUniformLonghands(["gap", "rowGap", "columnGap"], {
        rowGap: 8,
        columnGap: 12,
      }),
    ).toEqual(["rowGap", "columnGap"]);
  });
});
