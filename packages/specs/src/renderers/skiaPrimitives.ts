/**
 * ADR-142 — `skiaPrimitive` draw module 레지스트리.
 *
 * 비-DOM-trivial primitive(box+text 로 표현 안 되는 도형 — 원/선/아이콘 등)의
 * Skia shape descriptor 생성기. `PrimitiveBinding.skiaPrimitive` 키로 dispatch 된다.
 *
 * **정본 모델 (사용자 정정 2026-05-31)**: 컴포넌트별 시각 차이는 buildCatalogShapes 안의
 * `if (props.isDot) / if (divider) / if (iconName)` **컴포넌트 식별 분기**가 아니라,
 * binding 의 `skiaPrimitive` **데이터**로 표현한다. buildCatalogShapes 는 모든 frame 이
 * 공유하는 보편 box+text 시각(fill/border/radius/padding/text)만 generic 처리한다.
 *
 * - primitive 종류는 유한(원/선/아이콘/arc/track/...) → 키 추가는 컴포넌트 N++ 가 아니다.
 * - 컴포넌트는 이 키 중 하나를 binding 에서 가리킬 뿐, 함수 안에 컴포넌트 식별 분기 없음.
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3 (`skiaPrimitive`)
 */

import {
  CHECKBOX_BOX_BORDER,
  CHECKBOX_CHECKED_COLORS,
} from "../components/Checkbox.spec";
import {
  RADIO_RING_BORDER,
  RADIO_SELECTED_COLORS,
} from "../components/Radio.spec";
import { SWITCH_SELECTED_TRACK_COLORS } from "../components/Switch.spec";
import { parseBorderWidth, parsePxValue } from "../primitives";
import type { Shape, SizeSpec, TokenRef, VariantSpec } from "../types";
import { resolveFillTokens } from "../utils/fillTokens";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";

/**
 * skiaPrimitive draw module 1개의 시그니처 — props/size/variant 에서 Shape[] 생성.
 * **null 반환** = "이 props 에는 내 primitive 가 적용되지 않음" → caller 가 보편 box+text
 * (buildCatalogShapes)로 fallback. 예: `dot` 은 `props.isDot` 일 때만 circle, 아니면 null
 * (text Badge 는 일반 frame box+text). 이는 컴포넌트 식별이 아니라 primitive 자체의 적용
 * 조건이다 — "dot primitive 는 isDot 일 때 그린다"(Badge 라는 컴포넌트를 식별하지 않음).
 */
export type SkiaPrimitiveDrawFn = (ctx: {
  props: Record<string, unknown>;
  size: SizeSpec;
  variant: VariantSpec | undefined;
  style: Record<string, unknown> | undefined;
}) => Shape[] | null;

/**
 * `icon_font` — Lucide 아이콘 단일 glyph. size.iconSize 기준, style.fontSize override.
 * 색은 style.color → variant.text. (Icon primitive)
 */
const iconFont: SkiaPrimitiveDrawFn = ({ props, size, variant, style }) => {
  const iconSize = size.iconSize ?? 24;
  const effectiveSize =
    style?.fontSize != null
      ? resolveSpecFontSize(style.fontSize as string | number, iconSize)
      : iconSize;
  return [
    {
      type: "icon_font",
      iconName: (props.iconName as string) ?? "circle",
      x: effectiveSize / 2,
      y: effectiveSize / 2,
      fontSize: effectiveSize,
      fill: (style?.color as string | undefined) ?? variant?.text,
      strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
    },
  ];
};

/**
 * `dot` — 채워진 원(텍스트 없는 점). size.height 기준 지름. fill 은 variant.fill base.
 * `props.isDot` 일 때만 적용 — 아니면 null(text 는 보편 box+text 로 fallback).
 */
const dot: SkiaPrimitiveDrawFn = ({ props, size, variant, style }) => {
  if (!props.isDot) return null;
  const fill = variant ? resolveFillTokens(variant) : undefined;
  const bgColor =
    (style?.backgroundColor as string | undefined) ?? fill?.default.base;
  const dotSize = size.height === 20 ? 8 : size.height === 24 ? 10 : 12;
  return [
    {
      type: "circle",
      x: dotSize / 2,
      y: dotSize / 2,
      radius: dotSize / 2,
      fill: bgColor,
    },
  ];
};

/**
 * `divider` — 선색으로 채운 얇은 rect(1px 박스의 테두리가 아니라 선 자체). orientation 으로
 * 두께/길이 축 전환. 선색은 style.borderColor → variant.border. (Separator)
 */
const divider: SkiaPrimitiveDrawFn = ({ props, size, variant, style }) => {
  const lineColor =
    (style?.borderColor as string | undefined) ?? variant?.border;
  const isVertical = (props.orientation as string | undefined) === "vertical";
  const thickness = size.height;
  return [
    {
      type: "rect",
      x: 0,
      y: 0,
      width: isVertical ? thickness : ("auto" as unknown as number),
      height: isVertical ? ("auto" as unknown as number) : thickness,
      fill: lineColor,
    },
  ];
};

/**
 * `checkbox` — 체크박스 indicator: box(roundRect, size.indicator.boxSize) + border +
 * checkmark(2 line)/indeterminate(1 line, isChecked·isSelected 시). label 은 자식 Label
 * Element 가 담당하므로 여기서 안 그린다(정본 — indicator 만). isChecked 시 bg/border
 * variant별 CHECKBOX_CHECKED_COLORS 로 전환. (Checkbox primitive)
 */
const checkbox: SkiaPrimitiveDrawFn = ({ props, size, variant, style }) => {
  const variantName = (props.variant as string | undefined) ?? "default";
  const boxSize = size.indicator?.boxSize ?? 20;
  const isChecked = props.isSelected === true;
  const checkedColors =
    CHECKBOX_CHECKED_COLORS[variantName] ?? CHECKBOX_CHECKED_COLORS.default;

  const borderRadius = parsePxValue(
    style?.borderRadius,
    size.indicator?.boxRadius ?? 4,
  );
  const borderWidth = parseBorderWidth(style?.borderWidth, 2);

  const fill = variant ? resolveFillTokens(variant) : undefined;
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    (isChecked ? checkedColors.bg : fill?.default.base);

  const boxBorder =
    CHECKBOX_BOX_BORDER[variantName] ?? CHECKBOX_BOX_BORDER.default;
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isChecked ? checkedColors.border : boxBorder);

  const shapes: Shape[] = [
    {
      id: "box",
      type: "roundRect",
      x: 0,
      y: 0,
      width: boxSize,
      height: boxSize,
      radius: borderRadius as unknown as number,
      fill: bgColor,
    },
    {
      type: "border",
      target: "box",
      borderWidth,
      color: borderColor,
      radius: borderRadius as unknown as number,
    },
  ];

  if (isChecked && !props.isIndeterminate) {
    const pad = boxSize * 0.2;
    shapes.push(
      {
        type: "line",
        x1: pad,
        y1: boxSize * 0.5,
        x2: boxSize * 0.4,
        y2: boxSize - pad,
        stroke: "{color.white}" as TokenRef,
        strokeWidth: 2.5,
      },
      {
        type: "line",
        x1: boxSize * 0.4,
        y1: boxSize - pad,
        x2: boxSize - pad,
        y2: pad,
        stroke: "{color.white}" as TokenRef,
        strokeWidth: 2.5,
      },
    );
  } else if (props.isIndeterminate) {
    const pad = boxSize * 0.25;
    shapes.push({
      type: "line",
      x1: pad,
      y1: boxSize / 2,
      x2: boxSize - pad,
      y2: boxSize / 2,
      stroke: "{color.white}" as TokenRef,
      strokeWidth: 2.5,
    });
  }

  return shapes;
};

/**
 * `radio` — 라디오 indicator: outer ring(circle, fillAlpha 0) + border + inner dot(circle,
 * isSelected 시). label 은 자식 Label Element 담당. isSelected 시 ring/dot 색은 variant별
 * RADIO_SELECTED_COLORS. (Radio primitive)
 */
const radio: SkiaPrimitiveDrawFn = ({ props, size, variant, style }) => {
  const variantName = (props.variant as string | undefined) ?? "default";
  const outer = size.indicator?.boxSize ?? 20;
  const inner = size.indicator?.dotSize ?? 8;
  const selectedColors =
    RADIO_SELECTED_COLORS[variantName] ?? RADIO_SELECTED_COLORS.default;
  const outerRadius = outer / 2;
  const isSelected = props.isSelected === true;

  const borderWidth = parseBorderWidth(style?.borderWidth, 2);
  const ringBorder =
    RADIO_RING_BORDER[variantName] ?? RADIO_RING_BORDER.default;
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isSelected ? selectedColors.ring : ringBorder);

  // ring 배경은 투명(fillAlpha 0) — 색은 시각상 무의미하나 legacy parity 위해
  // variant default fill base 사용(legacy resolveStateColors(variant,"default").background).
  const ringFill = variant
    ? resolveFillTokens(variant).default.base
    : undefined;

  const shapes: Shape[] = [
    {
      id: "ring",
      type: "circle",
      x: outerRadius,
      y: outerRadius,
      radius: outerRadius,
      fill: ringFill,
      fillAlpha: 0,
    },
    {
      type: "border",
      target: "ring",
      borderWidth,
      color: borderColor,
      radius: outerRadius,
    },
  ];

  if (isSelected) {
    shapes.push({
      type: "circle",
      x: outerRadius,
      y: outerRadius,
      radius: inner / 2,
      fill: selectedColors.dot,
    });
  }

  return shapes;
};

/**
 * `switch_toggle` — 스위치 indicator: track(roundRect) + border(비선택) + thumb(circle,
 * thumbX=isChecked? 우:좌). label 은 자식 Label Element 담당. track 색은 isChecked 시
 * variant별 SWITCH_SELECTED_TRACK_COLORS, 비선택 시 accent-subtle. (Switch primitive)
 */
const switchToggle: SkiaPrimitiveDrawFn = ({ props, size }) => {
  const variantName = (props.variant as string | undefined) ?? "default";
  const trackWidth = size.indicator?.trackWidth ?? 36;
  const trackHeight = size.indicator?.trackHeight ?? 20;
  const thumbSize = size.indicator?.thumbSize ?? 16;
  const thumbOffset = size.indicator?.thumbOffset ?? 2;

  const isChecked = props.isSelected === true;
  const trackColor = isChecked
    ? (SWITCH_SELECTED_TRACK_COLORS[variantName] ??
      SWITCH_SELECTED_TRACK_COLORS.default)
    : ("{color.accent-subtle}" as TokenRef);

  const thumbX = isChecked ? trackWidth - thumbSize - thumbOffset : thumbOffset;
  const trackRadius = trackHeight / 2;

  const shapes: Shape[] = [
    {
      id: "track",
      type: "roundRect",
      x: 0,
      y: 0,
      width: trackWidth,
      height: trackHeight,
      radius: trackRadius,
      fill: trackColor,
    },
  ];

  if (!isChecked) {
    shapes.push({
      type: "border",
      target: "track",
      borderWidth: 2,
      color: "{color.border-hover}" as TokenRef,
      radius: trackRadius,
    });
  }

  shapes.push({
    id: "thumb",
    type: "circle",
    x: thumbX + thumbSize / 2,
    y: trackHeight / 2,
    radius: thumbSize / 2,
    fill: isChecked
      ? ("{color.white}" as TokenRef)
      : ("{color.neutral-subtle}" as TokenRef),
  });

  return shapes;
};

/** skiaPrimitive 키 → draw module. binding.skiaPrimitive 가 이 키를 가리킨다. */
export const SKIA_PRIMITIVES: Readonly<Record<string, SkiaPrimitiveDrawFn>> = {
  icon_font: iconFont,
  dot,
  divider,
  checkbox,
  radio,
  switch_toggle: switchToggle,
};

export function getSkiaPrimitive(
  key: string | undefined,
): SkiaPrimitiveDrawFn | undefined {
  return key ? SKIA_PRIMITIVES[key] : undefined;
}
