/**
 * Taffy 기반 Block 레이아웃 엔진
 *
 * CSS display:block / inline-block / inline / flow-root 컨텍스트를
 * Taffy WASM의 네이티브 Block 레이아웃으로 계산합니다.
 *
 * taffyDisplayAdapter를 통해 inline-block 자식을 가진 부모는
 * flex row wrap으로 자동 변환하여 inline flow를 시뮬레이션합니다.
 *
 * @since 2026-02-28 Phase 11 - Block → Taffy Block 전환
 */

import type { CanvasLayoutNode } from "../layoutNode";
import type { TaffyStyle } from "../../wasm-bindings/layoutTypes";
import {
  parseMargin,
  applyCommonTaffyStyle,
  parseCSSPropWithContext,
} from "./utils";
import type { CSSValueContext } from "./cssValueParser";
import type { TaffyDisplayConfig } from "./taffyDisplayAdapter";

// ─── margin:auto 판별 ────────────────────────────────────────────────

/**
 * margin shorthand/개별 속성에서 'auto' 값인 방향을 판별.
 *
 * parseMargin()은 숫자 전용(Margin = {top: number, ...})이므로 'auto'를 표현 불가.
 * Taffy의 margin:auto 네이티브 지원을 활용하기 위해 원본 값을 직접 검사한다.
 *
 * TaffyFlexEngine의 동일한 헬퍼를 복사 — private이므로 재사용 불가.
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

// ─── Style 변환 ────────────────────────────────────────────────────────

/**
 * Block 컨텍스트 자식 CanvasLayoutNode의 style을 TaffyStyle로 변환
 *
 * TaffyFlexEngine의 elementToTaffyStyle()과 달리 flex 전용 속성(flex-flow,
 * flex shorthand, order 등)을 파싱하지 않습니다.
 * taffyConfig에서 inline-block 리프의 flexGrow/flexShrink를 적용합니다.
 *
 * @param element - 대상 CanvasLayoutNode
 * @param taffyConfig - toTaffyDisplay()의 반환값 (자식 노드용)
 * @param ctx - CSS 값 파싱 컨텍스트
 */
export function elementToTaffyBlockStyle(
  element: CanvasLayoutNode,
  taffyConfig: TaffyDisplayConfig,
  ctx: CSSValueContext = {},
): TaffyStyle {
  const style = (element.props?.style || {}) as Record<string, unknown>;
  const result: TaffyStyle = {};

  // Display — taffyDisplayAdapter 결과 적용
  result.display = taffyConfig.taffyDisplay;

  // TaffyDisplayConfig 전체 필드 패스스루
  // inline-block 리프: flexGrow/flexShrink 고정 (크기 고정 아이템)
  if (taffyConfig.flexGrow !== undefined)
    result.flexGrow = taffyConfig.flexGrow;
  if (taffyConfig.flexShrink !== undefined)
    result.flexShrink = taffyConfig.flexShrink;
  // inline-block 부모 (flex row wrap 시뮬레이션): flexDirection/flexWrap/alignItems/alignContent
  if (taffyConfig.flexDirection)
    result.flexDirection = taffyConfig.flexDirection;
  if (taffyConfig.flexWrap) result.flexWrap = taffyConfig.flexWrap;
  if (taffyConfig.alignItems)
    result.alignItems = taffyConfig.alignItems as TaffyStyle["alignItems"];
  if (taffyConfig.alignContent)
    result.alignContent =
      taffyConfig.alignContent as TaffyStyle["alignContent"];

  // Position
  if (style.position === "absolute" || style.position === "fixed") {
    result.position = "absolute";
  } else if (style.position === "relative") {
    result.position = "relative";
  }

  // Size + Min/Max + Padding + Border + Gap (공통 헬퍼)
  // Taffy 0.9 box model: style.size = border-box (padding+border 포함)
  // applyCommonTaffyStyle()이 size/padding/border/gap 처리 → padding 차감 금지
  applyCommonTaffyStyle(result as Record<string, unknown>, style, ctx);

  // Align self (block 자식도 flex 부모 안에 들어갈 수 있음)
  if (style.alignSelf) {
    result.alignSelf = style.alignSelf as TaffyStyle["alignSelf"];
  }

  // Justify self
  if (style.justifySelf) {
    result.justifySelf = style.justifySelf as TaffyStyle["justifySelf"];
  }

  // Margin — margin:auto는 parseMargin()이 숫자 전용이므로 원본 값을 직접 검사
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
  // Taffy 0.9는 Position::Relative와 Position::Absolute 모두에서 inset을 네이티브 처리
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
