/**
 * compare 모드 구분선은 다른 resize 손잡이와 같은 PanelSplitter 다 — 자체 pointer 핸들러·
 * 고정 색 막대(#f24cb8)·col-resize 커서로 되돌아가지 않는지 정적으로 고정한다.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("WorkspaceCompareMode resize handle", () => {
  it("renders the shared PanelSplitter bound to the CSS pane", async () => {
    const source = await readFile(
      resolve(__dirname, "WorkspaceCompareMode.tsx"),
      "utf-8",
    );

    expect(source).toContain("<PanelSplitter");
    expect(source).toContain('edge="right"');
    expect(source).toContain("controls={COMPARE_CSS_PANE_ID}");
    expect(source).toContain("id={COMPARE_CSS_PANE_ID}");
    expect(source).not.toContain("onPointerDown");
    expect(source).not.toContain("setPointerCapture");
  });

  it("styles the resizer through the common handle tokens only", async () => {
    const css = await readFile(resolve(__dirname, "../Workspace.css"), "utf-8");

    expect(css).toMatch(/\.workspace-compare-resizer \.panel-resize-handle \{/);
    expect(css).not.toContain("#f24cb8");
    expect(css).not.toContain("col-resize");
  });
});
