import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-166 Phase 5 — `emitContainerStyles` 가 토큰 해석을 **거치는지** 를 소스로 잠근다.
 *
 * CSSGenerator 안에는 boxShadow 를 내보내는 자리가 여럿이고(states / indicatorMode /
 * containerStyles), 그중 containerStyles 만 Phase 2 이전까지 `resolveBoxShadow` 를 우회해
 * 값을 그대로 흘렸다. 그래서 catalog 에 `{shadow.md}` 를 넣으면 CSS 에 리터럴 `{shadow.md}`
 * 가 박혀 **선언이 통째로 무효**가 됐다 — 브라우저는 파싱 실패한 선언을 조용히 버리므로
 * 스냅샷도 "그림자 없음"으로 통과해 버린다. 값 단언으로는 잡히지 않는 결함이라 경유 자체를 본다.
 *
 * 동형 선례: `historyActions.static.test.ts` (source-order 정적 가드).
 */
describe("CSSGenerator — containerStyles boxShadow 토큰 해석 경유 (ADR-166)", () => {
  it("emitContainerStyles 가 resolveBoxShadow 를 거친다", async () => {
    const source = await readFile(
      resolve(__dirname, "../CSSGenerator.ts"),
      "utf-8",
    );

    expect(source).toContain("box-shadow: ${resolveBoxShadow(c.boxShadow)};");
    // 구 형태 — 토큰을 해석하지 않고 그대로 흘리던 우회 경로.
    expect(source).not.toContain("box-shadow: ${c.boxShadow};");
  });

  it("resolveBoxShadow 는 {shadow.*} 를 CSS 변수로 바꾼다", async () => {
    const source = await readFile(
      resolve(__dirname, "../CSSGenerator.ts"),
      "utf-8",
    );
    // 정의부가 사라지면 위 단언이 심볼만 맞고 의미를 잃는다.
    expect(source).toMatch(/function resolveBoxShadow|const resolveBoxShadow/);
  });
});
