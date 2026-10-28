import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path: string): Promise<string> {
  return readFile(resolve(__dirname, path), "utf8");
}

describe("ADR-187 Phase 2 migration guards", () => {
  it("Fill 드래그는 host 미리보기, 놓을 때만 commit 한다 (Styles presentation 층 삭제 2026-10-28)", async () => {
    const section = await source("../panels/styles/sections/FillSection.tsx");
    const picker = await source(
      "../panels/styles/components/ColorPickerPanel.tsx",
    );
    const previewStart = section.indexOf("const handleColorChange =");
    const commitStart = section.indexOf("const handleColorChangeEnd =");
    expect(previewStart).toBeGreaterThan(-1);
    expect(commitStart).toBeGreaterThan(previewStart);
    const preview = section.slice(previewStart, commitStart);
    expect(preview).toContain("previewFill(firstFill.id");
    expect(preview).not.toContain("updateFill(");
    expect(section.slice(commitStart)).toContain("updateFill(firstFill.id");
    expect(section).not.toContain("updateFillPreviewThrottled");
    expect(picker).toContain("if (livePreview) {");
    expect(picker).not.toContain("requestAnimationFrame");
    expect(picker).not.toContain("cancelAnimationFrame");
  });
});
