import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { COMPONENT_RULES_TABLE } from "../../catalog/generated/componentRulesTable";
import { ComboBox } from "../ComboBox";
import { DatePicker } from "../DatePicker";
import { DateRangePicker } from "../DateRangePicker";
import { SearchField } from "../SearchField";
import { Select } from "../Select";

/**
 * 트리거 아이콘 **glyph** 크기가 size 를 따른다 (2026-07-14, DatePicker 적발 → 전수 확장).
 *
 * **배경**: wrapper 들이 아이콘 svg 를 `width={16}` / `fontSize: 16` 으로 **16px 하드코딩**했다.
 * svg 의 `width`/`height` 는 **속성**이라 CSS 변수로 못 덮는다 → size 를 xs~xl 어디로 바꿔도
 * DOM glyph 는 항상 16 인데, Skia 는 `SelectIcon.sizes[*].iconSize`(14/16/18/22/28)로 그린다.
 *
 * **박스 ≠ glyph**: `--dp-btn-width` / `--select-chevron-size` 는 아이콘을 **감싸는 박스**(hit
 * target)일 뿐이다. 박스만 맞추고 "md 는 18=18 로 일치" 라고 오판했던 지점 — 실측하면 그 안의
 * glyph 는 16 이었다. 둘은 같은 아이콘 스케일을 공유하되 서로 다른 축이다.
 *
 * **불변식**: DOM glyph 크기 == catalog `SelectIcon.sizes[size].iconSize` (Skia 와 동일 source).
 */

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

/** Skia 가 icon_font glyph 를 그릴 때 쓰는 것과 **동일한** catalog 값. */
function catalogIconSize(size: string): number {
  const sizes = (COMPONENT_RULES_TABLE.SelectIcon?.sizes ?? {}) as Record<
    string,
    { iconSize?: number }
  >;
  return sizes[size]?.iconSize as number;
}

/** 정적 마크업의 첫 `<svg width="N">` — 트리거 아이콘 (popover 는 닫혀 있어 미출력). */
function firstSvgWidth(markup: string): string | null {
  const m = markup.match(/<svg[^>]*\swidth="(\d+)"/);
  return m ? m[1] : null;
}

const TARGETS = [
  { name: "DatePicker", Comp: DatePicker, props: { showCalendarIcon: true } },
  {
    name: "DateRangePicker",
    Comp: DateRangePicker,
    props: { showCalendarIcon: true },
  },
  { name: "Select", Comp: Select, props: {} },
  { name: "ComboBox", Comp: ComboBox, props: {} },
  { name: "SearchField", Comp: SearchField, props: {} },
] as const;

describe("트리거 아이콘 glyph 가 size 를 따른다 (DOM ↔ Skia 동일 source)", () => {
  describe.each(TARGETS)("$name", ({ Comp, props }) => {
    const renderAt = (size: (typeof SIZES)[number]) =>
      renderToStaticMarkup(
        React.createElement(
          Comp as React.ComponentType<Record<string, unknown>>,
          { size, ...props },
        ),
      );

    it.each(SIZES)(
      "size=%s glyph 크기 == catalog SelectIcon.iconSize",
      (size) => {
        expect(firstSvgWidth(renderAt(size))).toBe(
          String(catalogIconSize(size)),
        );
      },
    );

    it("size 를 바꾸면 glyph 크기가 실제로 달라진다 (16 고정 회귀 차단)", () => {
      const widths = SIZES.map((size) => firstSvgWidth(renderAt(size)));
      // 하드코딩 16 이면 5개가 전부 같아진다 — 최소 4종의 서로 다른 값이 나와야 정상.
      expect(new Set(widths).size).toBeGreaterThanOrEqual(4);
    });
  });
});
