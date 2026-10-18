import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-274 — `columns: "auto"` 의 Canvas 입력은 모니터 폭 하나다. 카메라 zoom · Canvas 폭 · 패널
 * rail 이 프레임 검사에 다시 들어오면 확대 · 축소가 페이지 배치를 바꾼다 (사용자 지적 2026-10-18
 * 「확대를 했는데 auto로 인해 배치가 달라져 버린다」 · 줌 중 page root 옮기기 5,170 회).
 */
describe("ADR-274 page grid frame check", () => {
  it("reads only the monitor width — no camera zoom, canvas width or rail inset", async () => {
    const source = await readFile(
      resolve(__dirname, "CatalogCanvas.tsx"),
      "utf8",
    );
    const start = source.indexOf("const syncScreenWidth = () => {");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, source.indexOf("\n    };", start));
    expect(body).toContain("window.screen.width");
    expect(body).toContain("workspace.setScreenWidth(");
    expect(body).not.toMatch(/zoom|containerSize|RailInset/);
  });
});
