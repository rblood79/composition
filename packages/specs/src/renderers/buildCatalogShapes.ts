/**
 * ADR-142 #5 increment (a) — generic shape-descriptor 생성기.
 *
 * per-component `spec.render.shapes()` 를 대체하는 **component-agnostic** 생성기.
 * box+text leaf primitive 의 공통 시각(bg roundRect + border + text)을 spec 의
 * `variants[variant].fill`(ADR-908 `resolveFillTokens`) + `sizes[size]` + props 에서
 * generic 하게 만든다. 출력은 기존 `specShapesToSkia` 가 그대로 소비(theme 토큰 해결).
 *
 * **전환기**: spec 의 ADR-908 FillTokenSpec 을 직접 읽음(#8 theme adapter 와 동일 패턴,
 * 목표는 theme/tokens data-* rules). **범위**: non-outline non-icon box+text leaf
 * (cutover leaf binding 의 accepts 범위 — #7 finding: icon=reusable, fillStyle deferred).
 * arc/track/wheel/indicator(특수 shape) 는 `PrimitiveBinding.skiaPrimitive` 분기(후속).
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §"#5 Skia backend"
 */

import { parseBorderWidth, parsePxValue } from "../primitives";
import { fontFamily } from "../primitives/typography";
import type {
  ComponentSpec,
  ComponentState,
  Shape,
  SizeSpec,
  VariantSpec,
} from "../types";
import { resolveFillTokens } from "../utils/fillTokens";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";

export function buildCatalogShapes(
  spec: ComponentSpec<Record<string, unknown>>,
  props: Record<string, unknown>,
  size: SizeSpec,
  state: ComponentState = "default",
): Shape[] {
  const style = props.style as Record<string, unknown> | undefined;

  const variantName =
    (props.variant as string | undefined) ?? spec.defaultVariant;
  const variant =
    variantName && spec.variants
      ? (spec.variants[variantName] as VariantSpec | undefined)
      : undefined;
  const fill = variant ? resolveFillTokens(variant) : undefined;

  const borderRadius = parsePxValue(style?.borderRadius, size.borderRadius);
  const borderWidth = parseBorderWidth(style?.borderWidth, 1);

  // fillStyle 별 fill state subset — outline/subtle 은 Partial(미정의 시 fallback).
  const fillStyleProp = (props.fillStyle as string | undefined) ?? "fill";
  const isOutline = fillStyleProp === "outline";
  const isSubtle = fillStyleProp === "subtle";
  const fillStates = isOutline
    ? fill?.outline
    : isSubtle
      ? fill?.subtle
      : fill?.default;

  // selected 축 (ToggleButton 류) — props.isSelected + isEmphasized.
  // state(default/hover/pressed)와 직교하는 selection 차원. spec.variant.fill.default.
  // selected/emphasizedSelected + variant.selectedText/selectedBorder 데이터에서 읽는다.
  const isSelected = props.isSelected === true;
  const isEmphasized = props.isEmphasized === true;

  const stateBg = isSelected
    ? isEmphasized
      ? (fill?.default.emphasizedSelected ?? fill?.default.selected)
      : fill?.default.selected
    : state === "hover"
      ? (fillStates?.hover ?? fillStates?.base)
      : state === "pressed"
        ? (fillStates?.pressed ?? fillStates?.base)
        : fillStates?.base;

  // 상태별 배경색 (사용자 스타일 우선). outline 은 base 미정의 시 transparent.
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    stateBg ??
    (isOutline ? ("{color.transparent}" as unknown as string) : undefined);

  // 텍스트색: selected→selectedText/emphasizedSelectedText, outline→outlineText,
  // subtle→subtleText, 그 외 hover textHover / text.
  const textColor =
    (style?.color as string | undefined) ??
    (isSelected
      ? isEmphasized
        ? (variant?.emphasizedSelectedText ?? variant?.selectedText)
        : variant?.selectedText
      : isOutline
        ? (variant?.outlineText ?? variant?.text)
        : isSubtle
          ? (variant?.subtleText ?? variant?.text)
          : state === "hover" && variant?.textHover
            ? variant.textHover
            : variant?.text);

  // 테두리색: selected→selectedBorder/emphasizedSelectedBorder, outline→outlineBorder,
  // 그 외 hover borderHover / border.
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isSelected
      ? isEmphasized
        ? (variant?.emphasizedSelectedBorder ?? variant?.selectedBorder)
        : variant?.selectedBorder
      : isOutline
        ? (variant?.outlineBorder ?? variant?.border)
        : state === "hover" && variant?.borderHover
          ? variant.borderHover
          : variant?.border);

  const text =
    (props.children as string | undefined) ||
    (props.text as string | undefined) ||
    (props.label as string | undefined);

  // ── divider(선 자체가 채워진 얇은 box) generic 분기 ──────────────────────
  // 배경 투명(fill.alpha===0) + 텍스트/자식 없음 + 선색 있음 = divider/separator 패턴.
  // generic "bg roundRect(alpha 0) + border(테두리)" 모델은 1px 박스의 *테두리* 를 그려
  // legacy 의 "선색으로 채운 얇은 box"(rect{fill=선색, height=size.height})와 시각이 다르다.
  // 이 패턴은 단일 rect 로 선을 그린다 — orientation(vertical) 시 두께/길이 축 전환.
  // (outline 버튼은 텍스트가 있어 이 분기에 들지 않는다 — 아래 일반 경로.)
  if ((fill?.alpha ?? 1) === 0 && !text && !props._hasChildren && borderColor) {
    const isVertical = (props.orientation as string | undefined) === "vertical";
    const thickness = size.height;
    return [
      {
        type: "rect",
        x: 0,
        y: 0,
        width: isVertical ? thickness : ("auto" as unknown as number),
        height: isVertical ? ("auto" as unknown as number) : thickness,
        fill: borderColor,
      },
    ];
  }

  // 보이지 않는 배경 생략 (Link 류 text-only leaf):
  //   배경 투명(fill.alpha===0) + 사용자 backgroundColor 없음 + 테두리 없음 →
  //   그릴 배경 box 가 없으므로 bg roundRect 를 만들지 않는다 (legacy Link = text shape 만).
  // backgroundColor 가 명시되면 alpha 무시하고 box 를 그린다(사용자 의도).
  const hasVisibleBg =
    style?.backgroundColor != null || (fill?.alpha ?? 1) !== 0 || !!borderColor;

  const shapes: Shape[] = [];
  if (hasVisibleBg) {
    shapes.push({
      id: "bg",
      type: "roundRect",
      x: 0,
      y: 0,
      width: "auto",
      height: "auto" as unknown as number,
      radius: borderRadius as unknown as number,
      fill: bgColor,
      fillAlpha: fill?.alpha ?? 1,
    });
    if (borderColor) {
      shapes.push({
        type: "border",
        target: "bg",
        borderWidth,
        color: borderColor,
        radius: borderRadius as unknown as number,
      });
    }
  }

  // Child Composition: 자식 Element 가 있으면 shell(box) 만 반환
  if (props._hasChildren) return shapes;

  if (text) {
    const paddingX = parsePxValue(
      style?.paddingLeft ?? style?.paddingRight ?? style?.padding,
      size.paddingX,
    );
    const fontSize = resolveSpecFontSize(
      (style?.fontSize as string | number | undefined) ?? size.fontSize,
      16,
    );
    const fwRaw = style?.fontWeight;
    const fw =
      fwRaw != null
        ? typeof fwRaw === "number"
          ? fwRaw
          : parseInt(String(fwRaw), 10) || 500
        : 500;
    const ff = (style?.fontFamily as string) || fontFamily.sans;

    // inline text leaf (size.height===0, 예: Link) 는 top/left, box 는 middle/center.
    // height 0 컨테이너에서 align/baseline 은 시각상 무의미하나 legacy render.shapes parity 유지.
    const isInlineText = size.height === 0 && !hasVisibleBg;
    const textAlign =
      (style?.textAlign as "left" | "center" | "right") ||
      (isInlineText ? "left" : "center");

    // underline 등 text-decoration 은 spec.composition.rootSelectors["&"] 의 D3 데이터에서 읽는다
    // (render.shapes 하드코딩의 거울 — Link.spec composition rootSelectors text-decoration).
    const textDecoration =
      spec.composition?.rootSelectors?.["&"]?.styles?.["text-decoration"];

    shapes.push({
      type: "text",
      x: paddingX,
      y: 0,
      text,
      fontSize,
      fontFamily: ff,
      fontWeight: fw,
      fill: textColor,
      align: textAlign,
      baseline: isInlineText ? "top" : "middle",
      ...(textDecoration ? { textDecoration } : {}),
    });
  }

  return shapes;
}
