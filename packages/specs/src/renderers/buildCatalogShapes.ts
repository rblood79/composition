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
import type { ComponentState, Shape, SizeSpec } from "../types";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";
import type { ComponentVisualRule } from "./utils/resolveComponentVisual";

/**
 * generic box+text 시각 생성기 (ADR-142 G2(b) B — spec-free).
 *
 * **데이터 소스 (B swap)**: 더 이상 `spec` 을 읽지 않는다. variant 색상(`visual`) + size(`size`)
 * + text-decoration(`textDecoration`)을 caller(builder buildSpecNodeData)가 rule 테이블
 * (`resolveComponentRule`)에서 해소해 주입한다. 패키지 경계(`specs ← shared`)상 본 함수(specs)는
 * shared rule 테이블을 import 못 하므로 builder 가 주입 책임을 진다. spec runtime 참조 0(#8).
 *
 * @param visual variant 시각 규칙(rule.variants[v] 투영). variant 없는 컨테이너 shell 은 undefined.
 * @param textDecoration underline 등 D3 text-decoration 메타(Link). 미지정 시 미적용.
 */
export function buildCatalogShapes(
  visual: ComponentVisualRule | undefined,
  props: Record<string, unknown>,
  size: SizeSpec,
  state: ComponentState = "default",
  textDecoration?: string,
): Shape[] {
  const style = props.style as Record<string, unknown> | undefined;

  const fill = visual?.fill;

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
  // subtle→subtleText, 그 외 hover textHover / text. (visual = resolveComponentVisual 어댑터)
  const textColor =
    (style?.color as string | undefined) ??
    (isSelected
      ? isEmphasized
        ? (visual?.emphasizedSelectedText ?? visual?.selectedText)
        : visual?.selectedText
      : isOutline
        ? (visual?.outlineText ?? visual?.text)
        : isSubtle
          ? (visual?.subtleText ?? visual?.text)
          : state === "hover" && visual?.textHover
            ? visual.textHover
            : visual?.text);

  // 테두리색: selected→selectedBorder/emphasizedSelectedBorder, outline→outlineBorder,
  // 그 외 hover borderHover / border.
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isSelected
      ? isEmphasized
        ? (visual?.emphasizedSelectedBorder ?? visual?.selectedBorder)
        : visual?.selectedBorder
      : isOutline
        ? (visual?.outlineBorder ?? visual?.border)
        : state === "hover" && visual?.borderHover
          ? visual.borderHover
          : visual?.border);

  const text =
    (props.children as string | undefined) ||
    (props.text as string | undefined) ||
    (props.label as string | undefined);

  // 비-DOM-trivial primitive(원/선/아이콘 등 box+text 로 표현 안 되는 도형)는 여기서
  // 그리지 않는다 — `PrimitiveBinding.skiaPrimitive` draw module(renderers/skiaPrimitives.ts)이
  // 담당한다. dispatch(buildSpecNodeData)가 binding.skiaPrimitive 유무로 갈라, 있으면 그
  // draw module 로, 없으면 본 함수(box+text 보편 frame)로 보낸다. 컴포넌트 식별 분기(isDot/
  // divider/iconName)를 본 함수 안에 인라인하지 않는다(정본: 데이터 분기, ADR-142 §3 skiaPrimitive).

  // 보이지 않는 배경 생략 (Link 류 text-only leaf / variant 없는 컨테이너 shell):
  //   채울 배경색(bgColor)도 테두리(borderColor)도 없으면 그릴 box 가 없으므로 생략한다.
  //   - Link: fill.alpha===0 → bgColor 가 transparent 가 아니어도 alpha 0 이면 투명 box 무의미.
  //   - field/Slider 등 variant 없는 컨테이너: variant 없음 → fill/bgColor undefined →
  //     `_hasChildren` 자식이 배경 담당, 부모는 빈 shell(legacy render.shapes 빈 배열 parity).
  //   backgroundColor 가 명시되면 사용자 의도이므로 box 를 그린다.
  const hasVisibleBg =
    style?.backgroundColor != null ||
    (bgColor != null && (fill?.alpha ?? 1) !== 0) ||
    !!borderColor;

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

    // underline 등 text-decoration 은 caller 가 rule 메타로 주입(Link.spec composition
    // rootSelectors text-decoration 의 거울). spec 직접 읽기 제거(#8).

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
