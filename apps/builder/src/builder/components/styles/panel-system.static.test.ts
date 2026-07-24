import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-163 Phase 1 — 패널 표준 CSS 정본 정적 가드.
 *
 * panel-system.css 의 `.section { … }` 블록 안에 `.panel-wrapper` 를 포함한
 * 선택자가 있으면, CSS 네이티브 중첩 규칙상 조상-자손 순서가 실제 DOM
 * (`.panel-wrapper[data-panel] > .panel > .panel-contents > .section > .section-content`)
 * 과 반대가 되어 **영구 무매칭 dead 블록**이 된다. 이 가드는 그 재발을 차단한다.
 *
 * - 실제 DOM 에서 `.panel-wrapper` 는 패널 root(= `.section` 의 조상)라,
 *   `.section` 안에 `.panel-wrapper …` 를 중첩하면 절대 매칭되지 않는다.
 * - 패널 식별이 필요한 규칙은 `@layer` 최상위에 `.panel-wrapper[data-panel] .section …`
 *   순서(조상 먼저)로 두어야 live 다 (23/27행 패턴).
 */
describe("panel-system.css 표준 정본 가드 (ADR-163)", () => {
  const readSource = () =>
    readFile(resolve(__dirname, "panel-system.css"), "utf-8");

  /** `.section { … }` 최상위 블록을 중괄호 매칭으로 추출 */
  const extractSectionBlock = (css: string): string => {
    // `.section-content` / `.section-header` 같은 파생이 아닌 단독 `.section` 규칙
    const m = css.match(/\.section\s*\{/);
    expect(m, "`.section { …` 규칙이 존재해야 한다").not.toBeNull();
    const open = m!.index! + m![0].length - 1; // `{` 위치
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) return css.slice(open, i + 1);
      }
    }
    throw new Error(".section 블록의 닫는 중괄호를 찾지 못함");
  };

  it("`.section` 블록 내부에 `.panel-wrapper` 중첩 선택자 0건 (dead 블록 재발 차단)", async () => {
    const css = await readSource();
    // 주석은 판정 대상 아님 (설명 텍스트에 panel-wrapper 언급 허용) — 선택자만 검사
    const sectionBlock = extractSectionBlock(css).replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    // 블록 내부에 panel-wrapper 가 있으면 dead 중첩 → 위반
    const offenders = sectionBlock
      .split("\n")
      .filter((line) => line.includes("panel-wrapper"));
    expect(
      offenders,
      `dead 중첩 선택자 발견:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("패널 식별 live 규칙은 `@layer` 최상위에 조상-먼저 순서로 유지된다", async () => {
    const css = await readSource();
    // components / properties section-content 는 top-level(.section 조상 먼저)로 살아있어야 한다
    expect(css).toMatch(
      /\.panel-wrapper\[data-panel="components"\]\s+\.section\s+\.section-content/,
    );
    expect(css).toMatch(
      /\.panel-wrapper\[data-panel="properties"\]\s+\.section\s+\.section-content/,
    );
  });
});
