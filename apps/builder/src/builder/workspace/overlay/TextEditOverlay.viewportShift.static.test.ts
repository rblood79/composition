import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-027 Phase D0 — 편집 진입이 캔버스를 밀지 않는다.
 *
 * live (2026-09-20): `.workspace` 가 `overflow: hidden` 이면 브라우저의 focus / caret
 * scrollIntoView 가 hidden 컨테이너를 프로그램적으로 스크롤한다 (200% 줌 긴 Text →
 * scrollLeft 1091.5, 종료 후 127.5 잔존). 스크롤 컨테이너가 아닌 `overflow: clip` 과
 * `focus({ preventScroll: true })` 두 채널이 같이 있어야 한다.
 */
describe("ADR-027 D0 — text edit entry must not scroll the workspace", () => {
  it("`.workspace` is not a scroll container (overflow: clip)", async () => {
    const css = await readFile(resolve(__dirname, "../Workspace.css"), "utf8");
    const block = css.match(/\.workspace\s*\{[^}]*\}/)?.[0] ?? "";
    expect(block).toContain("overflow: clip;");
    expect(block).not.toContain("overflow: hidden;");
  });

  it("Quill focus opts out of caret scrollIntoView", async () => {
    const source = await readFile(
      resolve(__dirname, "TextEditOverlay.tsx"),
      "utf8",
    );
    expect(source).toContain("quill.focus({ preventScroll: true })");
    expect(source).not.toMatch(/quill\.focus\(\)/);
  });
});

/**
 * 편집 오버레이는 **Skia 프레임 카메라**를 따른다 (2026-09-20 사용자 보고 — 팬·줌 중 캔버스만
 * 움직이고 편집 상자는 제스처가 끝나야 따라왔다). React mirror (`zoom`/`panOffset` prop) 는
 * `endPan` 에서만 동기화되므로 프레임 채널 (`subscribeCanvasFramePresentation`) 을 구독하고
 * 배치는 setState 없이 DOM style 로 쓴다. live 게이트: `scripts/text-edit-camera-follow-live.mjs`.
 */
describe("text edit overlay follows the Skia frame camera during gestures", () => {
  it("subscribes to the canvas frame presentation and writes placement imperatively", async () => {
    const source = await readFile(
      resolve(__dirname, "TextEditOverlay.tsx"),
      "utf8",
    );
    expect(source).toContain("subscribeCanvasFramePresentation(");
    expect(source).toContain("el.style.transform = `scale(${p.zoom})`");
    // 프레임마다 재렌더하지 않는다 — 배치용 React state 없음.
    expect(source).not.toMatch(/useState/);
  });
});
