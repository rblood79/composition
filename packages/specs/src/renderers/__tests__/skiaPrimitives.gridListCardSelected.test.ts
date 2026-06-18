import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-913 slice 4 (2026-06-19) — gridlist_card selected accent border 회귀 게이트.
 *
 * **갭**: gridListCard(replace 모드, buildCatalogShapes 우회)가 `props.isSelected` 분기를
 * 갖지 않아 selected 카드도 default border({color.border}) 1px 로만 그렸다. DOM(builder
 * GridList.css `[data-selected]{border-color:var(--accent);border-width:2px}`)은 accent 2px
 * → CSS↔Skia 비대칭(D3 G3). 형제 listbox_item 은 isSelected → accent-subtle row-bg honor.
 *
 * **fix**: gridListCard borderColor = isSelected ? (visual.selectedBorder ?? {color.accent})
 * : visual.border. borderWidth = isSelected ? 2 : size.borderWidth. style.borderColor/
 * borderWidth 사용자 편집 우선 보존.
 */

// GridListItem rule.sizes.md 미러.
const sizeMd: SizeSpec = {
  height: 0,
  paddingX: 16,
  paddingY: 12,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.lg}" as never,
  gap: 2,
  borderWidth: 1,
};

// GridListItem rule.variants.default 미러 (selectedBorder accent 추가).
const visual = {
  fill: { default: { base: "{color.layer-1}" } },
  text: "{color.neutral}",
  border: "{color.border}",
  selectedBorder: "{color.accent}",
} as unknown as ComponentVisualRule;

const draw = getSkiaPrimitive("gridlist_card")!;

function borderShape(shapes: Shape[] | null): Shape | undefined {
  return (shapes ?? []).find((s) => (s as { type?: string }).type === "border");
}

describe("gridlist_card selected accent border (ADR-913 slice 4 — DOM 대칭)", () => {
  it("isSelected=false → border = visual.border(1px)", () => {
    const shapes = draw({
      props: { children: "Card", isSelected: false },
      size: sizeMd,
      visual,
      style: {},
    } as Parameters<typeof draw>[0]);
    const border = borderShape(shapes) as
      | { color?: string; borderWidth?: number }
      | undefined;
    expect(border?.color).toBe("{color.border}");
    expect(border?.borderWidth).toBe(1);
  });

  it("isSelected=true → border = visual.selectedBorder(accent, 2px)", () => {
    const shapes = draw({
      props: { children: "Card", isSelected: true },
      size: sizeMd,
      visual,
      style: {},
    } as Parameters<typeof draw>[0]);
    const border = borderShape(shapes) as
      | { color?: string; borderWidth?: number }
      | undefined;
    expect(border?.color).toBe("{color.accent}");
    expect(border?.borderWidth).toBe(2);
  });

  it("isSelected=true 인데 selectedBorder 미정의 → {color.accent} fallback", () => {
    const visualNoSel = { ...visual, selectedBorder: undefined };
    const shapes = draw({
      props: { children: "Card", isSelected: true },
      size: sizeMd,
      visual: visualNoSel,
      style: {},
    } as Parameters<typeof draw>[0]);
    const border = borderShape(shapes) as { color?: string } | undefined;
    expect(border?.color).toBe("{color.accent}");
  });

  it("style.borderColor/borderWidth 사용자 편집 우선 (selected 여도 보존)", () => {
    const shapes = draw({
      props: { children: "Card", isSelected: true },
      size: sizeMd,
      visual,
      style: { borderColor: "#ff0000", borderWidth: "3px" },
    } as Parameters<typeof draw>[0]);
    const border = borderShape(shapes) as
      | { color?: string; borderWidth?: number }
      | undefined;
    expect(border?.color).toBe("#ff0000");
    expect(border?.borderWidth).toBe(3);
  });
});
