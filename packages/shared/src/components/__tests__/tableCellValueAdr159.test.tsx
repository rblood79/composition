/**
 * ADR-159 P5: DOM Table 셀 값 렌더 (renderTableCellValue) — array → read-only
 * TagGroup 칩 placeholder / object → 휴리스틱 label / scalar 는 기존 passthrough (BC).
 * Skia projection(appendTableRowProjection)과 동일 분류(shared classifyTableCellDisplay)
 * 를 소비하는 DOM 측 계약 (G2 대칭).
 *
 * RTL/jsdom 없이 react-dom/server renderToStaticMarkup 로 정적 출력 직접 검사
 * (Avatar.test.tsx 패턴 — packages/shared 는 @testing-library 미보유).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderTableCellValue } from "../Table";

const tagTexts = (html: string): string[] => {
  const matches = html.matchAll(
    /class="[^"]*react-aria-Tag[^"]*"[^>]*>([\s\S]*?)<\//g,
  );
  return Array.from(matches, (match) => match[1].replace(/<[^>]*>/g, ""));
};

describe("renderTableCellValue — ADR-159 P5", () => {
  it("array → TagGroup 칩 (cap 3 + '+N' overflow)", () => {
    const html = renderToStaticMarkup(
      <>{renderTableCellValue(["ts", "rust", "go", "sql", "wasm"])}</>,
    );
    expect(html).toContain("table-cell-tag-group");
    expect(tagTexts(html)).toEqual(["ts", "rust", "go", "+2"]);
  });

  it("record 원소 배열 → label 휴리스틱 칩", () => {
    const html = renderToStaticMarkup(
      <>{renderTableCellValue([{ label: "L1" }, { name: "N2" }])}</>,
    );
    expect(tagTexts(html)).toEqual(["L1", "N2"]);
  });

  it("object → 휴리스틱 label 텍스트 (구 JSON.stringify 개선)", () => {
    expect(renderTableCellValue({ name: "Kim", city: "Seoul" })).toBe("Kim");
  });

  it("scalar/null 은 기존 passthrough 그대로 (BC — boolean 미문자열화 포함)", () => {
    expect(renderTableCellValue("abc")).toBe("abc");
    expect(renderTableCellValue(7)).toBe(7);
    expect(renderTableCellValue(true)).toBe(true);
    expect(renderTableCellValue(null)).toBe(null);
  });

  it("React element 는 그대로 통과", () => {
    const element = <span>el</span>;
    expect(renderTableCellValue(element)).toBe(element);
  });

  it("빈 배열 → 칩 없이 빈 텍스트", () => {
    const html = renderToStaticMarkup(<>{renderTableCellValue([])}</>);
    expect(html).not.toContain("react-aria-Tag");
    expect(html).toBe("");
  });
});
