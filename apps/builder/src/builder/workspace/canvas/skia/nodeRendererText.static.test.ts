// @vitest-environment node
/**
 * renderText paragraph builder — 공유 FontCollection 정적 가드
 *
 * `ParagraphBuilder.Make(style, fontMgr)` 는 호출마다 새 FontCollection 을
 * 만든다. renderText 는 pushStyle 로 `fontVariations`(variable font weight)
 * 를 적용하므로, per-call collection 이면 **paragraph 마다 variable font
 * 인스턴스 ~5.78 MB 가 각자 생성·보유**된다 (2026-07-31 처녀 힙 실측:
 * per-call 5.78 MB/paragraph vs 공유 collection 0 — wght 4종 순환에서도 0).
 *
 * 실문서(22페이지)에서 이 비용이 WASM 힙 1,090 MB 의 지배 성분이었고,
 * ADR-174 Phase 2 의 retained 보유 확대와 결합해 wasm32 2 GiB 상한 도달 →
 * paragraph/PictureRecorder 할당 실패 → 텍스트 소실·렌더 정지가 됐다.
 *
 * 계약: renderText 의 paragraph 생성은 `MakeFromFontCollection` +
 * `skiaFontManager.getFontCollection()` (공유, fontMgr 수명 동기) 경유만.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./nodeRendererText.ts", import.meta.url),
  "utf8",
);

describe("renderText 공유 FontCollection 계약", () => {
  it("paragraph builder 는 MakeFromFontCollection 경유만 사용한다", () => {
    expect(src).toContain("MakeFromFontCollection");
    expect(src).toContain("skiaFontManager.getFontCollection()");
  });

  it("per-call collection 을 만드는 ParagraphBuilder.Make 는 없다", () => {
    expect(src).not.toMatch(/ParagraphBuilder\.Make\(/);
  });
});
