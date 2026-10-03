import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-221 배선 정적 가드 (breakdown §7 "BuilderCanvas 정적 가드").
 * - 게이트 신호: `ViewportControlBridge` 마운트가 `onInteractionStart/End` 를 전달한다
 *   (round 1 h2 — 이전에는 dead prop 이었다).
 * - 헤더 층 마운트 1 + 히트 핸들러 props (drag/shift · 이름 편집).
 * - capture 가드: pointerdown capture 는 `[data-page-header]` 자손이면 즉시 return (Decision 4).
 *   dblclick capture 와 Skia 타이틀 bounds 순회는 없다 (Phase 2 이관).
 */
async function read(path: string): Promise<string> {
  return readFile(resolve(__dirname, path), "utf-8");
}

describe("BuilderCanvas — 페이지 헤더 DOM 층 배선", () => {
  it("이름 편집기는 헤더 노드 안 (PageHeaderLayer.css, 700) — Workspace.css 의 구 편집기 규칙은 없다", async () => {
    const layerCss = await read("overlay/pageHeader/PageHeaderLayer.css");
    const workspaceCss = await read("../Workspace.css");
    const editor = layerCss.match(
      /\.page-header \.page-title-edit-input\s*\{[\s\S]*?\n\}/,
    );
    expect(editor).not.toBeNull();
    expect(editor?.[0]).toContain("font-weight: 700;");
    expect(editor?.[0]).toContain("padding: 0;");
    expect(editor?.[0]).toContain("appearance: none;");
    expect(workspaceCss).not.toContain(".page-title-edit-input");
    // 헤더 노드만 이벤트를 받고 층은 통과
    expect(layerCss).toMatch(
      /\.page-header-layer\s*\{[^}]*pointer-events: none;/,
    );
    expect(layerCss).toMatch(/\.page-header\s*\{[^}]*pointer-events: auto;/);
  });

  it("제스처 숨김/나타남은 opacity fade (Framer 감각) — visibility 즉시 토글 아님", async () => {
    const layerCss = await read("overlay/pageHeader/PageHeaderLayer.css");
    // 나타남: 층 base 에 opacity transition
    expect(layerCss).toMatch(
      /\.page-header-layer\s*\{[^}]*transition: opacity[^};]*;/,
    );
    // 숨김: data-hidden 은 opacity 0 (visibility:hidden 즉시 토글 폐기)
    expect(layerCss).toMatch(
      /\.page-header-layer\[data-hidden\]\s*\{[^}]*opacity: 0;/,
    );
    expect(layerCss).not.toContain("visibility: hidden");
    // 접근성: reduced-motion 에서 transition 제거
    expect(layerCss).toContain("prefers-reduced-motion: reduce");
  });
});
