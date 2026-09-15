/**
 * Properties 필드 규칙 정적 가드 — 컨트롤 어법 (2026-09-15 사용자 판정).
 *
 * 종전 「선택지는 전부 셀렉트」 규칙 (2026-09-15 오전) 은 같은 날 「필드 의미별 컨트롤」 로 대체됐다:
 * 컨트롤은 `fieldEditor.ts` 매핑표가 정하고 (seg · 셀렉트 · 슬라이더 · 스텝퍼 · 칩 · 피커), 렌더러는
 * 그 결과를 dispatch 만 한다. boolean 은 섹션당 칩 묶음 — 스위치 0.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = () =>
  readFile(resolve(__dirname, "GenericFieldRenderer.tsx"), "utf-8");

describe("Properties 필드 규칙 — 매핑표 dispatch · 칩 묶음 · 섹션/필드 순서", () => {
  it("선택지 (variant/size/enum/fillStyle) 는 매핑표 (resolveFieldEditor) 가 컨트롤을 정한다", async () => {
    const s = await source();
    expect(s).not.toContain("PropertySizeToggle");
    expect(s).not.toContain("PropertySwitch");
    const choice = s.slice(
      s.indexOf(
        '    case "variant":\n    case "enum":\n    case "fillStyle":\n    case "size": {',
      ),
      s.indexOf('    case "boolean":\n      return null;'),
    );
    expect(choice).toContain('editor.type === "placement"');
    expect(choice).toContain('editor.type === "swatch-seg"');
    expect(choice).toContain('editor.type === "seg"');
    expect(choice).toContain("sizeSegOptions(options)");
    expect(choice).toContain("<PropertySelect");
    // 옵션 수·글자 폭으로 컨트롤을 가르는 판정은 렌더러에 없다 (매핑표 전용)
    expect(choice).not.toContain("options?.length");
    expect(choice).not.toContain("textWidth(");
  });

  it("옵션이 데이터에서 오는 필드 (literal 모드) 는 셀렉트 고정", async () => {
    const s = await source();
    expect(s).toContain(
      'optionValueMode === "literal"\n      ? { type: "select" }\n      : resolveFieldEditor(field)',
    );
  });

  it("폭 — seg 는 매핑표 · 셀렉트/스텝퍼는 legend·옵션 글자 폭 · 그 밖은 전폭", async () => {
    const s = await source();
    const span = s.slice(
      s.indexOf("function fieldSpan("),
      s.indexOf("const SECTION_ORDER"),
    );
    expect(span).toContain("resolveFieldEditor(field)");
    expect(span).toContain('case "seg":\n      return editor.span;');
    expect(span).toContain("textWidth(field.label) > HALF_LEGEND");
    expect(span).toContain("HALF_SELECT_VALUE");
    expect(span).toContain('case "stepper":');
    expect(span).toContain('default:\n      return "wide"');
  });

  it("boolean 은 섹션당 칩 묶음 (Options → Show → Fill), 칩이 게이트인 종속 필드는 묶음 아래", async () => {
    const s = await source();
    expect(s).toContain(
      'CHIP_GROUP_ORDER: readonly ChipGroup[] = ["Options", "Show", "Fill"]',
    );
    expect(s).toContain("splitChipFields(sectionFields)");
    expect(s).toContain("{renderRows(rows)}");
    expect(s).toContain("<ChipGroupField");
    expect(s).toContain("{renderRows(dependents)}");
    expect(s).toContain("useCanonicalPropertyValuesSnapshot(");
  });

  it("number — 상한 있는 키는 슬라이더 (직접 입력 값 칸), 나머지는 스텝퍼", async () => {
    const s = await source();
    expect(s).toContain('editor.type === "slider"');
    expect(s).toContain("<PropertySlider");
    expect(s).toContain("<PropertyNumberInput");
  });

  it("섹션 순서 content → appearance → layout → state → interaction → locale, 필드는 kind 묶음", async () => {
    const s = await source();
    expect(s).toContain(
      '"content",\n  "appearance",\n  "layout",\n  "state",\n  "interaction",\n  "locale",',
    );
    expect(s).toContain("packFieldRows(sortFields(list))");
    expect(s).toContain("isSingleChoice(field)");
  });
});
