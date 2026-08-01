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
    expect(source).toContain("화면 정렬");
  });

  it("switches the active page-position snapshot with the breakpoint", async () => {
    const source = await readFile(
      resolve(__dirname, "../../main/BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain("switchPagePositionsBreakpoint");
    expect(source).toContain("currentBreakpoint");
    expect(source).toContain("nextBreakpoint");
  });

  it("uses the target breakpoint canvas size for a first-entry snapshot", async () => {
    const source = await readFile(
      resolve(__dirname, "../../main/BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain("CANVAS_VIEWPORT");
    expect(source).toContain(
      "pageWidth: CANVAS_VIEWPORT[nextBreakpoint].width",
    );
    expect(source).toContain(
      "pageHeight: CANVAS_VIEWPORT[nextBreakpoint].height",
    );
  });
});
