import { describe, expect, it } from "vitest";
import {
  inferFillGrow,
  inferSizeMode,
  parseFrValue,
  resolveSizeMode,
  sizeModeToStyleUpdates,
} from "./sizeModeResolver";

describe("sizeModeResolver axis ownership", () => {
  it("keeps width Fill flex props when height switches to Fixed in a row parent", () => {
    const result = resolveSizeMode(
      "fixed",
      "height",
      "flex",
      "row",
      "fit-content",
      "144px",
    );

    expect(sizeModeToStyleUpdates(result)).toEqual({
      height: "144px",
      alignSelf: "",
    });
  });

  it("keeps height Fill alignSelf when width switches to Fixed in a row parent", () => {
    const result = resolveSizeMode(
      "fixed",
      "width",
      "flex",
      "row",
      "fit-content",
      "320px",
    );

    expect(sizeModeToStyleUpdates(result)).toEqual({
      width: "320px",
      flexGrow: "",
      flexShrink: "0",
      flexBasis: "",
    });
  });

  it("flex 주축의 px와 parent %는 shrink 없이 authored used size를 유지한다", () => {
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode("fixed", "width", "flex", "row", "200px"),
      ),
    ).toEqual({
      width: "200px",
      flexShrink: "0",
      flexGrow: "",
      flexBasis: "",
    });
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode("fixed", "height", "flex", "column", "50%"),
      ),
    ).toEqual({
      height: "50%",
      flexShrink: "0",
      flexGrow: "",
      flexBasis: "",
    });
  });

  it("uses px fallback values when no rendered size is available", () => {
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode("fixed", "width", "block", "row", "fit-content"),
      ),
    ).toEqual({ width: "200px" });
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode("fixed", "height", "block", "row", "fit-content"),
      ),
    ).toEqual({ height: "100px" });
  });

  it("removes only the target axis Fill props when switching to Hug", () => {
    const result = resolveSizeMode("fit", "height", "flex", "column", "100%");

    expect(sizeModeToStyleUpdates(result)).toEqual({
      height: "fit-content",
      flexGrow: "",
      flexShrink: "",
      flexBasis: "",
    });
  });
});

// Framer 어법 — Fill 의 grow 계수를 `fr` 로 연다 (2026-09-17). `fill` 표기는 유지 (grow 1),
// 비율이 필요할 때만 `2fr` 입력 → flexGrow 2. 주축 한정 (교차축 stretch 는 비율 개념이 없다).
describe("sizeModeResolver fr (grow ratio)", () => {
  it("parseFrValue reads Nfr and rejects everything else", () => {
    expect(parseFrValue("2fr")).toBe(2);
    expect(parseFrValue(" 1.5fr ")).toBe(1.5);
    expect(parseFrValue("fill")).toBeNull();
    expect(parseFrValue("0fr")).toBeNull();
    expect(parseFrValue("2px")).toBeNull();
  });

  it("fill with a grow ratio writes flexGrow N on the flex main axis", () => {
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode(
          "fill",
          "width",
          "flex",
          "row",
          undefined,
          undefined,
          2,
        ),
      ),
    ).toEqual({ flexGrow: "2", flexShrink: "1", flexBasis: "0%", width: "" });
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode(
          "fill",
          "height",
          "flex",
          "column",
          undefined,
          undefined,
          3,
        ),
      ),
    ).toEqual({ flexGrow: "3", flexShrink: "1", flexBasis: "0%", height: "" });
  });

  it("fill defaults to grow 1 and ignores the ratio off the main axis", () => {
    expect(
      sizeModeToStyleUpdates(resolveSizeMode("fill", "width", "flex", "row")),
    ).toEqual({ flexGrow: "1", flexShrink: "1", flexBasis: "0%", width: "" });
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode(
          "fill",
          "height",
          "flex",
          "row",
          undefined,
          undefined,
          2,
        ),
      ),
    ).toEqual({ alignSelf: "stretch", height: "" });
  });

  it("inferSizeMode reads any positive flexGrow as fill", () => {
    expect(
      inferSizeMode({ flexGrow: "2", flexBasis: "0%" }, "width", "flex", "row"),
    ).toBe("fill");
    expect(
      inferSizeMode(
        { flexGrow: 3, flexBasis: "0%" },
        "height",
        "flex",
        "column",
      ),
    ).toBe("fill");
    expect(inferSizeMode({ flexGrow: "0" }, "width", "flex", "row")).toBe(
      "fit",
    );
  });

  it("inferFillGrow returns the ratio on the flex main axis only", () => {
    expect(inferFillGrow({ flexGrow: "2" }, "width", "flex", "row")).toBe(2);
    expect(inferFillGrow({ flexGrow: "1" }, "width", "flex", "row")).toBe(1);
    expect(
      inferFillGrow({ alignSelf: "stretch" }, "height", "flex", "row"),
    ).toBeNull();
    expect(inferFillGrow({ width: "100%" }, "width", "block")).toBeNull();
    expect(
      inferFillGrow({ flexGrow: "2" }, "height", "flex", "row"),
    ).toBeNull();
  });
});
