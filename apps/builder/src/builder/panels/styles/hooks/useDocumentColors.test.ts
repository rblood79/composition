import { describe, expect, it } from "vitest";
import { FillType } from "../../../../types/builder/fill.types";
import { collectDocumentColors } from "./useDocumentColors";

describe("collectDocumentColors — 색 피커 Document 팔레트 수집기 (panel-ui 05 #1)", () => {
  it("style 색 3키 + color fill 을 hex8 로 모아 빈도 순, 상한 12", () => {
    const sources = [
      { style: { backgroundColor: "#2563EB", color: "#fff", borderColor: "rgb(23, 23, 23)" } },
      { style: { backgroundColor: "#2563eb" }, fills: [{ id: "f", type: FillType.Color, color: "#FF0000FF", opacity: 1, enabled: true }] },
      { style: { color: "var(--fg)", borderColor: "transparent", backgroundColor: "inherit" } },
      ...Array.from({ length: 15 }, (_, i) => ({ style: { color: `#0000${(i + 16).toString(16).padStart(2, "0")}` } })),
    ];
    const colors = collectDocumentColors(sources as never);
    expect(colors[0]).toBe("#2563EBFF");
    expect(colors).toContain("#FFFFFFFF");
    expect(colors).toContain("#171717FF");
    expect(colors).toContain("#FF0000FF");
    expect(colors.some((c) => c.startsWith("#000000"))).toBe(false);
    expect(colors).toHaveLength(12);
  });

  it("빈 문서는 빈 배열", () => {
    expect(collectDocumentColors([])).toEqual([]);
  });
});
