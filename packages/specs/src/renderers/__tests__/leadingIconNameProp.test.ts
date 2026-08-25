import { describe, expect, it } from "vitest";

import {
  buildCatalogShapes,
  resolveLeadingIconName,
} from "./catalogPaintFixture";
import { getSkiaPrimitive } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * design-data 감사 — Tag chip 항목별 leading icon (2026-08-21).
 *
 * chip 아이콘은 **항목 데이터**라 rule 에 정적 이름을 둘 수 없다. `leadingIcon.nameProp` 으로
 * `props.icon` 을 읽고, 값이 없으면 glyph 도 text shift 도 하지 않는다 — 아이콘 없는 chip 이
 * 좌측 여백만 넓어지면 fit-content 폭이 그대로 발산하기 때문. 폭 shift(buildCatalogShapes)와
 * glyph(leading_icon primitive)가 **같은 helper** 로 판정해야 둘이 어긋나지 않는다.
 */

const size = {
  height: 24,
  paddingX: 8,
  paddingY: 2,
  iconSize: 14,
  fontSize: 14,
  lineHeight: 20,
  borderRadius: 4,
} as unknown as SizeSpec;

const visual = {
  fill: { default: { base: "{color.layer-1}" } },
  text: "{color.neutral}",
  border: "{color.border}",
  leadingIcon: { nameProp: "icon", gap: 4, color: "{color.neutral}" },
} as unknown as ComponentVisualRule;

const textX = (props: Record<string, unknown>): number => {
  const shapes = buildCatalogShapes(visual, props, size) as Array<
    Shape & { type: string; x?: number }
  >;
  const text = shapes.find((s) => s.type === "text")!;
  return text.x as number;
};

describe("leadingIcon.nameProp — 행 데이터 게이팅", () => {
  it("이름 해석: props 값 우선 → rule name 폴백 → 둘 다 없으면 null", () => {
    const li = { nameProp: "icon", name: "star" };
    expect(resolveLeadingIconName(li, { icon: "heart" })).toBe("heart");
    expect(resolveLeadingIconName(li, {})).toBe("star");
    expect(resolveLeadingIconName({ nameProp: "icon" }, {})).toBeNull();
    expect(
      resolveLeadingIconName({ nameProp: "icon" }, { icon: "" }),
    ).toBeNull();
    expect(resolveLeadingIconName(undefined, { icon: "star" })).toBeNull();
  });

  it("icon 있는 chip 만 text 가 iconSize+gap 만큼 밀린다", () => {
    expect(textX({ children: "Tag" })).toBe(8);
    expect(textX({ children: "Tag", icon: "star" })).toBe(8 + 14 + 4);
  });

  it("leading_icon primitive 는 props 이름으로 glyph 를 그리고, 없으면 미생성", () => {
    const draw = getSkiaPrimitive("leading_icon")!;
    const withIcon = draw({
      props: { children: "Tag", icon: "star" },
      size,
      visual,
      style: undefined,
    } as never) as Array<{
      type: string;
      iconName?: string;
      fontSize?: number;
    }>;
    expect(withIcon).toHaveLength(1);
    expect(withIcon[0].iconName).toBe("star");
    expect(withIcon[0].fontSize).toBe(14);

    const without = draw({
      props: { children: "Tag" },
      size,
      visual,
      style: undefined,
    } as never) as unknown[];
    expect(without).toHaveLength(0);
  });
});
