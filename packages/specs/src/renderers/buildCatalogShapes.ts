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

  const stateBg =
    state === "hover"
      ? (fillStates?.hover ?? fillStates?.base)
      : state === "pressed"
        ? (fillStates?.pressed ?? fillStates?.base)
        : fillStates?.base;

  // 상태별 배경색 (사용자 스타일 우선). outline 은 base 미정의 시 transparent.
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    stateBg ??
    (isOutline ? ("{color.transparent}" as unknown as string) : undefined);

  // 텍스트색: outline→outlineText, subtle→subtleText, 그 외 hover textHover / text.
  const textColor =
    (style?.color as string | undefined) ??
    (isOutline
      ? (variant?.outlineText ?? variant?.text)
      : isSubtle
        ? (variant?.subtleText ?? variant?.text)
        : state === "hover" && variant?.textHover
          ? variant.textHover
          : variant?.text);

  // 테두리색: outline→outlineBorder, 그 외 hover borderHover / border.
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isOutline
      ? (variant?.outlineBorder ?? variant?.border)
      : state === "hover" && variant?.borderHover
        ? variant.borderHover
        : variant?.border);

  const shapes: Shape[] = [
    {
      id: "bg",
      type: "roundRect",
      x: 0,
      y: 0,
      width: "auto",
      height: "auto" as unknown as number,
      radius: borderRadius as unknown as number,
      fill: bgColor,
      fillAlpha: fill?.alpha ?? 1,
    },
  ];

  if (borderColor) {
    shapes.push({
      type: "border",
      target: "bg",
      borderWidth,
      color: borderColor,
      radius: borderRadius as unknown as number,
    });
  }

  // Child Composition: 자식 Element 가 있으면 shell(box) 만 반환
  if (props._hasChildren) return shapes;

  const text =
    (props.children as string | undefined) ||
    (props.text as string | undefined) ||
    (props.label as string | undefined);

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
    const textAlign =
      (style?.textAlign as "left" | "center" | "right") || "center";

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
      baseline: "middle",
    });
  }

  return shapes;
}
