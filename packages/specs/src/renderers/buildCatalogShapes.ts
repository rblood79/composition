/**
 * ADR-142 #5 — generic box+text 시각 생성기 (component-agnostic).
 *
 * **정본 범위 (사용자 정정 2026-05-31)**: 모든 frame 이 공유하는 **보편 box+text 시각**만
 * generic 처리한다 — bg roundRect + border + text. 색/크기/형태는 `variants[variant].fill`
 * (ADR-908 `resolveFillTokens`) + `sizes[size]` + `props.style` 에서 읽되, **컴포넌트 식별
 * 분기를 두지 않는다**. fill/outline/subtle/selected 축은 모든 frame 이 가질 수 있는 보편
 * 상태축(CSS data-* 와 동형)이라 여기서 fill 색 결정에 쓴다.
 *
 * **비-DOM-trivial primitive(원/선/아이콘 등)는 본 함수가 그리지 않는다** —
 * `PrimitiveBinding.skiaPrimitive` draw module(`renderers/skiaPrimitives.ts`)이 담당하고,
 * dispatch(buildSpecNodeData)가 `binding.skiaPrimitive` 유무로 갈린다. `if (isDot)/if (divider)/
 * if (iconName)` 같은 컴포넌트 식별 분기를 본 함수에 인라인하면 컴포넌트 N++ 복제가 된다(금지).
 *
 * **전환기**: spec 의 ADR-908 FillTokenSpec 을 직접 읽음(#8 theme adapter 와 동일 패턴,
 * 목표는 theme/tokens data-* rules). 출력은 기존 `specShapesToSkia` 가 그대로 소비.
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §"#5 Skia backend" + §3 skiaPrimitive
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

  // 비-DOM-trivial primitive(원/선/아이콘 등 box+text 로 표현 안 되는 도형)는 여기서
  // 그리지 않는다 — `PrimitiveBinding.skiaPrimitive` draw module(renderers/skiaPrimitives.ts)이
  // 담당한다. dispatch(buildSpecNodeData)가 binding.skiaPrimitive 유무로 갈라, 있으면 그
  // draw module 로, 없으면 본 함수(box+text 보편 frame)로 보낸다. 컴포넌트 식별 분기(isDot/
  // divider/iconName)를 본 함수 안에 인라인하지 않는다(정본: 데이터 분기, ADR-142 §3 skiaPrimitive).

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
