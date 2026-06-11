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
  // border-width: 사용자 style 우선, 없으면 size.borderWidth(보편 D3 속성), 최종 fallback 1.
  const borderWidth = parseBorderWidth(
    style?.borderWidth,
    size.borderWidth ?? 1,
  );

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

  // staticColor: theme 무관 고정 텍스트색 (Link/Button/ToggleButton 공유 D2 prop).
  //   black→#000000 / white→#ffffff. auto·undefined 는 미적용(variant 색 경로 유지).
  //   render.shapes 의 `style?.color ?? staticTextColor ?? variant 색` 우선순위 재현 —
  //   style.color(사용자 명시) > staticColor(prop) > variant/state 색.
  const staticColorProp = props.staticColor as string | undefined;
  const staticTextColor =
    staticColorProp === "black"
      ? "#000000"
      : staticColorProp === "white"
        ? "#ffffff"
        : undefined;

  // 텍스트색: selected→selectedText/emphasizedSelectedText, outline→outlineText,
  // subtle→subtleText, 그 외 hover textHover / text. (visual = resolveComponentVisual 어댑터)
  const textColor =
    (style?.color as string | undefined) ??
    staticTextColor ??
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
    (props.label as string | undefined) ||
    (props.text as string | undefined) ||
    (props.children as string | undefined) ||
    // ADR-912 R1 (2026-06-12): placeholder 는 보편 RAC prop — 값이 비었을 때 DOM 이
    //   placeholder 를 표시하듯 Skia 도 동일 text 로 그린다 (SelectValue/Input 류 field leaf).
    //   컴포넌트 식별 분기 아님 — 데이터 유무로만 분기 (ADR-142 §3).
    (props.placeholder as string | undefined);

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
      // border-style 은 보편 D3 속성(CSS border-style 동형). visual.borderStyle 우선,
      // 없으면 specShapeConverter 가 "solid" fallback(미지정 시 style 키 생략 → solid).
      const borderStyle = visual?.borderStyle;
      shapes.push({
        type: "border",
        target: "bg",
        borderWidth,
        color: borderColor,
        radius: borderRadius as unknown as number,
        ...(borderStyle ? { style: borderStyle } : {}),
      });
    }
  }

  // Child Composition: 자식 Element 가 있으면 shell(box) 만 반환
  if (props._hasChildren) return shapes;

  if (text) {
    // ADR-912 paddingX 데이터 갭 (2026-06-05): `size.paddingX ?? 0` — text-bearing box type
    //   (Button/ToggleButton/Badge 등)은 componentRulesTable.sizes.paddingX 가 의도된 x 를 제공하고,
    //   inline text leaf(Text/Heading/Label/Description, paddingX 의미상 0)는 rule 에 paddingX 미정의 →
    //   `?? 0` 으로 left 정렬 x=0 확정. **Why**: 미정의 시 parsePxValue 가 undefined 반환 → 하류
    //   nodeRendererText `paddingLeft + textIndent` 가 NaN 전파 → drawX=NaN → 텍스트 미표시.
    //   본 `?? 0` 은 NaN 방지 안전장치이며 데이터 보강(rule paddingX)을 대체하지 않는다 — box type 의
    //   비-0 paddingX 는 rule 데이터가 제공하고, 0 fallback 은 inline text 의 올바른 값일 뿐.
    const paddingX = parsePxValue(
      style?.paddingLeft ?? style?.paddingRight ?? style?.padding,
      size.paddingX ?? 0,
    );
    const fontSize = resolveSpecFontSize(
      (style?.fontSize as string | number | undefined) ?? size.fontSize,
      16,
    );
    // leading icon (ADR-912 (B+icon)): visual.leadingIcon 존재 시 text 를 icon 폭 + gap 만큼
    //   우측 shift (icon 은 leading_icon skiaPrimitive 가 좌측 paddingX 에 그림 — text 중복 없음).
    //   컴포넌트별 if 아님 — visual.leadingIcon 데이터 유무로만 분기(ADR-142 §3). icon glyph 크기 =
    //   size.iconSize(rule, size 별). 미정의 시 fontSize*1.1 fallback(leading_icon module 과 동형).
    const leadingIconWidth = visual?.leadingIcon
      ? (typeof size.iconSize === "number" && size.iconSize > 0
          ? size.iconSize
          : Math.round(fontSize * 1.1)) + (visual.leadingIcon.gap ?? 6)
      : 0;
    const textX = paddingX + leadingIconWidth;
    // font-weight: 사용자 style 우선, 없으면 visual.textWeight(variant 시각 — DropZone 400 등),
    // 최종 fallback 500. textWeight 는 보편 D3 속성(CSS font-weight 동형).
    const fwRaw = style?.fontWeight;
    const fw =
      fwRaw != null
        ? typeof fwRaw === "number"
          ? fwRaw
          : parseInt(String(fwRaw), 10) || 500
        : (visual?.textWeight ?? 500);
    // font-family: 사용자 style 우선, 없으면 visual.fontFamily(variant 시각 — Code/Kbd mono),
    // 최종 fallback sans. fontFamily 는 보편 D3 속성(CSS font-family 동형, textWeight 와 동형 패턴).
    const ff =
      (style?.fontFamily as string) || visual?.fontFamily || fontFamily.sans;

    // inline text leaf (size.height===0, 예: Link/TEXT_LEAF/Label) 는 top/left, box 는 middle/center.
    // ADR-912 선행-6(2026-06-04): align/baseline 판정은 **보이는(opaque) 배경** 기준이어야 한다.
    //   `hasVisibleBg`(box 그리기 게이트)는 `{color.transparent}` fill 도 true(레이아웃 box 보존)
    //   라서, 그대로 쓰면 transparent-fill inline text leaf(TEXT_LEAF/Label)가 box 로 오판되어
    //   align center/baseline middle drift(spec render.shapes 는 left/top|middle). bgColor 가
    //   transparent 토큰이거나 fill.alpha===0 이면 시각상 배경 없음 → inline 으로 간주.
    //   box 그리기 자체(L141 hasVisibleBg)는 미변경 → transparent 레이아웃 box(컨테이너) 회귀 0.
    const hasOpaqueBg =
      style?.backgroundColor != null ||
      (bgColor != null &&
        bgColor !== "{color.transparent}" &&
        (fill?.alpha ?? 1) !== 0) ||
      !!borderColor;
    const isInlineText = size.height === 0 && !hasOpaqueBg;
    // leading icon (ADR-912 (B+icon)): icon 옆 text 는 항상 left-align(box 기본 center 가 아님).
    //   사용자 명시 style.textAlign > leadingIcon left > inline/box 기본. DisclosureHeader 처럼
    //   transparent box(height>0) 라도 leading icon 동반 text 는 좌측 정렬이 spec parity.
    const textAlign =
      (style?.textAlign as "left" | "center" | "right") ||
      (visual?.leadingIcon ? "left" : isInlineText ? "left" : "center");

    // underline 등 text-decoration 은 caller 가 rule 메타로 주입(Link.spec composition
    // rootSelectors text-decoration 의 거울). spec 직접 읽기 제거(#8).

    // line-height: rule size.lineHeight(TokenRef 또는 px) 를 그대로 전달 — Skia 경로는
    //   specShapeConverter, layout 측정 경로는 resolveShapeLineHeight 가 resolve.
    //   **TEXT_LEAF(height=0) catalog 전환 필수**: 미전달 시 measure 가 fontSize*1.5 fallback
    //   으로 떨어져 size 별 typography lineHeight 와 drift(예: text-base 24 vs 16*1.5=24 우연
    //   일치, text-xs 16 vs 18 drift). render.shapes 의 `lineHeight: size.lineHeight` 와 동형.
    //   box형(height>0)은 TEXT_LEAF_TAGS 비멤버라 measure 경로 비진입 → 측정 무영향(Skia 정렬만 동일).
    const lineHeightVal = (size as { lineHeight?: unknown }).lineHeight;

    shapes.push({
      type: "text",
      x: textX,
      y: 0,
      text,
      fontSize,
      fontFamily: ff,
      fontWeight: fw,
      fill: textColor,
      align: textAlign,
      baseline: isInlineText ? "top" : "middle",
      ...(lineHeightVal != null
        ? { lineHeight: lineHeightVal as unknown as number }
        : {}),
      ...(textDecoration ? { textDecoration } : {}),
    });
  }

  return shapes;
}
