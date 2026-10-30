/**
 * Publish 의 CSS Reset 은 layer 밖이라 생성 시트의 `@layer components` 선언을 모두 이긴다. form control 에
 * `font: inherit` 를 주면 행간 · 글자 크기까지 body 값을 받아 catalog 의 Input 행간 (S2 식) 이 사라진다 —
 * Preview reset (`apps/builder/src/preview/baseStyles.ts`) 처럼 글꼴 이름 · 글꼴 기능만 상속한다
 * (ADR-295 Phase 4 G5: Publish Input 35 vs Preview 32).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../styles/index.css"), "utf8");

describe("Publish reset — form control", () => {
  it("does not reset the line height or size of form controls", () => {
    const rule = /input,\s*button,\s*textarea,\s*select\s*\{([^}]*)\}/.exec(
      css,
    );
    expect(rule).not.toBeNull();
    const body = rule![1]!;
    expect(body).not.toMatch(/(^|[\s;])font\s*:/);
    expect(body).not.toMatch(/line-height|font-size/);
    expect(body).toMatch(/font-family:\s*inherit/);
  });
});
