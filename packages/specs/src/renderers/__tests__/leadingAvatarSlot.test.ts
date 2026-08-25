import { describe, expect, it } from "vitest";

import { buildCatalogShapes, resolveLeadingSlot } from "./catalogPaintFixture";
import { getSkiaPrimitive, getSkiaPrimitiveMode } from "./catalogPaintFixture";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * design-data 감사 — Tag chip 항목별 avatar 슬롯 (2026-08-21).
 *
 * avatar 는 icon 과 **같은 좌측 슬롯**을 쓰는 다른 표현(폰트 glyph → 원형 이미지)이다.
 * 둘을 나란히 그리면 chip(fit-content) 폭과 시각이 어긋나므로 `resolveLeadingSlot` 이
 * 하나만 고르고, 그 결론을 폭 shift(buildCatalogShapes)와 그리기 primitive 가 공유한다.
 */

const size = {
  height: 28,
  paddingX: 12,
  paddingY: 4,
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
  leadingAvatar: {
    srcProp: "avatar",
    size: 16,
    gap: 4,
    fallbackFill: "{color.neutral-subtle}",
  },
} as unknown as ComponentVisualRule;

const textX = (props: Record<string, unknown>): number => {
  const shapes = buildCatalogShapes(visual, props, size) as Array<
    Shape & { type: string; x?: number }
  >;
  return shapes.find((s) => s.type === "text")!.x as number;
};

describe("leadingAvatar — 좌측 슬롯 단일 판정", () => {
  it("avatar 가 icon 을 이기고, 없으면 icon, 둘 다 없으면 슬롯 없음", () => {
    expect(
      resolveLeadingSlot(visual, { icon: "star", avatar: "/a.png" }, size, 14),
    ).toMatchObject({ kind: "avatar", src: "/a.png", size: 16, width: 20 });
    expect(
      resolveLeadingSlot(visual, { icon: "star" }, size, 14),
    ).toMatchObject({ kind: "icon", name: "star", size: 14, width: 18 });
    expect(resolveLeadingSlot(visual, {}, size, 14)).toBeNull();
    // 빈 문자열은 "값 없음" (행 데이터 게이팅 — icon 의 nameProp 과 동형)
    expect(resolveLeadingSlot(visual, { avatar: "" }, size, 14)).toBeNull();
  });

  it("text shift 폭이 슬롯 종류를 따른다 (avatar 20 / icon 18 / 없음 0)", () => {
    expect(textX({ children: "Tag" })).toBe(12);
    expect(textX({ children: "Tag", icon: "star" })).toBe(12 + 18);
    expect(textX({ children: "Tag", avatar: "/a.png" })).toBe(12 + 20);
    // 둘 다 있어도 폭은 avatar 하나 — 더해지면 라벨이 밀려 잘린다
    expect(textX({ children: "Tag", icon: "star", avatar: "/a.png" })).toBe(
      12 + 20,
    );
  });

  it("primitive 2종이 슬롯 판정을 공유한다 — 동시에 그리지 않는다", () => {
    const drawIcon = getSkiaPrimitive("leading_icon")!;
    const drawAvatar = getSkiaPrimitive("leading_avatar")!;
    const ctx = (props: Record<string, unknown>) =>
      ({ props, size, visual, style: undefined }) as never;

    // avatar 보유 항목: icon 은 침묵하고 avatar 만 그린다
    expect(drawIcon(ctx({ icon: "star", avatar: "/a.png" }))).toHaveLength(0);
    const avatarShapes = drawAvatar(
      ctx({ icon: "star", avatar: "/a.png" }),
    ) as Array<{ type: string; src?: string; radius?: number; y?: number }>;
    expect(avatarShapes.map((s) => s.type)).toEqual(["circle", "image"]);
    // 원형 클립 + 세로 중앙 (chip height 28, 지름 16 → top 6)
    expect(avatarShapes[1]).toMatchObject({ src: "/a.png", radius: 8, y: 6 });

    // icon 만 있는 항목: avatar 는 침묵
    expect(drawAvatar(ctx({ icon: "star" }))).toHaveLength(0);
    expect(drawIcon(ctx({ icon: "star" }))).toHaveLength(1);

    // 슬롯 없는 항목: 둘 다 침묵
    expect(drawIcon(ctx({}))).toHaveLength(0);
    expect(drawAvatar(ctx({}))).toHaveLength(0);
  });

  it("leading_avatar 는 append — base box+text 를 대체하지 않는다", () => {
    expect(getSkiaPrimitiveMode("leading_avatar")).toBe("append");
  });
});
