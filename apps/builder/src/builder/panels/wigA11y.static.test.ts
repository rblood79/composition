/**
 * Web Interface Guidelines 감사 (2026-09-16) 회귀 가드 — 정적.
 *
 * - IconPickerPopover: 아이콘 ~1,800 개를 전부 그리지 않는다 (Virtualizer) · 검색 입력에서
 *   방향키로 그리드를 돈다 (Autocomplete + ListBox layout="grid").
 * - GradientBar 핸들: 드래그 전용이 아니다 — `role="slider"` + 키보드.
 * - GradientStopList 스와치 · ColumnSelector 행: `<div onClick>` 이 아니라 `<button>`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(resolve(__dirname, rel), "utf8");

describe("IconPickerPopover — 가상화 + 키보드 그리드", () => {
  const src = read("icons/IconPickerPopover.tsx");

  it("Virtualizer(GridLayout) 안의 ListBox layout=grid, Autocomplete 로 감싼다", () => {
    expect(src).toMatch(/<Virtualizer\s+layout=\{GridLayout\}/);
    expect(src).toMatch(/<ListBox[\s\S]*?layout="grid"/);
    expect(src).toMatch(/<Autocomplete\b/);
  });

  it("아이콘을 .map 으로 <button> 전량 렌더하지 않는다", () => {
    expect(src).not.toMatch(/filteredIcons\.map\([\s\S]*?<button/);
    expect(src).not.toMatch(/role="listbox"/);
  });

  it("스크롤 상자는 CSS 가 overflow 를 준다 (Virtualizer 는 inline 으로 주지 않는다)", () => {
    const css = read("icons/IconPickerPopover.css");
    expect(css).toMatch(/\.icon-picker-grid\s*\{[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.icon-picker-item\s*\{[^}]*block-size:\s*100%/);
  });
});

describe("GradientBar 핸들 — 키보드 대안", () => {
  const src = read("styles/components/GradientBar.tsx");

  it('핸들은 role="slider" + tabIndex + aria-valuenow + onKeyDown', () => {
    const handle = src.slice(src.indexOf('className="gradient-bar__handle"'));
    expect(handle).toMatch(/role="slider"/);
    expect(handle).toMatch(/tabIndex=\{0\}/);
    expect(handle).toMatch(/aria-valuenow=/);
    expect(handle).toMatch(/onKeyDown=/);
  });

  it("Home/End/Delete 를 처리한다", () => {
    expect(src).toMatch(/case "Home"/);
    expect(src).toMatch(/case "End"/);
    expect(src).toMatch(/case "Delete"/);
  });
});

describe("div onClick → button", () => {
  it("GradientStopList 스와치는 aria-pressed 버튼", () => {
    const src = read("styles/components/GradientStopList.tsx");
    expect(src).toMatch(
      /<button[\s\S]*?className="gradient-stop-list__swatch"[\s\S]*?aria-pressed=\{isActive\}/,
    );
  });

  it("ColumnSelector 행은 aria-pressed 토글 버튼", () => {
    const src = read("datatable/components/ColumnSelector.tsx");
    expect(src).not.toMatch(/<div[^>]*className=\{`column-item/);
    expect(src).toMatch(
      /<button[\s\S]*?className=\{`column-item[\s\S]*?aria-pressed=\{column\.selected\}/,
    );
  });
});

describe("아이콘 전용 버튼 — aria-label", () => {
  it.each([
    ["properties/generic/ChildItemManager.tsx", /aria-label=\{deleteLabel\}/],
    ["datatable/DataTablePanel.tsx", /aria-label=\{localize\("refresh"/],
    ["datatable/components/VariableList.tsx", /aria-label=\{localize\("edit"/],
    [
      "datatable/components/VariableList.tsx",
      /aria-label=\{localize\("delete"/,
    ],
    ["history/HistoryPanel.tsx", /history-snapshot-rename"\s+aria-label=/],
    [
      "datatable/editors/VariableEditor.tsx",
      /aria-labelledby=\{defaultValueHeadingId\}/,
    ],
  ])("%s", (rel, pattern) => {
    expect(read(rel)).toMatch(pattern);
  });
});
