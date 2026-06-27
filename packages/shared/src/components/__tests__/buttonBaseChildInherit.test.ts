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
 * **group span 회귀 (2026-06-27, 후속)**: group member ToggleButton 은 children 을
 *   `<span>` 으로 감싼다(`ToggleButton.tsx`, pressed micro-interaction `> span { scale:0.9 }`
 *   소비). 그 결과 DOM 이 `ToggleButton.button-base > span > (Icon, Text)` 가 되어 Icon/Text 가
 *   더 이상 button-base 의 **직계 자식**이 아니다 → `> :is(Icon,Text,Label)` 직계 selector 가
 *   span 을 건너뛰지 못해 inherit 가 끊겼다. span 자체는 흰색을 상속받지만 Icon/Text leaf 는
 *   generated `.react-aria-Icon[data-variant]`(0-2-0) 의 `color: var(--fg)` 가 자연 상속을 막아
 *   black 잔존. Skia 는 parent_id 기반(span 은 DOM-only, store 트리 미존재)이라 정상 → CSS↔Skia
 *   비대칭. 수정: 직계 규칙에 더해 `> span >` 경유 규칙을 추가(specificity 0-4-0, 직계 0-3-0 과
 *   별개 selector). live: selected group ToggleButton 의 Icon/Text computed color 가 부모와 동일.
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

  it("group span 경유(`> span > Icon/Text/Label`) inherit 규칙 존재 — group ToggleButton 자식 black 방지", () => {
    // group member ToggleButton 은 children 을 <span> 으로 감싸 Icon/Text 가 직계가 아니게 된다.
    // 직계 규칙(`> :is(...)`) 은 span 을 건너뛰지 못하므로 `> span > :is(...)` 경로가 필요.
    expect(normalized).toMatch(
      /\.button-base\s*>\s*span\s*>\s*:is\([^)]*\.react-aria-Icon[^)]*\.react-aria-Text[^)]*\.react-aria-Label[^)]*\)\s*\{\s*color:\s*inherit/,
    );
  });
});
