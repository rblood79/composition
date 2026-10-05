// @vitest-environment node
/**
 * 2026-10-05 감사 M9 — retained paragraph hit 경로도 `clipText` clip 을 건다.
 *
 * miss 경로만 `clipRect(0, 0, w, h)` 를 걸어서, picture 가 LRU 로 퇴거된 뒤 다시 record 되거나
 * volatile 노드일 때 (hit 경로) 고정 높이 텍스트가 상자 아래로 넘쳐 그려졌다 (DOM 은 잘림).
 * 두 경로는 clip 을 포함한 draw 함수 하나를 부른다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "nodeRendererText.ts"),
  "utf8",
);

describe("renderText — hit · miss 경로의 clip 대칭", () => {
  it("retained hit 분기는 clip 을 거는 drawParagraphBox 를 부른다", () => {
    const start = source.indexOf("if (retained) {");
    const branch = source.slice(start, source.indexOf("return {", start));
    expect(start).toBeGreaterThan(-1);
    expect(branch).toContain("drawParagraphBox(");
    expect(branch).not.toContain("drawTextWithPresentationColor(");
  });

  it("drawParagraphBox 가 clipText (ellipsis 제외) clip 을 건다", () => {
    const start = source.indexOf("const drawParagraphBox = ");
    const body = source.slice(start, source.indexOf("\n  };", start));
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/node\.text\??\.clipText.*!isEllipsis/);
    expect(body).toContain("canvas.clipRect(");
  });
});

// 2026-10-05 감사 L11 — text-shadow · presentation 색 경로의 ColorFilter 핸들을 draw 마다 남기지
// 않는다. blur 필터처럼 saveLayer 뒤 (paint 가 sk_sp 로 쥔 뒤) delete 한다.
describe("renderText — ColorFilter 핸들 해제", () => {
  it("MakeMatrix 를 setColorFilter 에 바로 넘기지 않고, 만든 수만큼 delete 한다", () => {
    expect(source).not.toMatch(
      /setColorFilter\(\s*ck\.ColorFilter\.MakeMatrix/,
    );
    const made = source.match(/= ck\.ColorFilter\.MakeMatrix\(/g) ?? [];
    const deleted = source.match(/\b\w*[Ff]ilter\.delete\(\)/g) ?? [];
    expect(made.length).toBe(2);
    // blur 1 + color 2
    expect(deleted.length).toBeGreaterThanOrEqual(made.length + 1);
  });
});
