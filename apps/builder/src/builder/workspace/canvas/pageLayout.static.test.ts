import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("explicit page layout command contract", () => {
  it("does not reinitialize page positions from BuilderCanvas breakpoint changes", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("previousLayoutKeyRef");
    expect(source).not.toContain("initializePagePositions(");
  });

  it("exposes page arrangement from the zoom popover", async () => {
    const source = await readFile(
      resolve(__dirname, "../ZoomControls.tsx"),
      "utf-8",
    );

    expect(source).toContain("alignPagesToScreen");
    expect(source).toContain('case "align-pages"');
    expect(source).toContain('id="align-pages"');
    expect(source).toContain('t("zoom.align")');
  });

  // ADR-232 — breakpoint 전환은 위치를 옮기지 않는다 (스냅샷 3벌 소멸). tier 차이는 페이지
  //   placement 의 responsive override 가 갖고, 파생이 활성 tier 로 다시 돈다.
  it("does not switch page-position snapshots on breakpoint change", async () => {
    const source = await readFile(
      resolve(__dirname, "../../main/BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("switchPagePositionsBreakpoint");
    expect(source).not.toContain("pageWidth: CANVAS_VIEWPORT[nextBreakpoint]");
  });
});
