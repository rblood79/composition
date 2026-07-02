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

describe("skiaPrimitive 'inline_icon_text' — center text 컨테이너 폭 중앙 정합 (flex space-between)", () => {
  // 근본: DOM Calendar `<header>` 는 flex(prev / heading flex:1 center / next) 라 월/년 text 가
  //   header 폭 정중앙. Skia 는 좌 chevron(x=cellSize/2) + text(center) + 우 chevron(x=width-cellSize/2)
  //   space-between 배치라, text 가 `[cellSize, width-cellSize]` 대칭 슬롯에서 center 되면 중심 = width/2.
  //   과거 text 에 `whiteSpace:"nowrap"` 이 붙어 nodeRendererText 가 layoutMaxWidth=100000 으로 덮어
  //   center 정렬이 무력화 → text 가 x=cellSize 에서 왼쪽 정렬(왼쪽 치우침). calendar_grid nav text 는
  //   nowrap 미지정이라 정상. 본 계약: nowrap 미지정 + x/maxWidth 대칭(중심 width/2) 유지.
  const textOf = (shapes: Shape[]) => shapes.find((s) => s.type === "text")!;

  it("center text 는 whiteSpace nowrap 을 쓰지 않음 (nowrap 시 center 무력화 → 왼쪽 치우침)", () => {
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: 220 },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const t = textOf(shapes) as { whiteSpace?: string };
    expect(t.whiteSpace).not.toBe("nowrap");
  });

  it("text x + maxWidth 가 컨테이너 폭 중앙 대칭 (paddingLeft cellSize / maxWidth width-cellSize*2 → 중심 width/2)", () => {
    const cw = 220;
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const t = textOf(shapes) as {
      x?: number;
      maxWidth?: number;
      align?: string;
    };
    // cellSize = 30. x(=paddingLeft) = 30, maxWidth = 220 - 60 = 160.
    //   center 정렬 시 텍스트 중심 = x + maxWidth/2 = 30 + 80 = 110 = cw/2 (정중앙).
    expect(t.align).toBe("center");
    expect(t.x).toBe(30);
    expect(t.maxWidth).toBe(cw - 30 * 2);
    expect(t.x! + t.maxWidth! / 2).toBe(cw / 2);
  });

  it("좁은/넓은 폭 모두 text 중심 = width/2 (폭 가변 정합)", () => {
    for (const cw of [160, 300]) {
      const shapes = draw({
        props: { children: "2024년 1월", _containerWidth: cw },
        size: sizeMd,
        visual,
        style: undefined,
      })!;
      const t = textOf(shapes) as { x?: number; maxWidth?: number };
      expect(t.x! + t.maxWidth! / 2).toBe(cw / 2);
    }
  });
});

describe("skiaPrimitive 'inline_icon_text' — element.props.style layout 소비 (Style 패널 동기화)", () => {
  // 사용자 요청(2026-07-02, B2): CheckboxGroup 처럼 Style 패널 Layout(Gap/Padding/Justify) 편집이
  //   Skia CalendarHeader 배치에 반영되어야 한다. CalendarHeader 는 chevron/text/chevron 3-shape 고정
  //   (자식 Element 아님)이라 primitive 가 element.props.style 을 직접 읽어 flex-like 배치를 계산한다.
  //   style-ssot 규칙: gap 은 rowGap/columnGap longhand 우선 → shorthand gap fallback.
  const leftChevron = (shapes: Shape[]) =>
    shapes.find(
      (s) =>
        s.type === "icon_font" &&
        (s as { iconName?: string }).iconName === "chevron-left",
    )! as { x?: number };
  const rightChevron = (shapes: Shape[]) =>
    shapes.find(
      (s) =>
        s.type === "icon_font" &&
        (s as { iconName?: string }).iconName === "chevron-right",
    )! as { x?: number };
  const textShape = (shapes: Shape[]) =>
    shapes.find((s) => s.type === "text")! as {
      x?: number;
      maxWidth?: number;
    };

  it("style 미지정 시 기존 좌표 유지 (회귀 방지 — space-between 기본)", () => {
    const cw = 220;
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    // cellSize = 30. 기존: 좌 15, 우 cw-15=205, text 중심 cw/2.
    expect(leftChevron(shapes).x).toBe(15);
    expect(rightChevron(shapes).x).toBe(cw - 15);
    const t = textShape(shapes);
    expect(t.x! + t.maxWidth! / 2).toBe(cw / 2);
  });

  it("style.paddingLeft/paddingRight 반영 — 좌 chevron 이 paddingLeft 만큼 안쪽으로", () => {
    const cw = 220;
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: { paddingLeft: "10px", paddingRight: "10px" },
    })!;
    // paddingX 10 → 좌 chevron x = paddingLeft(10) + cellSize/2(15) = 25. 우 = cw - 10 - 15 = 195.
    expect(leftChevron(shapes).x).toBe(10 + 15);
    expect(rightChevron(shapes).x).toBe(cw - 10 - 15);
  });

  it("style.gap 반영 — chevron↔text 여백이 text maxWidth 를 좁힘 (gap 큰 값 → text 슬롯 축소)", () => {
    const cw = 220;
    const noGap = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: undefined,
    })!;
    const bigGap = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: { gap: "20px" },
    })!;
    // gap 이 커지면 text 슬롯(maxWidth)이 좁아진다. 중심은 여전히 cw/2 대칭.
    expect(textShape(bigGap).maxWidth!).toBeLessThan(
      textShape(noGap).maxWidth!,
    );
    expect(textShape(bigGap).x! + textShape(bigGap).maxWidth! / 2).toBe(cw / 2);
  });

  it("style.rowGap/columnGap longhand 우선 (style-ssot: shorthand gap fallback)", () => {
    const cw = 220;
    const longhand = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: { columnGap: "20px" },
    })!;
    const shorthand = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: { gap: "20px" },
    })!;
    // longhand columnGap 과 shorthand gap 동일 값이면 결과 동일 (longhand 우선 소비 확인).
    expect(textShape(longhand).maxWidth).toBe(textShape(shorthand).maxWidth);
  });

  it("style.justifyContent='center' — 3요소를 중앙에 모음 (space-between 아님, text 중심은 여전히 cw/2)", () => {
    const cw = 300;
    const shapes = draw({
      props: { children: "2024년 1월", _containerWidth: cw },
      size: sizeMd,
      visual,
      style: { justifyContent: "center" },
    })!;
    // center: 좌 chevron 이 space-between(x=15)보다 안쪽(오른쪽)으로, 우 chevron 이 안쪽(왼쪽)으로.
    //   text 중심은 대칭이라 cw/2 유지.
    expect(leftChevron(shapes).x!).toBeGreaterThan(15);
    expect(rightChevron(shapes).x!).toBeLessThan(cw - 15);
    const t = textShape(shapes);
    expect(t.x! + t.maxWidth! / 2).toBe(cw / 2);
  });
});
