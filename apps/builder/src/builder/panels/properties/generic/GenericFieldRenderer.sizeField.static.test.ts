import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Properties 필드 규칙 (2026-09-15 사용자 판정 — Styles 패널 기준으로 정규화):
 * 선택지는 전부 셀렉트 (seg 없음) · 반폭 짝 (셀렉트 · 숫자 · 스위치) · 섹션 순서 고정 ·
 * 섹션 안은 kind 묶음 순서 · 선택지 1개 필드는 숨김.
 */
describe("Properties 필드 규칙 — 셀렉트 단일 · 반폭 짝 · 섹션/필드 순서", () => {
  it("variant/size/enum/fillStyle 은 셀렉트 하나 — PropertySizeToggle · seg 판정 없음", async () => {
    const source = await readFile(
      resolve(__dirname, "GenericFieldRenderer.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("PropertySizeToggle");
    expect(source).not.toContain("segFits");
    const choice = source.slice(
      source.indexOf('    case "variant":\n    case "enum":\n    case "fillStyle":\n    case "size":\n      return ('),
      source.indexOf('    case "boolean":\n      return ('),
    );
    expect(choice).toContain("<PropertySelect");
    expect(choice).not.toContain("options?.length");
  });

  it("반폭은 셀렉트 (글자 폭이 들어갈 때) · 숫자 · 스위치, 텍스트 · icon · 목록은 전폭", async () => {
    const source = await readFile(
      resolve(__dirname, "GenericFieldRenderer.tsx"),
      "utf-8",
    );
    const span = source.slice(
      source.indexOf("function fieldSpan("),
      source.indexOf("const SECTION_ORDER"),
    );
    expect(span).toContain("textWidth(field.label) > HALF_LEGEND");
    expect(span).toContain("HALF_SELECT_VALUE");
    expect(span).toContain('case "number":\n    case "boolean":');
    expect(span).toContain('default:\n      return "wide"');
  });

  it("섹션 순서 content → appearance → layout → state → interaction → locale, 필드는 kind 묶음", async () => {
    const source = await readFile(
      resolve(__dirname, "GenericFieldRenderer.tsx"),
      "utf-8",
    );
    expect(source).toContain(
      '"content",\n  "appearance",\n  "layout",\n  "state",\n  "interaction",\n  "locale",',
    );
    expect(source).toContain("packFieldRows(sortFields(sectionFields))");
    expect(source).toContain("isSingleChoice(field)");
  });
});
