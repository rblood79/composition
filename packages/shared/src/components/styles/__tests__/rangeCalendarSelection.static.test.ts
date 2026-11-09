import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * RangeCalendar 범위 표시 = S2 형태 (사용자 2026-10-13 「RSC 와 같은 형태로 — 현재는 시작, 종료일이
 * 반원 형태다」 · S2 1.8.0 `Calendar.tsx` `cellInnerStyles` · `selectionBackgroundStyles` ·
 * `selectionBorderStyles`): 시작 · 종료일은 꽉 찬 원, 기간 뒤로 테두리 있는 연한 띠가 날짜 사이를
 * 메우고 기간 · 주 · 달의 끝에서 둥글게 끝난다. Canvas 는 달력 선택을 그리지 않는다 (Preview 실행
 * 상태) — 이 시트가 유일한 consumer.
 */
const sheet = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../RangeCalendar.css"),
  "utf8",
);
const range = sheet;
const block = (selector: string) => {
  const at = range.indexOf(selector);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return range.slice(at, range.indexOf("}", at));
};

describe("RangeCalendar selection = S2's", () => {
  it("the start and end dates are filled circles — not half-pill caps on the cell", () => {
    expect(range).not.toMatch(/\[data-selection-(start|end)\]::before/);
    expect(range).not.toMatch(/&\[data-selected\]::before/);
    expect(
      block("&[data-selection-start],\n      &[data-selection-end] {"),
    ).toMatch(/background: var\(--accent\);\s*color: var\(--fg-on-accent\);/);
  });

  // ADR-305 Phase 5 — 사용자 RangeCalendar 의 띠는 rule 트리 (`partStateStyles`) 의 생성 시트가 그린다. 수동 시트의
  // 같은 모양 블록은 Builder 위젯 몫 (`:not([data-catalog-id])`) 이었고 Builder 문서가 사용자 시트를 싣지 않게 되며 빠졌다.
  const generated = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../generated/RangeCalendar.css",
    ),
    "utf8",
  );
  const BAND =
    "td:has(> .react-aria-CalendarCell:where([data-selected])):not(:has(> [data-selection-start][data-selection-end]))";
  const genBlock = (selectorTail: string) => {
    const at = generated.indexOf(`${selectorTail} {`);
    expect(at, selectorTail).toBeGreaterThanOrEqual(0);
    return generated.slice(at, generated.indexOf("}", at));
  };

  it("a band behind the range (td ::before) with a border, not under a one-day range", () => {
    const band = genBlock(`${BAND}::before`);
    expect(band).toContain("background: var(--accent-subtle);");
    expect(band).toContain("border: 1px solid var(--focus-ring);");
    expect(band).toContain("border-inline-width: 0;");
  });

  it("the band rounds at the range's, the week's and the month's ends", () => {
    for (const edge of [
      `${BAND}:has(> [data-selection-start])::before`,
      `${BAND}:first-child::before`,
      `td:has(> [data-outside-month]) + ${BAND}::before`,
    ])
      expect(genBlock(edge)).toMatch(
        /border-start-start-radius: var\(--catalog-token-radius-full\)/,
      );
    for (const edge of [
      `${BAND}:has(> [data-selection-end])::before`,
      `${BAND}:last-child::before`,
    ])
      expect(genBlock(edge)).toMatch(
        /border-start-end-radius: var\(--catalog-token-radius-full\)/,
      );
  });
});
