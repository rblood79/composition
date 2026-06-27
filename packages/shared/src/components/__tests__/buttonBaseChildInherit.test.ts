import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * .button-base 자식(Icon/Text/Label) color 상속 규칙 회귀 테스트 (2026-06-27).
 *
 * **근본 원인**: `.react-aria-Button` 자식이 부모 color 를 상속하는 규칙
 *   (`> :is(.react-aria-Icon, .react-aria-Text, .react-aria-Label) { color: inherit }`)
 *   은 Button.css 에만 있고 ToggleButton 에는 누락됐다. ToggleButton 자식 Icon/Text 는
 *   generated Icon.css/Text.css 의 `color: var(--fg)`([data-variant], 0-2-0) 로 어두운 색이
 *   고정되어, selected 시 부모 ToggleButton 이 `--button-text: var(--bg)`(밝은 색)가 돼도
 *   자식 텍스트·아이콘은 어두운 채로 남아(black) selected 배경 위에서 묻혔다. Skia 는
 *   resolveButtonChildColor(ToggleButton 포함)로 정상 상속 → CSS↔Skia 비대칭.
 *
 * **수정**: utilities.css `.button-base` 에 공통 inherit 규칙을 두어 Button + ToggleButton
 *   둘 다 커버. specificity 0-3-0 유지(generated 0-2-0 을 확정적으로 이김):
 *   `:is(.react-aria-Button, .react-aria-ToggleButton).button-base
 *      > :is(.react-aria-Icon, .react-aria-Text, .react-aria-Label) { color: inherit }`.
 *
 * CSS cascade computed color 는 jsdom 없이 검증 불가하므로, 규칙 존재를 contract 로 고정한다.
 * 실제 selected computed color 정합은 live(빌더 Preview DOM) 로 확증.
 */

const utilitiesCss = readFileSync(
  fileURLToPath(new URL("../styles/utilities.css", import.meta.url)),
  "utf8",
);

/** 공백/줄바꿈을 정규화해 selector 매칭을 안정화. */
const normalized = utilitiesCss.replace(/\s+/g, " ");

describe(".button-base 자식 color 상속 (Button + ToggleButton 공통)", () => {
  it("utilities.css 에 Button + ToggleButton 둘 다 커버하는 inherit 규칙 존재", () => {
    expect(normalized).toMatch(/\.react-aria-Button/);
    expect(normalized).toMatch(/\.react-aria-ToggleButton/);
    // 한 규칙(:is(...)) 으로 Button/ToggleButton 을 함께 커버하는지
    expect(normalized).toMatch(
      /:is\([^)]*\.react-aria-Button[^)]*\.react-aria-ToggleButton[^)]*\)\.button-base\s*>\s*:is\([^)]*\.react-aria-Icon[^)]*\.react-aria-Text[^)]*\.react-aria-Label[^)]*\)\s*\{\s*color:\s*inherit/,
    );
  });

  it("inherit 규칙이 Icon/Text/Label 세 leaf 를 모두 명시(specificity 0-3-0 보장)", () => {
    const m = normalized.match(
      /\.button-base\s*>\s*:is\(([^)]*)\)\s*\{\s*color:\s*inherit/,
    );
    expect(m).not.toBeNull();
    const inner = m![1];
    expect(inner).toContain(".react-aria-Icon");
    expect(inner).toContain(".react-aria-Text");
    expect(inner).toContain(".react-aria-Label");
  });
});
