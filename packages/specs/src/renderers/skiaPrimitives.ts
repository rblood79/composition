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

import { parseBorderWidth, parsePxValue } from "../primitives";
import { fontFamily } from "../primitives/typography";
import { TOOLTIP_MAX_WIDTH } from "../components/Tooltip.spec";
import {
  buildDatePickerShapes,
  buildDatePlaceholder,
  DATE_PICKER_SIZES,
} from "../components/DatePicker.spec";
import type { Shape, SizeSpec, TokenRef } from "../types";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";
import type { ComponentVisualRule } from "./utils/resolveComponentVisual";

/**
 * skiaPrimitive draw module 1개의 시그니처 — props/size/visual 에서 Shape[] 생성.
 * **null 반환** = "이 props 에는 내 primitive 가 적용되지 않음" → caller 가 보편 box+text
 * (buildCatalogShapes)로 fallback. 예: `dot` 은 `props.isDot` 일 때만 circle, 아니면 null
 * (text Badge 는 일반 frame box+text). 이는 컴포넌트 식별이 아니라 primitive 자체의 적용
 * 조건이다 — "dot primitive 는 isDot 일 때 그린다"(Badge 라는 컴포넌트를 식별하지 않음).
 *
 * **ADR-142 B2 (spec-free)**: 더 이상 spec VariantSpec / selected 상수(CHECKBOX_CHECKED_COLORS
 * 등)를 읽지 않는다. caller(builder)가 rule 테이블에서 해소한 `ComponentVisualRule` 을 주입한다.
 * selected/checked 시각은 보편 상태축 `visual.fill.default.selected` / `visual.selectedBorder` /
 * `visual.border` 에서 읽는다(컴포넌트-특화 상수 맵 제거 — N++ 복제 방지).
 */
export type SkiaPrimitiveDrawFn = (ctx: {
  props: Record<string, unknown>;
  size: SizeSpec;
  visual: ComponentVisualRule | undefined;
  style: Record<string, unknown> | undefined;
}) => Shape[] | null;

/**
 * `icon_font` — Lucide 아이콘 단일 glyph. size.iconSize 기준, style.fontSize override.
 * 색은 style.color → variant.text. (Icon primitive)
 */
const iconFont: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
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
      fill: (style?.color as string | undefined) ?? visual?.text,
      strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
    },
  ];
};

/**
 * `dot` — 채워진 원(텍스트 없는 점). size.height 기준 지름. fill 은 variant.fill base.
 * `props.isDot` 일 때만 적용 — 아니면 null(text 는 보편 box+text 로 fallback).
 */
const dot: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  if (!props.isDot) return null;
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base;
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
const divider: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const lineColor =
    (style?.borderColor as string | undefined) ?? visual?.border;
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
const checkbox: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const boxSize = size.indicator?.boxSize ?? 20;
  const isChecked = props.isSelected === true;

  const borderRadius = parsePxValue(
    style?.borderRadius,
    size.indicator?.boxRadius ?? 4,
  );
  const borderWidth = parseBorderWidth(style?.borderWidth, 2);

  // checked 시각 = 보편 상태축: bg=fill.default.selected, border=selectedBorder.
  // 미선택: bg=fill.default.base, border=visual.border (이전 CHECKBOX_*_COLORS 상수 흡수).
  // fallback("{color.border}")은 variant 누락 방어 — 정상 spec 에선 도달 안 함(타입 만족).
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    (isChecked ? visual?.fill?.default.selected : visual?.fill?.default.base) ??
    ("{color.base}" as TokenRef);

  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isChecked ? visual?.selectedBorder : visual?.border) ??
    ("{color.border}" as TokenRef);

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
 * isSelected 시). label 은 자식 Label Element 담당. isSelected 시 ring/dot 색은 보편 상태축
 * (visual.selectedBorder = ring, visual.fill.default.selected = dot). (Radio primitive)
 */
const radio: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const outer = size.indicator?.boxSize ?? 20;
  const inner = size.indicator?.dotSize ?? 8;
  const outerRadius = outer / 2;
  const isSelected = props.isSelected === true;

  const borderWidth = parseBorderWidth(style?.borderWidth, 2);
  // ring border: selected=selectedBorder, 미선택=visual.border (이전 RADIO_*_COLORS 흡수).
  // fallback 은 variant 누락 방어 — 정상 spec 에선 도달 안 함(타입 만족).
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isSelected ? visual?.selectedBorder : visual?.border) ??
    ("{color.border-hover}" as TokenRef);

  // ring 배경은 투명(fillAlpha 0) — 색은 시각상 무의미하나 legacy parity 위해 fill base 사용.
  const ringFill = visual?.fill?.default.base ?? ("{color.base}" as TokenRef);

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
      fill: visual?.fill?.default.selected ?? ("{color.accent}" as TokenRef),
    });
  }

  return shapes;
};

/**
 * `switch_toggle` — 스위치 indicator: track(roundRect) + border(비선택) + thumb(circle,
 * thumbX=isChecked? 우:좌). label 은 자식 Label Element 담당. track 색은 isChecked 시
 * 보편 상태축(visual.fill.default.selected), 비선택 시 accent-subtle(전 variant 공통). (Switch primitive)
 */
const switchToggle: SkiaPrimitiveDrawFn = ({ props, size, visual }) => {
  const trackWidth = size.indicator?.trackWidth ?? 36;
  const trackHeight = size.indicator?.trackHeight ?? 20;
  const thumbSize = size.indicator?.thumbSize ?? 16;
  const thumbOffset = size.indicator?.thumbOffset ?? 2;

  const isChecked = props.isSelected === true;
  // selected track = visual.fill.default.selected (이전 SWITCH_SELECTED_TRACK_COLORS 흡수).
  // 미선택 track 색(accent-subtle)은 모든 variant 공통이라 잔존(variant 차이 없음).
  const trackColor =
    isChecked && visual?.fill?.default.selected
      ? visual.fill.default.selected
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

// ===========================================================================
// ADR-142 Inc3 family ⑥(overlays) — overlay 시각 패턴 draw module (append 모드).
//
// portal/overlay 의 비-box+text 시각(shadow / V-arrow / backdrop)을 그린다. 값은 module 내부
// 상수(현 render.shapes 하드코딩 1:1 이식) — spec runtime 참조 0(#8), ComponentRule 스키마
// 확장 불필요(ADR-142 R4/HC#11 정본: 비-DOM-trivial = skiaPrimitive). dashed border 는 보편
// box 속성이라 buildCatalogShapes 가 직접 emit(별도 module 아님).
//
// **append 모드**: 이 draw fn 의 출력은 buildCatalogShapes(box+text) 출력에 **합성**된다
// (dispatch 가 SKIA_PRIMITIVE_MODES 로 판정). 기존 6 primitive 는 replace(box+text 대체).
// ===========================================================================

/**
 * `tooltip_arrow` — Tooltip V-arrow(placement 기반 2-line). showArrow===true 일 때만 적용.
 * 좌표식은 TooltipSpec.render.shapes(L300-398) 1:1 이식(회귀 0). 색 = bg fill(style/visual).
 */
const tooltipArrow: SkiaPrimitiveDrawFn = ({ props, visual, style }) => {
  if (props.showArrow !== true) return null;
  const arrowSize = 6;
  const placement = (props.placement as string | undefined) ?? "top";
  const sizeName = (props.size as string | undefined) ?? "md";
  const maxWidth = TOOLTIP_MAX_WIDTH[sizeName] ?? 150;
  const approxHeight = 24;
  const centerX = maxWidth / 2;
  // bg 색: style.backgroundColor → variant fill base (= legacy bgColor). dispatch 에서 visual
  // 항상 주입되므로 transparent fallback 은 타입 만족용(도달 안 함).
  const stroke: TokenRef = ((style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    "{color.transparent}") as TokenRef;

  if (placement === "top") {
    return [
      {
        type: "line",
        x1: centerX - arrowSize,
        y1: approxHeight,
        x2: centerX,
        y2: approxHeight + arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: centerX + arrowSize,
        y1: approxHeight,
        x2: centerX,
        y2: approxHeight + arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "bottom") {
    return [
      {
        type: "line",
        x1: centerX - arrowSize,
        y1: 0,
        x2: centerX,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: centerX + arrowSize,
        y1: 0,
        x2: centerX,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "right") {
    const midY = approxHeight / 2;
    return [
      {
        type: "line",
        x1: 0,
        y1: midY - arrowSize,
        x2: -arrowSize,
        y2: midY,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: 0,
        y1: midY + arrowSize,
        x2: -arrowSize,
        y2: midY,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  // left
  const midY = approxHeight / 2;
  return [
    {
      type: "line",
      x1: maxWidth,
      y1: midY - arrowSize,
      x2: maxWidth + arrowSize,
      y2: midY,
      stroke,
      strokeWidth: 2,
    },
    {
      type: "line",
      x1: maxWidth,
      y1: midY + arrowSize,
      x2: maxWidth + arrowSize,
      y2: midY,
      stroke,
      strokeWidth: 2,
    },
  ];
};

/**
 * `popover_arrow` — Popover V-arrow(placement 기반 2-line). !showArrow 일 때(기본 표시).
 * 좌표식은 PopoverSpec.render.shapes(L267-365) 1:1 이식(cx=cy=80 고정, arrowSize=8). 색 = bg fill.
 */
const popoverArrow: SkiaPrimitiveDrawFn = ({ props, visual, style }) => {
  if (props.showArrow) return null;
  const arrowSize = 8;
  const placement = (props.placement as string | undefined) ?? "bottom";
  const cx = 80;
  const cy = 80;
  const stroke: TokenRef = ((style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    "{color.transparent}") as TokenRef;

  if (placement === "bottom") {
    return [
      {
        type: "line",
        x1: cx - arrowSize,
        y1: 0,
        x2: cx,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: cx + arrowSize,
        y1: 0,
        x2: cx,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "top") {
    return [
      {
        type: "line",
        x1: cx - arrowSize,
        y1: cy,
        x2: cx,
        y2: cy + arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: cx + arrowSize,
        y1: cy,
        x2: cx,
        y2: cy + arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "right") {
    return [
      {
        type: "line",
        x1: 0,
        y1: cy - arrowSize,
        x2: -arrowSize,
        y2: cy,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: 0,
        y1: cy + arrowSize,
        x2: -arrowSize,
        y2: cy,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  // left
  return [
    {
      type: "line",
      x1: cx,
      y1: cy - arrowSize,
      x2: cx + arrowSize,
      y2: cy,
      stroke,
      strokeWidth: 2,
    },
    {
      type: "line",
      x1: cx,
      y1: cy + arrowSize,
      x2: cx + arrowSize,
      y2: cy,
      stroke,
      strokeWidth: 2,
    },
  ];
};

/**
 * `dialog_shadow` — Dialog drop shadow(offsetY:8 blur:24 alpha:0.2). target=bg.
 * 값은 DialogSpec.render.shapes 하드코딩 1:1 이식. 보편 box-shadow 의 elevation 종류.
 */
const dialogShadow: SkiaPrimitiveDrawFn = () => [
  {
    type: "shadow",
    target: "bg",
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    spread: 0,
    color: "rgba(0, 0, 0, 0.2)",
    alpha: 0.2,
  },
];

/**
 * `popover_shadow` — Popover drop shadow(offsetY:4 blur:12 alpha:0.15). target=bg.
 * 값은 PopoverSpec.render.shapes 하드코딩 1:1 이식. dialog 보다 약한 elevation.
 */
const popoverShadow: SkiaPrimitiveDrawFn = () => [
  {
    type: "shadow",
    target: "bg",
    offsetX: 0,
    offsetY: 4,
    blur: 12,
    spread: 0,
    color: "rgba(0, 0, 0, 0.15)",
    alpha: 0.15,
  },
];

/**
 * `overlay_backdrop` — Dialog 반투명 backdrop(전체 화면 rect, rgba(0,0,0,0.5)).
 * 값은 DialogSpec.render.shapes 하드코딩 1:1 이식. modal overlay 패턴.
 */
const overlayBackdrop: SkiaPrimitiveDrawFn = () => [
  {
    type: "rect",
    x: -9999,
    y: -9999,
    width: 99999,
    height: 99999,
    fill: "rgba(0, 0, 0, 0.5)" as unknown as TokenRef,
    fillAlpha: 0.5,
  },
];

/**
 * `calendar_grid` — 월 단위 날짜 grid(nav + month/year text + 7 weekday + 최대 31 date cell +
 * today dot). box+text 로 표현 불가한 복합 primitive → `"replace"` 모드(box+text 대체).
 *
 * 값/좌표식은 `CalendarSpec.render.shapes`(Calendar.spec.ts) 1:1 이식 — 단, spec VariantSpec
 * (`variant.text`/`variant.border`/`resolveStateColors`) 대신 보편 rule 테이블에서 해소된
 * `ctx.visual`(text/border/fill.default[state]) + `ctx.size`(fontSize/borderRadius/iconSize)를
 * 읽는다(ADR-912 ②-6-A theme rule base SSOT 정합 — spec-free). RangeCalendar 도 동일 primitive
 * 사용(RangeCalendar.spec = `...CalendarSpec`, 시각 동형). 자식이 있으면(`_hasChildren`)
 * shell(bg+border)만, standalone 이면 full grid.
 */
const calendarGrid: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const borderRadius = parsePxValue(
    style?.borderRadius,
    size.borderRadius as unknown as number,
  );
  const cellSize = (size.iconSize ?? 28) + 4;
  const gap = (size.gap as unknown as number) || 6;
  const paddingX = (size.paddingX as unknown as number) || 8;
  const paddingY = (size.paddingY as unknown as number) || 8;
  const fontSize = resolveSpecFontSize(size.fontSize as string | number, 14);
  const calendarWidth = cellSize * 7 + gap * 6 + paddingX * 2;
  const ff = (style?.fontFamily as string) || fontFamily.sans;

  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);
  const borderColor = visual?.border ?? ("{color.border}" as TokenRef);
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.base}" as TokenRef);

  const headerHeight = cellSize;
  const navRowY = paddingY;
  const weekdayY = navRowY + headerHeight + gap;
  const gridStartY = weekdayY + cellSize;

  // January 2024: starts on Monday(dayOffset=1), 31 days. today=15(선택/today 표시 예시).
  const dayOffset = 1;
  const totalDays = 31;
  const today = 15;
  const totalRows = Math.ceil((totalDays + dayOffset) / 7);
  const totalHeight =
    gridStartY + totalRows * (cellSize + gap) - gap + paddingY;

  const hasChildren = !!(props as Record<string, unknown>)._hasChildren;

  const shapes: Shape[] = [
    {
      id: "bg",
      type: "roundRect" as const,
      x: 0,
      y: 0,
      width: hasChildren ? ("auto" as unknown as number) : calendarWidth,
      height: hasChildren ? ("auto" as unknown as number) : totalHeight,
      radius: borderRadius,
      fill: bgColor,
    },
    {
      type: "border" as const,
      target: "bg",
      borderWidth: 1,
      color: borderColor,
      radius: borderRadius,
    },
  ];

  if (hasChildren) return shapes;

  shapes.push(
    {
      type: "icon_font" as const,
      iconName: "chevron-left",
      x: paddingX + cellSize / 2,
      y: navRowY + headerHeight / 2,
      fontSize: fontSize + 2,
      fill: textColor,
      strokeWidth: 2,
    },
    {
      type: "text" as const,
      x: paddingX + cellSize,
      y: navRowY + headerHeight / 2,
      text: (() => {
        const loc = props.calendarSystem
          ? `${props.locale || "en-US"}-u-ca-${props.calendarSystem}`
          : (props.locale as string) || "ko-KR";
        try {
          return new Intl.DateTimeFormat(loc, {
            year: "numeric",
            month: "long",
          }).format(new Date());
        } catch {
          return "2024년 1월";
        }
      })(),
      fontSize,
      fontFamily: ff,
      fontWeight: 700,
      fill: textColor,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: calendarWidth - (paddingX + cellSize) * 2,
    },
    {
      type: "icon_font" as const,
      iconName: "chevron-right",
      x: calendarWidth - paddingX - cellSize / 2,
      y: navRowY + headerHeight / 2,
      fontSize: fontSize + 2,
      fill: textColor,
      strokeWidth: 2,
    },
  );

  const effectiveLocale = props.calendarSystem
    ? `${props.locale || "en-US"}-u-ca-${props.calendarSystem}`
    : (props.locale as string) || "en-US";
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i); // 2024-01-07 = Sunday
    try {
      return new Intl.DateTimeFormat(effectiveLocale, {
        weekday: "short",
      }).format(d);
    } catch {
      return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][i];
    }
  });
  for (let col = 0; col < 7; col++) {
    const cellLeft = paddingX + col * (cellSize + gap);
    shapes.push({
      type: "text" as const,
      x: cellLeft,
      y: weekdayY + cellSize / 2,
      text: weekdays[col],
      fontSize: fontSize - 2,
      fontFamily: ff,
      fontWeight: 700,
      fill: "{color.neutral-subdued}" as TokenRef,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: cellSize,
      whiteSpace: "nowrap" as const,
    });
  }

  for (let day = 1; day <= totalDays; day++) {
    const idx = day - 1 + dayOffset;
    const row = Math.floor(idx / 7);
    const col = idx % 7;
    const cellLeft = paddingX + col * (cellSize + gap);
    const cx = cellLeft + cellSize / 2;
    const cy = gridStartY + row * (cellSize + gap) + cellSize / 2;

    shapes.push({
      type: "text" as const,
      x: cellLeft,
      y: cy,
      text: String(day),
      fontSize,
      fontFamily: ff,
      fontWeight: day === today ? 700 : 400,
      fill: textColor,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: cellSize,
      whiteSpace: "nowrap" as const,
    });

    if (day === today) {
      shapes.push({
        type: "circle" as const,
        x: cx,
        y: cy + cellSize / 2 - 4,
        radius: 3,
        fill: "{color.accent}" as TokenRef,
      });
    }
  }

  return shapes;
};

/**
 * `datefield_trigger` — DatePicker/DateRangePicker 의 입력 trigger field(input box + display
 * text + 후행 calendar icon). box+text+icon 복합 → `"replace"` 모드(box+text 대체).
 *
 * 값/좌표식은 `buildDatePickerShapes`(DatePicker.spec.ts) 재사용 — display text 는 props 의
 * value/startDate·endDate/placeholder 에서 조립(DatePicker = value, DateRangePicker = range).
 * 자식이 있으면(`_hasChildren`) 투명 컨테이너(빈 배열). DateRangePicker 는 기본 폭 320.
 * spec-free: buildDatePickerShapes 는 props.style/sizeEntry(size) 만 읽어 spec VariantSpec 미참조.
 */
const datefieldTrigger: SkiaPrimitiveDrawFn = ({ props, size }) => {
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const locale = (props.locale as string) || "en-US";
  const isRange =
    props.startDate !== undefined ||
    props.endDate !== undefined ||
    props._dateRange === true;

  let displayText: string;
  let hasValue: boolean;
  let defaultContainerWidth: number;
  if (isRange) {
    if (props.startDate && props.endDate) {
      displayText = `${props.startDate} – ${props.endDate}`;
      hasValue = true;
    } else {
      // range placeholder = "single – single" (DateRangePicker.spec buildRangePlaceholder 동형,
      // 파일-로컬 helper 재export 대신 공개 buildDatePlaceholder 로 인라인 조립).
      const single = buildDatePlaceholder(locale);
      displayText = (props.placeholder as string) || `${single} – ${single}`;
      hasValue = false;
    }
    defaultContainerWidth = 320;
  } else {
    displayText =
      (props.value as string) ||
      (props.placeholder as string) ||
      buildDatePlaceholder(locale);
    hasValue = !!props.value;
    defaultContainerWidth = 200;
  }

  // sizeEntry 는 DATE_PICKER_SIZES(spec 공유 sizes) 에서 size 이름으로 조회 — ctx.size 의
  // calendar 류 base 가 아니라 date-picker 전용 height/padding/iconSize 가 필요하기 때문.
  const sizeName = (props.size as string) || "md";
  const sizeEntry =
    (DATE_PICKER_SIZES as Record<string, Record<string, unknown>>)[sizeName] ??
    (DATE_PICKER_SIZES as Record<string, Record<string, unknown>>).md ??
    (size as unknown as Record<string, unknown>);

  return buildDatePickerShapes({
    props: props as unknown as Record<string, unknown>,
    sizeEntry,
    displayText,
    hasValue,
    defaultContainerWidth,
  });
};

/**
 * `value_fill_bar` — 진행/미터/슬라이더의 value 비례 수평 채움 막대 (append 모드).
 *
 * track box(buildCatalogShapes 가 그림) **위에** 덧그리는 fill rect. 컴포넌트 식별 없이
 * props 데이터로만 분기(no-classification):
 * - `props.value` 가 배열 → range 채움(`v0%~v1%`), 단일 숫자 → `0~v%` 채움.
 * - `props.minValue`/`maxValue` → 정규화(slider). 없으면 0~100(progress/meter).
 * - `props.isIndeterminate` → 정적 20%~50% 막대(애니메이션은 CSS, Skia 는 정적 표현).
 * - `props._hasChildren` → 부모(ProgressBar/Meter)는 자식 Track 이 fill 담당 → `[]` (위임).
 *   Track 노드는 자식 없음 → 직접 그림. thumb 은 SliderThumb 자식 element 가 담당(여기 미생성).
 *
 * 색: `style.color`(사용자 override) → `visual.fillBar`(variant 별 rule 색) → `{color.accent}`.
 */
const valueFillBar: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  // 부모(ProgressBar/Meter) standalone 이 아니면(자식 Track 보유) fill 은 자식이 담당.
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const width =
    typeof props._containerWidth === "number" &&
    (props._containerWidth as number) > 0
      ? (props._containerWidth as number)
      : (typeof style?.width === "number" ? (style.width as number) : 0) || 240;
  const height = size.height ?? 8;

  const barRadius = parsePxValue(
    style?.borderRadius as string | number | undefined,
    typeof size.borderRadius === "number" ? size.borderRadius : height / 2,
  );

  const barColor =
    (style?.color as string | undefined) ??
    visual?.fillBar ??
    ("{color.accent}" as TokenRef);

  // indeterminate: 정적 20%~50% 위치 막대 (progress 류만 — isIndeterminate 데이터)
  if (props.isIndeterminate) {
    return [
      {
        type: "roundRect",
        x: width * 0.2,
        y: 0,
        width: width * 0.3,
        height,
        radius: barRadius,
        fill: barColor,
      },
    ];
  }

  const min = typeof props.minValue === "number" ? props.minValue : 0;
  const max = typeof props.maxValue === "number" ? props.maxValue : 100;
  const span = max - min || 1;
  const raw = props.value ?? 0;
  const values = Array.isArray(raw) ? (raw as number[]) : [raw as number];
  const percents = values.map((v) =>
    Math.max(0, Math.min(100, ((v - min) / span) * 100)),
  );

  const shapes: Shape[] = [];
  if (percents.length >= 2) {
    // range: value[0]~value[1] 구간 채움
    const x0 = (width * percents[0]) / 100;
    const x1 = (width * percents[1]) / 100;
    const w = x1 - x0;
    if (w > 0) {
      shapes.push({
        type: "roundRect",
        x: x0,
        y: 0,
        width: w,
        height,
        radius: barRadius,
        fill: barColor,
      });
    }
  } else {
    // single: 0~value 채움
    const w = (width * percents[0]) / 100;
    if (w > 0) {
      shapes.push({
        type: "roundRect",
        x: 0,
        y: 0,
        width: w,
        height,
        radius: barRadius,
        fill: barColor,
      });
    }
  }
  return shapes;
};

/**
 * `value_fill_arc` — 원형 진행률의 value 비례 호 (append 모드, ProgressCircle).
 *
 * track arc(buildCatalogShapes box 위 — 단, ProgressCircle 은 box 대신 arc track 을
 * 별도 그려야 함 → 본 primitive 가 track + indicator 둘 다 그린다, replace 가 아니라
 * append 지만 track box 가 무의미하므로 자체 track arc 포함).
 * - `props.value`(0~100) → `sweepAngle = value%×360` indicator arc.
 * - `props.isIndeterminate` → 270° 정적 호.
 * - `props._hasChildren` → 자식이 담당 → `[]`.
 *
 * 색: track = `visual.fill.default.base`(neutral-subtle) / indicator = `style.color` →
 * `visual.fillBar` → `{color.accent}`.
 */
const valueFillArc: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const diameter =
    (typeof size.width === "number" ? size.width : 0) ||
    (typeof size.height === "number" ? size.height : 0) ||
    32;
  const strokeWidth =
    typeof size.strokeWidth === "number" ? size.strokeWidth : 3;
  const outerRadius = diameter / 2;
  const cx = outerRadius;
  const cy = outerRadius;
  const trackRadius = outerRadius - strokeWidth / 2;

  const trackColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.neutral-subtle}" as TokenRef);
  const indicatorColor =
    (style?.color as string | undefined) ??
    visual?.fillBar ??
    ("{color.accent}" as TokenRef);

  const shapes: Shape[] = [
    {
      type: "arc",
      x: cx,
      y: cy,
      radius: trackRadius,
      startAngle: 0,
      sweepAngle: 360,
      strokeWidth,
      stroke: trackColor,
      strokeCap: "butt",
    },
  ];

  if (props.isIndeterminate) {
    shapes.push({
      type: "arc",
      x: cx,
      y: cy,
      radius: trackRadius,
      startAngle: -90,
      sweepAngle: 270,
      strokeWidth,
      stroke: indicatorColor,
      strokeCap: "round",
    });
  } else {
    const value = Math.max(
      0,
      Math.min(100, typeof props.value === "number" ? props.value : 0),
    );
    if (value > 0) {
      shapes.push({
        type: "arc",
        x: cx,
        y: cy,
        radius: trackRadius,
        startAngle: -90,
        sweepAngle: (value / 100) * 360,
        strokeWidth,
        stroke: indicatorColor,
        strokeCap: "round",
      });
    }
  }
  return shapes;
};

/**
 * `illustrated_message` — 빈 상태(empty state) escape. placeholder roundRect + heading text +
 * description text 3 shape 를 자체 생성한다(append 모드 — rule fill transparent base box 위).
 *
 * **ADR-912 진로 1번 IllustratedMessage proof slice (2026-06-06)**: catalog 등록 시 buildCatalogShapes
 *   box+text 는 단일 box + 단일 text 만 가능 → nested placeholder + 2-text 표현 불가. spec.render.shapes
 *   (IllustratedMessage.spec.ts:104-187) 의 시각 로직을 escape 로 이전(spec 의존 0 — seam 제거).
 *   heading/description 은 props(자식 Element 아님, factory children:[]). DOM(IllustratedMessage.tsx)
 *   인라인 style 과 시각 대칭.
 *
 *   size-key 별 dims/headingFontSize/gap 은 자체 인라인 매핑(rule table 미보유 — escape 자기 완결).
 *   fontSize 는 ctx.size.fontSize(rule TokenRef → resolveSpecFontSize), text 색은 visual.text.
 */
const ILLUSTRATION_ESCAPE_DIMS: Readonly<
  Record<string, { box: number; headingFs: number; gap: number }>
> = {
  sm: { box: 80, headingFs: 16, gap: 8 },
  md: { box: 120, headingFs: 18, gap: 12 },
  lg: { box: 160, headingFs: 20, gap: 16 },
};

const illustratedMessage: SkiaPrimitiveDrawFn = ({
  props,
  size,
  visual,
  style,
}) => {
  // 자식 보유 시(미래 확장) escape skip — props 기반 단독 leaf 만 그린다.
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const sizeName = (props.size as string) ?? "md";
  const dims =
    ILLUSTRATION_ESCAPE_DIMS[sizeName] ?? ILLUSTRATION_ESCAPE_DIMS.md;

  const descFs = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    14,
  );
  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);

  const heading = (props.heading as string) ?? "No content";
  const description =
    (props.description as string) ?? "There is nothing to display.";

  const shapes: Shape[] = [];

  // 일러스트 placeholder 영역
  shapes.push({
    id: "illustration",
    type: "roundRect" as const,
    x: 0,
    y: 0,
    width: dims.box,
    height: dims.box,
    radius: 12,
    fill: "{color.neutral-subtle}" as TokenRef,
    fillAlpha: 0.5,
  });

  // Heading 텍스트
  shapes.push({
    id: "heading",
    type: "text" as const,
    x: 0,
    y: dims.box + dims.gap,
    text: heading,
    fontSize: dims.headingFs,
    fontFamily: ff,
    fontWeight: 600,
    fill: textColor,
    align: "center" as const,
  });

  // Description 텍스트
  shapes.push({
    id: "description",
    type: "text" as const,
    x: 0,
    y: dims.box + dims.gap + dims.headingFs + 8,
    text: description,
    fontSize: descFs,
    fontFamily: ff,
    fill: "{color.neutral-subdued}" as TokenRef,
    align: "center" as const,
  });

  return shapes;
};

/**
 * `status_light` — 상태 표시 dot(circle) + 라벨 text. escape(append 모드).
 *
 * **ADR-912 진로 1번 StatusLight proof slice (2026-06-06)**: catalog 등록 시 buildCatalogShapes
 *   box+text 는 circle 미지원 → spec.render.shapes(StatusLight.spec.ts:362-425)의 dot circle +
 *   text 로직을 escape 로 이전(spec 의존 0 — seam 제거). 기존 `dot` primitive(`props.isDot` gate,
 *   Checkbox/Radio 전용 + text 미렌더)와 별개 — 회귀 위험 0.
 *
 *   dot 색 = visual.fill.default.base(variant status 색), text 색 = visual.text. dotSize/gap/height
 *   는 ctx.size(rule sizes). DOM(StatusLight.tsx) 인라인 style 과 시각 대칭.
 */
const statusLight: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const dotSize = typeof size.dotSize === "number" ? size.dotSize : 10;
  const dotRadius = dotSize / 2;
  const gap = typeof size.gap === "number" ? size.gap : 8;
  const h = typeof size.height === "number" ? size.height : 24;
  const centerY = h / 2;

  const dotColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.neutral-subdued}" as TokenRef);
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);

  const shapes: Shape[] = [
    // 상태 표시 dot (수직 중앙 정렬)
    {
      id: "dot",
      type: "circle" as const,
      x: dotRadius,
      y: centerY,
      radius: dotRadius,
      fill: dotColor,
    },
  ];

  // 자식 보유(미래 확장) 시 dot 만 — 라벨은 자식이 담당.
  if ((props as Record<string, unknown>)._hasChildren) return shapes;

  const text = props.children;
  if (text) {
    const fontSize = resolveSpecFontSize(
      (style?.fontSize as string | number | undefined) ?? size.fontSize,
      14,
    );
    const fwRaw = style?.fontWeight;
    const fw =
      fwRaw != null
        ? typeof fwRaw === "number"
          ? fwRaw
          : parseInt(String(fwRaw), 10) || 400
        : 400;
    const ff = (style?.fontFamily as string) || fontFamily.sans;

    shapes.push({
      type: "text" as const,
      x: dotSize + gap,
      y: centerY,
      text: text as string,
      fontSize,
      fontFamily: ff,
      fontWeight: fw,
      fill: textColor,
      align: "left" as const,
      baseline: "middle" as const,
    });
  }

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
  // ADR-142 Inc3 overlays (append 모드 — SKIA_PRIMITIVE_MODES 참조)
  tooltip_arrow: tooltipArrow,
  popover_arrow: popoverArrow,
  dialog_shadow: dialogShadow,
  popover_shadow: popoverShadow,
  overlay_backdrop: overlayBackdrop,
  // ADR-912 단계 5 (1b) date escape (replace 모드 — box+text 대체)
  calendar_grid: calendarGrid,
  datefield_trigger: datefieldTrigger,
  // ADR-912 선행-2 value-fill escape:
  //   value_fill_bar = append (track box 위 value 막대 — Progress/Meter/Slider)
  //   value_fill_arc = replace (자체 track arc + indicator arc — ProgressCircle, box 무의미)
  value_fill_bar: valueFillBar,
  value_fill_arc: valueFillArc,
  // ADR-912 진로 1번 internal leaf escape (append 모드 — placeholder+heading+description)
  illustrated_message: illustratedMessage,
  // ADR-912 진로 1번 internal leaf escape (append 모드 — dot circle + label text)
  status_light: statusLight,
};

/** draw module 합성 모드. dispatch(buildSpecNodeData) + composeCatalogShapes 가 분기에 사용. */
export type SkiaPrimitiveMode = "replace" | "prepend" | "append";

/**
 * draw module 의 합성 모드.
 * - `"replace"`(기본): 출력이 box+text 를 **대체**한다(기존 6 leaf primitive — indicator 만 렌더).
 * - `"prepend"`: 출력이 buildCatalogShapes(box+text) 출력 **앞**(아래 레이어)에 합성된다 —
 *   backdrop(전체화면 rect) / shadow(target=bg). legacy 순서 [backdrop, shadow, bg, ...] 재현.
 * - `"append"`: 출력이 box+text 출력 **뒤**(위 레이어)에 합성된다 — arrow(line).
 *
 * 미등록 키는 `"replace"` 로 간주(기존 호환).
 */
const SKIA_PRIMITIVE_MODES: Readonly<Record<string, SkiaPrimitiveMode>> = {
  overlay_backdrop: "prepend",
  dialog_shadow: "prepend",
  popover_shadow: "prepend",
  tooltip_arrow: "append",
  popover_arrow: "append",
  // ADR-912 선행-2: value_fill_bar 는 track box 위 막대 → append.
  //   value_fill_arc 는 자체 track+indicator arc 라 box+text 대체 → replace(기본, 미등록).
  value_fill_bar: "append",
  // ADR-912 진로 1번: illustrated_message 는 rule fill transparent base box 위 placeholder+text → append.
  illustrated_message: "append",
  // ADR-912 진로 1번: status_light 는 dot+text 자체 생성, box 무의미 → replace.
  //   rule fill base 는 dot 색(variant status). base box 로 칠하면 box 전체가 status 색 →
  //   DOM(dot 만 색) 과 비대칭. replace 로 base box 미생성, escape 가 dot circle + text 만 그림.
  status_light: "replace",
};

export function getSkiaPrimitive(
  key: string | undefined,
): SkiaPrimitiveDrawFn | undefined {
  return key ? SKIA_PRIMITIVES[key] : undefined;
}

/** draw module 합성 모드. 미등록/미지정 키는 "replace"(box+text 대체, 기존 호환). */
export function getSkiaPrimitiveMode(
  key: string | undefined,
): SkiaPrimitiveMode {
  return (key && SKIA_PRIMITIVE_MODES[key]) || "replace";
}
