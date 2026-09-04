/**
 * PANEL_STYLE_PROPS(modify 뱃지·Modified Styles 범위 SSOT) ↔ 4섹션 reset PROPS union 일치 가드.
 *
 * Why: "modify N" 뱃지(`useDirtyStyleProps`)는 `PANEL_STYLE_PROPS` 로, 각 섹션 reset 버튼
 * (`useHasDirtyStyles`)은 {TRANSFORM,LAYOUT,APPEARANCE,TYPOGRAPHY}_PROPS 로 dirty 를 판정한다.
 * 둘이 어긋나면 "modify N 인데 reset 0"(또는 역) 비대칭이 재발한다(grid placement 키 사례,
 * 2026-06-24). 섹션 PROPS 를 추가/삭제하면 본 가드가 PANEL_STYLE_PROPS 동반 갱신을 강제한다.
 *
 * 섹션 PROPS 는 공통 유틸리티에 보관되므로 본 가드는 소스 텍스트에서 배열을
 * 정규식 추출해 union 을 만든다 — import 불가능한 내부 상수의 정적 계약을 텍스트 레벨로 검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PANEL_STYLE_PROPS } from "../useResetStyles";

const here = dirname(fileURLToPath(import.meta.url));
const sectionsDir = resolve(here, "../../sections");

const SECTION_FILES: Record<string, string> = {
  TRANSFORM_PROPS: "styleSectionProps.ts",
  LAYOUT_PROPS: "styleSectionProps.ts",
  APPEARANCE_PROPS: "styleSectionProps.ts",
  TYPOGRAPHY_PROPS: "styleSectionProps.ts",
};

/** `const NAME_PROPS = [ "a", "b", ... ];` 배열 리터럴에서 문자열 항목을 추출. */
function extractPropsArray(source: string, constName: string): string[] {
  const re = new RegExp(`const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, "m");
  const match = source.match(re);
  if (!match) throw new Error(`${constName} 배열을 찾지 못함`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("PANEL_STYLE_PROPS ↔ 섹션 reset PROPS union 정합", () => {
  it("4섹션 PROPS union 과 PANEL_STYLE_PROPS 가 정확히 일치", () => {
    const union = new Set<string>();
    for (const [constName, file] of Object.entries(SECTION_FILES)) {
      const source = readFileSync(resolve(sectionsDir, file), "utf8");
      for (const prop of extractPropsArray(source, constName)) union.add(prop);
    }

    const panel = new Set(PANEL_STYLE_PROPS);

    const missingFromPanel = [...union].filter((p) => !panel.has(p)).sort();
    const extraInPanel = [...panel].filter((p) => !union.has(p)).sort();

    expect(
      missingFromPanel,
      `섹션 PROPS 에 있으나 PANEL_STYLE_PROPS 누락(modify 가 안 셈 → reset 만 활성 비대칭):\n  ${missingFromPanel.join(", ")}`,
    ).toEqual([]);
    expect(
      extraInPanel,
      `PANEL_STYLE_PROPS 에 있으나 어느 섹션도 reset 안 함(modify 만 활성 비대칭):\n  ${extraInPanel.join(", ")}`,
    ).toEqual([]);
  });
});
