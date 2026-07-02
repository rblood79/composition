import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec, TokenRef } from "../../types";

/**
 * DisclosureHeader chevron 크기 계약 — leading_icon glyph = size.iconSize (2026-07-02).
 *
 * DisclosureHeader 는 DOM 독립 노드가 없고 부모 Disclosure 가 `<Heading><Button slot="trigger">
 *   <svg class="disclosure-chevron">` 를 self-compose 한다(Disclosure.tsx:72-82). CSS cascade 실측
 *   (live getComputedStyle): DOM chevron 은 **전 size 18px 고정** — trigger Button 이 data-size 를 안
 *   받아 `.react-aria-Button` 기본 `--icon-size: 18px`(Button.css:40)이 적용되고 Disclosure.css 의
 *   size 반응 --icon-size(14/16/20)를 덮는다. TagGroup/CalendarHeader 와 동일한 DOM 고정-크기 컨벤션(값 18).
 *
 * Skia 는 `leading_icon` primitive(append)가 chevron glyph 를 rule `size.iconSize` 로 그린다
 *   (skiaPrimitives.ts `fontSize: iconSize`). 본 계약은 primitive 가 주어진 iconSize 를 glyph fontSize
 *   로 그대로 쓰는지 검증(fallback `round(fontSize×1.1)` 아님). rule sizes 의 iconSize 값 자체가 18 인지는
 *   shared 패키지 rule 값 계약 테스트(disclosureHeaderIconSize.test.ts)에서 검증 — package boundary(specs
 *   ← shared) 유지.
 */

const DOM_ICON_SIZE = 18; // .react-aria-Button 기본 --icon-size

// DisclosureHeader rule.sizes 미러 (paddingX 12 / height fontSize+16 / iconSize 18 고정).
function sizeSpec(fontSize: number): SizeSpec {
  return {
    fontSize,
    borderRadius: 0,
    height: fontSize + 16,
    paddingX: 12,
    iconSize: DOM_ICON_SIZE,
  } as unknown as SizeSpec;
}
const sizeSm = sizeSpec(12); // text-xs
const sizeMd = sizeSpec(14); // text-sm
const sizeLg = sizeSpec(16); // text-base

const visual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.transparent}" as TokenRef,
      hover: "{color.transparent}" as TokenRef,
      pressed: "{color.transparent}" as TokenRef,
    },
  },
  text: "{color.neutral}" as TokenRef,
  leadingIcon: {
    name: "chevron-right",
    gap: 6,
    color: "{color.neutral-subdued}" as TokenRef,
  },
} as ComponentVisualRule;

const draw = getSkiaPrimitive("leading_icon")!;

function chevron(shapes: ReturnType<typeof draw>) {
  return shapes!.find(
    (s) => s.type === "icon_font" && s.iconName === "chevron-right",
  )!;
}

describe("leading_icon glyph = size.iconSize (DisclosureHeader chevron, DOM 18 고정 대칭)", () => {
  it("sm: glyph fontSize = iconSize 18 (fallback round(12×1.1)=13 아님)", () => {
    const c = chevron(
      draw({ props: {}, size: sizeSm, visual, style: undefined }),
    );
    expect((c as { fontSize?: number }).fontSize).toBe(18);
  });

  it("md: glyph fontSize = iconSize 18 (과거 rule 15 회귀 방지)", () => {
    const c = chevron(
      draw({ props: {}, size: sizeMd, visual, style: undefined }),
    );
    expect((c as { fontSize?: number }).fontSize).toBe(18);
  });

  it("lg: glyph fontSize = iconSize 18 (size 무관 고정)", () => {
    const c = chevron(
      draw({ props: {}, size: sizeLg, visual, style: undefined }),
    );
    expect((c as { fontSize?: number }).fontSize).toBe(18);
  });

  it("chevron 좌표 = paddingX + iconSize/2, y = height/2 (glyph 크기 변경이 위치 공식 유지)", () => {
    const c = chevron(
      draw({ props: {}, size: sizeMd, visual, style: undefined }),
    );
    // paddingX 12 + iconSize 18 / 2 = 21. height 30 → y 15.
    expect((c as { x?: number }).x).toBe(12 + 18 / 2);
    expect((c as { y?: number }).y).toBe((14 + 16) / 2);
  });
});
