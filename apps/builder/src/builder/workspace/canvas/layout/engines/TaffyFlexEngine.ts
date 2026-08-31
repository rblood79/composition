/**
 * Taffy 기반 Flexbox 레이아웃 엔진
 *
 * 별도 layout runtime 위임 대신 Taffy WASM을 직접 호출하여
 * Flexbox 레이아웃을 계산합니다.
 *
 * Feature Flag(useTaffyFlex)가 활성화된 경우에만 사용됩니다.
 *
 * @since 2026-02-17 Phase 5 - Flex Yoga → Taffy 전환
 */

import type { CanvasLayoutNode } from "../layoutNode";
import type { TaffyStyle } from "../../wasm-bindings/layoutTypes";
import {
  parseMargin,
  parseCSSPropWithContext,
  applyCommonTaffyStyle,
} from "./utils";
import type { ComputedStyle } from "./cssResolver";
import type { CSSValueContext } from "./cssValueParser";

// ─── margin:auto 판별 ────────────────────────────────────────────────

/**
 * margin shorthand/개별 속성에서 'auto' 값인 방향을 판별.
 *
 * parseMargin()은 숫자 전용(Margin = {top: number, ...})이므로 'auto'를 표현 불가.
 * Taffy의 margin:auto 네이티브 지원을 활용하기 위해 원본 값을 직접 검사한다.
 */
function resolveMarginAutoSides(style: Record<string, unknown> | undefined): {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
} {
  const result = { top: false, right: false, bottom: false, left: false };
  if (!style) return result;

  // shorthand에서 auto 판별
  if (typeof style.margin === "string") {
    const tokens = style.margin.trim().split(/\s+/);
    const sides = (() => {
      switch (tokens.length) {
        case 1:
          return {
            top: tokens[0],
            right: tokens[0],
            bottom: tokens[0],
            left: tokens[0],
          };
        case 2:
          return {
            top: tokens[0],
            right: tokens[1],
            bottom: tokens[0],
            left: tokens[1],
          };
        case 3:
          return {
            top: tokens[0],
            right: tokens[1],
            bottom: tokens[2],
            left: tokens[1],
          };
        case 4:
          return {
            top: tokens[0],
            right: tokens[1],
            bottom: tokens[2],
            left: tokens[3],
          };
        default:
          return { top: "", right: "", bottom: "", left: "" };
      }
    })();
    result.top = sides.top === "auto";
    result.right = sides.right === "auto";
    result.bottom = sides.bottom === "auto";
    result.left = sides.left === "auto";
  }

  // 개별 속성이 shorthand를 override (CSS 우선순위)
  if (style.marginTop !== undefined) result.top = style.marginTop === "auto";
  if (style.marginRight !== undefined)
    result.right = style.marginRight === "auto";
  if (style.marginBottom !== undefined)
    result.bottom = style.marginBottom === "auto";
  if (style.marginLeft !== undefined) result.left = style.marginLeft === "auto";

  return result;
}

// ─── Style conversion ────────────────────────────────────────────────

/**
 * CanvasLayoutNode의 style을 TaffyStyle로 변환
 *
 * Taffy 네이티브 형식으로 직접 변환합니다.
 * fit-content, 태그별 크기 계산은 engines/utils.ts의 유틸리티를 사용합니다.
 */
export function elementToTaffyStyle(
  element: CanvasLayoutNode,
  computedStyle?: ComputedStyle,
  ctx: CSSValueContext = {},
): TaffyStyle {
  const style = (element.props?.style || {}) as Record<string, unknown>;
  const result: TaffyStyle = {};

  // Display
  const display = style.display as string | undefined;
  if (display === "flex" || display === "inline-flex") {
    result.display = "flex";
  } else if (display === "none") {
    result.display = "none";
  } else {
    // Flex 컨텍스트에서의 기본 자식은 flex item
    result.display = "flex";
  }

  // Position
  // CSS position:absolute / position:fixed → Taffy Position::Absolute
  // CSS position:relative → Taffy Position::Relative (Taffy 기본값이지만 명시적으로 전달)
  // CSS position:static / 미지정 → Taffy 기본값(Relative)
  if (style.position === "absolute" || style.position === "fixed") {
    result.position = "absolute";
  } else if (style.position === "relative") {
    result.position = "relative";
    // Taffy 0.9는 Position::Relative에서 inset을 네이티브로 처리한다.
    // inset은 아래 "Inset (position offsets)" 블록에서 전달됨.
  }
  // static / sticky / 미지정은 Taffy 기본값(relative)으로 처리되므로 별도 설정 불필요

  // Size + Min/Max + Padding + Border + Gap (공통 헬퍼)
  // r7m2: 상속 computed fontSize 를 lineHeight 환산 기준으로 전달 (inline 우선은
  // applyCommonTaffyStyle 내부에서 처리 — computed 는 inline 을 이미 포함한다).
  applyCommonTaffyStyle(
    result as Record<string, unknown>,
    style,
    ctx,
    computedStyle?.fontSize,
  );

  // flex-flow shorthand 파싱: "flex-direction flex-wrap" 복합 값
  // 개별 속성(flexDirection, flexWrap)이 이미 설정되어 있으면 shorthand보다 우선합니다.
  let resolvedFlexDirection = style.flexDirection as string | undefined;
  let resolvedFlexWrap = style.flexWrap as string | undefined;
  if (style.flexFlow) {
    const parts = String(style.flexFlow).split(/\s+/);
    for (const part of parts) {
      if (["row", "column", "row-reverse", "column-reverse"].includes(part)) {
        resolvedFlexDirection = resolvedFlexDirection ?? part;
      } else if (["nowrap", "wrap", "wrap-reverse"].includes(part)) {
        resolvedFlexWrap = resolvedFlexWrap ?? part;
      }
    }
  }

  // Flex direction
  if (resolvedFlexDirection) {
    result.flexDirection = resolvedFlexDirection as TaffyStyle["flexDirection"];
  }

  // Flex wrap
  if (resolvedFlexWrap) {
    result.flexWrap = resolvedFlexWrap as TaffyStyle["flexWrap"];
  }

  // Justify content
  if (style.justifyContent) {
    result.justifyContent =
      style.justifyContent as TaffyStyle["justifyContent"];
  }

  // Align items
  if (style.alignItems) {
    result.alignItems = style.alignItems as TaffyStyle["alignItems"];
  }

  // Align content
  if (style.alignContent) {
    result.alignContent = style.alignContent as TaffyStyle["alignContent"];
  }

  // Flex shorthand: flex: <grow> [<shrink>] [<basis>]
  // 개별 속성(flexGrow, flexShrink, flexBasis)이 이미 설정되어 있으면 shorthand보다 우선합니다.
  if (style.flex !== undefined && style.flex !== null) {
    const flexVal = style.flex;
    if (typeof flexVal === "number") {
      // flex: 1 → flexGrow: 1, flexShrink: 1, flexBasis: 0%
      if (style.flexGrow === undefined) result.flexGrow = flexVal;
      if (style.flexShrink === undefined) result.flexShrink = 1;
      if (style.flexBasis === undefined) result.flexBasis = "0%";
    } else if (typeof flexVal === "string") {
      const parts = String(flexVal).trim().split(/\s+/);
      if (parts.length === 1) {
        const n = Number(parts[0]);
        if (!isNaN(n)) {
          if (style.flexGrow === undefined) result.flexGrow = n;
          if (style.flexShrink === undefined) result.flexShrink = 1;
          if (style.flexBasis === undefined) result.flexBasis = "0%";
        } else if (parts[0] === "auto") {
          if (style.flexGrow === undefined) result.flexGrow = 1;
          if (style.flexShrink === undefined) result.flexShrink = 1;
        } else if (parts[0] === "none") {
          if (style.flexGrow === undefined) result.flexGrow = 0;
          if (style.flexShrink === undefined) result.flexShrink = 0;
        }
      } else if (parts.length >= 2) {
        if (style.flexGrow === undefined)
          result.flexGrow = Number(parts[0]) || 0;
        if (style.flexShrink === undefined)
          result.flexShrink = Number(parts[1]) || 0;
        if (parts[2] && style.flexBasis === undefined) {
          const basisVal = parseCSSPropWithContext(parts[2], ctx);
          if (basisVal !== undefined) result.flexBasis = basisVal;
        } else if (!parts[2] && style.flexBasis === undefined) {
          result.flexBasis = "0%";
        }
      }
    }
  }

  // Flex item properties (개별 속성은 shorthand 결과를 덮어씀)
  if (style.flexGrow !== undefined) result.flexGrow = Number(style.flexGrow);
  if (style.flexShrink !== undefined)
    result.flexShrink = Number(style.flexShrink);
  if (style.flexBasis !== undefined) {
    const basis = parseCSSPropWithContext(style.flexBasis, ctx);
    if (basis !== undefined) result.flexBasis = basis;
  }

  // Align self
  if (style.alignSelf) {
    result.alignSelf = style.alignSelf as TaffyStyle["alignSelf"];
  }

  // Order (flex item 순서 제어)
  const order = parseInt(String(style.order ?? "0"), 10);
  if (!isNaN(order) && order !== 0) {
    result.order = order;
  }

  // Margin — margin:auto는 parseMargin()이 숫자 전용이므로 원본 값을 직접 검사
  // 숫자를 직접 전달 (normalizeStyle.dimToString이 JSON 직렬화 시 "Npx"로 변환)
  const margin = parseMargin(style);
  const marginAuto = resolveMarginAutoSides(style);
  result.marginTop = marginAuto.top
    ? "auto"
    : margin.top !== 0
      ? margin.top
      : undefined;
  result.marginRight = marginAuto.right
    ? "auto"
    : margin.right !== 0
      ? margin.right
      : undefined;
  result.marginBottom = marginAuto.bottom
    ? "auto"
    : margin.bottom !== 0
      ? margin.bottom
      : undefined;
  result.marginLeft = marginAuto.left
    ? "auto"
    : margin.left !== 0
      ? margin.left
      : undefined;

  // Inset (position offsets)
  // Taffy 0.9는 Position::Relative와 Position::Absolute 모두에서
  // inset(top/right/bottom/left)을 네이티브로 처리하여 layout.location에 반영한다.
  if (
    style.position === "absolute" ||
    style.position === "fixed" ||
    style.position === "relative"
  ) {
    const top = parseCSSPropWithContext(style.top, ctx);
    const left = parseCSSPropWithContext(style.left, ctx);
    const right = parseCSSPropWithContext(style.right, ctx);
    const bottom = parseCSSPropWithContext(style.bottom, ctx);
    if (top !== undefined) result.insetTop = top;
    if (left !== undefined) result.insetLeft = left;
    if (right !== undefined) result.insetRight = right;
    if (bottom !== undefined) result.insetBottom = bottom;
  }

  return result;
}
