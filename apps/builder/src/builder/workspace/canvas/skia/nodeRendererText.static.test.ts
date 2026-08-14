// @vitest-environment node
/**
 * paragraph builder — 공유 FontCollection 정적 가드
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
 * 계약: paragraph 생성은 `MakeFromFontCollection` +
 * `skiaFontManager.getFontCollection()` (공유, fontMgr 수명 동기) 경유만.
 *
 * 스캔 범위는 skia/ 디렉터리 전체다 — nodeRendererText 단일 파일만 보던
 * 시절 nodeRendererImage(alt 텍스트 렌더)가 사각지대로 남아 per-call
 * `ParagraphBuilder.Make` 가 잔존했다 (2026-08-14 simplify 리뷰 발견).
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const skiaDir = dirname(fileURLToPath(import.meta.url));
const sourceFiles = readdirSync(skiaDir).filter(
  (f) =>
    (f.endsWith(".ts") || f.endsWith(".tsx")) &&
    !f.includes(".test.") &&
    !f.endsWith(".bench.ts"),
);

const textSrc = readFileSync(join(skiaDir, "nodeRendererText.ts"), "utf8");

describe("paragraph builder 공유 FontCollection 계약", () => {
  it("renderText 는 MakeFromFontCollection + 공유 collection 경유", () => {
    expect(textSrc).toContain("MakeFromFontCollection");
    expect(textSrc).toContain("skiaFontManager.getFontCollection()");
  });

  it("skia/ 어디에도 per-call ParagraphBuilder.Make 가 없다", () => {
    // 주석 줄(위험을 설명하는 문서 인용 — fontManager.ts 등)은 제외하고
    // 실제 코드 줄만 검사한다.
    const offenders = sourceFiles.filter((f) =>
      readFileSync(join(skiaDir, f), "utf8")
        .split("\n")
        .some(
          (line) =>
            !/^\s*(\*|\/\/)/.test(line) &&
            /ParagraphBuilder\.Make\(/.test(line),
        ),
    );
    expect(offenders).toEqual([]);
  });
});
