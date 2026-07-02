import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * CalendarHeader chevron glyph 크기 계약 — CSS(DOM) ↔ Skia 대칭 (2026-07-02).
 *
 * CalendarHeader 는 DOM 독립 노드가 없고 부모 Calendar/RangeCalendar 가 `<header>` 를 self-compose 한다.
 *   그 안 prev/next chevron 은 `<ChevronLeft size={16}>` / `<ChevronRight size={16}>` — **size prop 무관
 *   고정 16px** Lucide glyph (Calendar.tsx:114-120 / RangeCalendar.tsx:94-98). 프로젝트 DOM 아이콘 공통
 *   고정-크기 컨벤션(TagGroup remove X, Tree chevron 등 동일).
 *
 * Skia 는 `inline_icon_text` primitive(replace 모드)가 좌 chevron + center text + 우 chevron 자체 생성.
 *   과거 chevron glyph 를 `fontSize + 2`(rule size.fontSize 토큰 파생)로 그려 size 별 가변(sm14/md16/lg18)
 *   → md 만 우연히 16 일치, sm 은 Skia 2px 작고 lg 는 Skia 2px 큼(CSS↔Skia 비대칭). 본 계약은 chevron
 *   glyph 를 전 size 고정 16 으로 못 박아 DOM `size={16}` 과 대칭시킨다(TagGroup remove X 축1 동형 판정).
 *
 * ⚠️ layout iconSize(sm20/md26/lg32) 는 cellSize(=iconSize+4) 좌표 계산 전용 — glyph 크기와 분리.
 *   glyph 크기만 16 고정, cellSize/text 좌표는 iconSize 유지(위치 회귀 방지).
 */

const CHEVRON_DOM_PX = 16; // Calendar.tsx <ChevronLeft size={16}> 고정

function sizeSpec(
  fontSize: string,
  iconSize: number,
  height: number,
): SizeSpec {
  return {
    fontSize: fontSize as never,
    borderRadius: "{radius.none}" as never,
    height,
    iconSize,
    gap: 6,
    paddingX: 0,
    paddingY: 0,
  };
}

// CalendarHeader rule.sizes 미러 (componentRulesTable.CalendarHeader.sizes).
const sizeSm = sizeSpec("{typography.text-xs}", 20, 24); // text-xs=12
const sizeMd = sizeSpec("{typography.text-sm}", 26, 30); // text-sm=14
const sizeLg = sizeSpec("{typography.text-base}", 32, 36); // text-base=16

// CalendarHeader rule.variants.default 미러 (좌우 chevron + neutral text).
const visual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.transparent}" as never,
      hover: "{color.transparent}" as never,
      pressed: "{color.transparent}" as never,
    },
  },
  text: "{color.neutral}" as never,
  leadingIcon: {
    name: "chevron-left",
    gap: 0,
    color: "{color.neutral}" as never,
  },
  trailingIcon: {
    name: "chevron-right",
    gap: 0,
    color: "{color.neutral}" as never,
  },
  textAlign: "center",
} as ComponentVisualRule;

const draw = getSkiaPrimitive("inline_icon_text")!;

function chevrons(shapes: Shape[]): Shape[] {
  return shapes.filter(
    (s) =>
      s.type === "icon_font" &&
      ((s as { iconName?: string }).iconName === "chevron-left" ||
        (s as { iconName?: string }).iconName === "chevron-right"),
  );
}

describe("skiaPrimitive 'inline_icon_text' — CalendarHeader chevron 크기(고정 16, CSS size={16} 대칭)", () => {
  it("registry 에 replace 모드로 등록", () => {
    expect(draw).toBeDefined();
    expect(getSkiaPrimitiveMode("inline_icon_text")).toBe("replace");
  });

  it("좌·우 chevron glyph fontSize = 16 고정 (md — DOM size={16} 정확 일치)", () => {
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: 220 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const cs = chevrons(shapes);
    expect(cs).toHaveLength(2);
    cs.forEach((c) => {
      expect((c as { fontSize?: number }).fontSize).toBe(CHEVRON_DOM_PX);
    });
  });

  it("sm 에서도 chevron 16 고정 (과거 fontSize+2=14 회귀 방지 — DOM 16 보다 작아짐)", () => {
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: 180 },
      size: sizeSm,
      visual,
      style: undefined,
    })!;
    chevrons(shapes).forEach((c) => {
      expect((c as { fontSize?: number }).fontSize).toBe(CHEVRON_DOM_PX);
    });
  });

  it("lg 에서도 chevron 16 고정 (과거 fontSize+2=18 회귀 방지 — DOM 16 보다 커짐)", () => {
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: 260 },
      size: sizeLg,
      visual,
      style: undefined,
    })!;
    chevrons(shapes).forEach((c) => {
      expect((c as { fontSize?: number }).fontSize).toBe(CHEVRON_DOM_PX);
    });
  });

  it("center text fontSize 는 rule size.fontSize 유지 (chevron 고정과 무관 — text 는 size 비례)", () => {
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: 220 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const text = shapes.find((s) => s.type === "text")!;
    // text-sm=14 (chevron 16 고정이 text 에 새면 안 됨).
    expect((text as { fontSize?: number }).fontSize).toBe(14);
  });

  it("cellSize/text 좌표는 layout iconSize 유지 (glyph 16 고정이 위치 안 흔듦)", () => {
    const cw = 220;
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const cs = chevrons(shapes);
    // cellSize = iconSize(26) + 4 = 30. 좌 chevron x = cellSize/2 = 15, 우 = cw - 15 = 205.
    const left = cs.find(
      (c) => (c as { iconName?: string }).iconName === "chevron-left",
    )!;
    const right = cs.find(
      (c) => (c as { iconName?: string }).iconName === "chevron-right",
    )!;
    expect((left as { x?: number }).x).toBe(15);
    expect((right as { x?: number }).x).toBe(cw - 15);
  });
});
