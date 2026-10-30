/**
 * compare 모드 구분선은 다른 resize 손잡이와 같은 PanelSplitter 다 — 자체 pointer 핸들러·
 * 고정 색 막대(#f24cb8)·col-resize 커서로 되돌아가지 않는지 정적으로 고정한다.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("WorkspaceCompareMode resize handle", () => {
  it("keeps both renderers in the same full viewport and clips only the revealed region", async () => {
    const css = await readFile(resolve(__dirname, "../Workspace.css"), "utf-8");
    expect(css).not.toContain("grid-template-columns: var(--compare-split");
    expect(css).toMatch(
      /\.workspace-compare-panel \{[^}]*position: absolute;\s*inset: 0;/,
    );
    expect(css).toContain(
      "clip-path: inset(0 calc(100% - var(--compare-split, 50%)) 0 0)",
    );
    expect(css).toContain("clip-path: inset(0 0 0 var(--compare-split, 50%))");
    // 끝 위치에서 0px 너비 wrapper의 바깥으로 hit area가 잘리지 않도록 한다.
    expect(css).toMatch(
      /\.workspace-compare-resizer \{[^}]*inset: 0;[^}]*pointer-events: none;/,
    );
    expect(css).toMatch(
      /\.workspace-compare-resizer \.panel-resize-handle \{[^}]*left: clamp\([^}]*pointer-events: auto;/,
    );
  });

  it("styles the resizer through the common handle tokens only", async () => {
    const css = await readFile(resolve(__dirname, "../Workspace.css"), "utf-8");

    expect(css).toMatch(/\.workspace-compare-resizer \.panel-resize-handle \{/);
    // 실제 clip 경계의 선은 공용 resize 토큰을 쓴다.
    expect(css).toMatch(
      /\.workspace-compare-resizer::after \{[^}]*background: var\(--panel-interaction-line-color\);/,
    );
    // 두 pane 을 가르는 선은 전체 높이 (두께는 공통 토큰)
    expect(css).toMatch(
      /\.workspace-compare-resizer::after \{[^}]*height: 100%;/,
    );
    expect(css).not.toContain("#f24cb8");
    expect(css).not.toContain("col-resize");
  });
});
