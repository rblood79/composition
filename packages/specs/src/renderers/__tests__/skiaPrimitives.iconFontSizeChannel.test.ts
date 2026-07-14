import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { IconFontShape, SizeSpec } from "../../types";

/**
 * `icon_font` glyph 크기 채널 계약 — **iconSize 가 크기 축, fontSize 는 사용자 override 만** (2026-07-14).
 *
 * **회귀 (사용자 보고: "skia 에서 size 별 icon size 대로 렌더링되지않고 더 작게 렌더링된다")**:
 *   `iconFont` 는 `style?.fontSize != null` 이면 fontSize 를 크기로 썼다. 이 판정은 `style` 이
 *   **override 전용**이던 시절엔 맞았지만, ADR-912 `toSkiaStyle` 이후 `style` 은 **rule base ⊕
 *   override 병합 map** 이다 — base 에 rule 의 `fontSize`(typography)가 **항상** 들어오므로 판정이
 *   상시 참이 되어 `iconSize` 가 죽었다.
 *
 *   SelectIcon 은 두 축의 값이 달라(lg: iconSize 22 vs text-lg 18 / xl: 28 vs 20) 박스는 iconSize 로
 *   커지는데 glyph 만 typography 를 따라가 **박스보다 작게** 그려졌다. 일반 `Icon` 이 멀쩡해 보인 건
 *   **우연** — catalog Icon 은 fontSize 와 iconSize 를 같은 값(16/16·24/24·48/48)으로 써서 어느 쪽이
 *   이기든 결과가 같았다. 즉 "Icon 은 정상" 이 이 결함을 가려줬다.
 */

const visual: ComponentVisualRule = {
  text: "{color.neutral}",
} as ComponentVisualRule;

function sizeSpec(iconSize: number): SizeSpec {
  return {
    fontSize: "{typography.text-base}" as never,
    borderRadius: "{radius.none}" as never,
    height: iconSize,
    iconSize,
  } as SizeSpec;
}

function drawIcon(ctx: {
  props: Record<string, unknown>;
  size: SizeSpec;
  style: Record<string, unknown> | undefined;
}): IconFontShape {
  const shapes = getSkiaPrimitive("icon_font")?.({ ...ctx, visual });
  const glyph = shapes?.[0] as IconFontShape | undefined;
  if (!glyph) throw new Error("icon_font primitive produced no shape");
  return glyph;
}

/** catalog SelectIcon — iconSize(아이콘 스케일) 와 fontSize(typography) 가 **다른** 값. */
const SELECT_ICON_SIZES = [
  { size: "xs", iconSize: 14, ruleFontSize: 10 },
  { size: "sm", iconSize: 16, ruleFontSize: 12 },
  { size: "md", iconSize: 18, ruleFontSize: 16 },
  { size: "lg", iconSize: 22, ruleFontSize: 18 },
  { size: "xl", iconSize: 28, ruleFontSize: 20 },
] as const;

describe("icon_font — 크기 채널은 iconSize (merged base fontSize 아님)", () => {
  it.each(SELECT_ICON_SIZES)(
    "size=$size — merged style 에 rule fontSize($ruleFontSize) 가 있어도 glyph 는 iconSize($iconSize)",
    ({ iconSize, ruleFontSize }) => {
      const glyph = drawIcon({
        props: { iconName: "calendar" },
        size: sizeSpec(iconSize),
        // toSkiaStyle 이 넘기는 merged map: base(rule fontSize + iconSize) ⊕ override(없음).
        style: { fontSize: ruleFontSize, iconSize },
      });

      expect(glyph.fontSize).toBe(iconSize);
      // 회귀 시엔 rule fontSize 가 이겨 glyph 가 박스보다 작아진다.
      expect(glyph.fontSize).not.toBe(ruleFontSize);
    },
  );

  it("size 를 바꾸면 glyph 크기가 실제로 따라간다 (한 값에 고정 회귀 차단)", () => {
    const drawn = SELECT_ICON_SIZES.map(
      ({ iconSize, ruleFontSize }) =>
        drawIcon({
          props: { iconName: "calendar" },
          size: sizeSpec(iconSize),
          style: { fontSize: ruleFontSize, iconSize },
        }).fontSize,
    );

    expect(drawn).toEqual(SELECT_ICON_SIZES.map((s) => s.iconSize));
  });

  it("사용자가 props.style.fontSize 를 직접 넣으면 override 로 이긴다", () => {
    const glyph = drawIcon({
      props: { iconName: "calendar", style: { fontSize: 40 } },
      size: sizeSpec(22),
      style: { fontSize: 40, iconSize: 22 },
    });

    expect(glyph.fontSize).toBe(40);
  });

  it("Icon(일반)처럼 두 축 값이 같으면 결과 동일 — 기존 동작 보존", () => {
    // catalog Icon md: fontSize {typography.text-2xl}=24, iconSize 24 (우연히 일치).
    const glyph = drawIcon({
      props: { iconName: "check" },
      size: sizeSpec(24),
      style: { fontSize: 24, iconSize: 24 },
    });

    expect(glyph.fontSize).toBe(24);
  });
});

/**
 * Calendar nav chevron — DOM `<ChevronLeft size={16}>` (Calendar.tsx:122-126) **size 무관 고정**.
 *
 * 같은 chevron 을 그리는 경로가 **둘** 이다:
 *   - `inline_icon_text` — CalendarHeader 자식이 있을 때 (이미 16 고정 처리됨)
 *   - `calendar_grid` — 자식 없는 standalone Calendar 가 직접 그리는 nav row
 *
 * `calendar_grid` 만 `fontSize + 2` 로 남아 sm 14 / md 16 / lg 18 로 가변했다 — **md 만 우연히
 * DOM 16 과 일치**하고 sm/lg 는 어긋남. 두 경로 모두 16 고정으로 못 박는다.
 */
const CALENDAR_DOM_CHEVRON_PX = 16;

/** catalog Calendar sizes — fontSize(typography) 와 iconSize 가 **다른** 값. */
const CALENDAR_SIZES = [
  { size: "sm", fontSize: 12, iconSize: 20 },
  { size: "md", fontSize: 14, iconSize: 26 },
  { size: "lg", fontSize: 16, iconSize: 32 },
] as const;

describe("calendar_grid nav chevron — DOM 고정 16 (fontSize 파생 금지)", () => {
  it.each(CALENDAR_SIZES)(
    "size=$size — fontSize($fontSize) 파생이 아니라 DOM 고정 16",
    ({ fontSize, iconSize }) => {
      const shapes = getSkiaPrimitive("calendar_grid")?.({
        props: { locale: "ko-KR" },
        size: {
          height: 0,
          iconSize,
          gap: 6,
          paddingX: 8,
          paddingY: 8,
          fontSize: fontSize as never,
          borderRadius: "{radius.none}" as never,
        } as SizeSpec,
        visual,
        style: { fontSize, iconSize },
      });

      const chevrons = (shapes ?? []).filter(
        (s): s is IconFontShape =>
          s.type === "icon_font" &&
          typeof (s as IconFontShape).iconName === "string" &&
          (s as IconFontShape).iconName.startsWith("chevron-"),
      );

      expect(chevrons).toHaveLength(2); // prev + next
      for (const c of chevrons) {
        expect(c.fontSize).toBe(CALENDAR_DOM_CHEVRON_PX);
      }
    },
  );

  it("size 를 바꿔도 chevron 은 안 변한다 (fontSize+2 가변 회귀 차단)", () => {
    // md 는 fontSize+2 = 16 이라 우연히 정답과 같다 → **md 단독 검증은 회귀를 못 잡는다**.
    // sm(14) / lg(18) 이 16 에서 벗어나는지가 진짜 판별점.
    const drawn = CALENDAR_SIZES.map(({ fontSize, iconSize }) => {
      const shapes = getSkiaPrimitive("calendar_grid")?.({
        props: { locale: "ko-KR" },
        size: {
          height: 0,
          iconSize,
          gap: 6,
          paddingX: 8,
          paddingY: 8,
          fontSize: fontSize as never,
          borderRadius: "{radius.none}" as never,
        } as SizeSpec,
        visual,
        style: { fontSize, iconSize },
      });
      const chevron = (shapes ?? []).find(
        (s): s is IconFontShape =>
          s.type === "icon_font" &&
          String((s as IconFontShape).iconName).startsWith("chevron-"),
      );
      return chevron?.fontSize;
    });

    expect(drawn).toEqual([16, 16, 16]); // 회귀 시 [14, 16, 18]
  });
});
