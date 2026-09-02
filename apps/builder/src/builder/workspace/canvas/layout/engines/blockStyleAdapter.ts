/**
 * block 문맥 style 어댑터 — block 컨테이너 (display:block / flow-root) 와 그 자식의 style 을 엔진
 * 입력 `EngineStyle` 로 변환한다.
 *
 * 레이아웃 계산은 자체 Rust 엔진 `block.rs` (line box · blockify — ADR-923 Phase 5 부터 outer=inline
 * 자식은 엔진이 line item 으로 놓는다) 가 한다. 이 파일은 값 변환·정규화만 담당하며, display 는
 * `displayAdapter.ts` 가 넘긴 CSS 값을 그대로 싣는다 (종전 TS IFC 시뮬레이션은 삭제됐다).
 *
 * 이력: 2026-02-28 Block → Taffy Block 전환 (구 `TaffyBlockEngine.ts`) · ADR-916 Taffy 완전 제거 ·
 * ADR-923 Phase 5 시뮬레이션 삭제 (2026-09-02) · Phase 6 개명 (2026-09-03).
 */

import type { CanvasLayoutNode } from "../layoutNode";
import type { EngineStyle } from "../../wasm-bindings/layoutTypes";
import {
  parseMargin,
  applyCommonEngineStyle,
  parseCSSPropWithContext,
} from "./utils";
import type { CSSValueContext } from "./cssValueParser";
import type { EngineDisplayConfig } from "./displayAdapter";

// ─── margin:auto 판별 ────────────────────────────────────────────────

/**
 * margin shorthand/개별 속성에서 'auto' 값인 방향을 판별.
 *
 * parseMargin()은 숫자 전용(Margin = {top: number, ...})이므로 'auto'를 표현 불가.
 * 엔진의 margin:auto 네이티브 지원을 활용하기 위해 원본 값을 직접 검사한다.
 *
 * flexStyleAdapter의 동일한 헬퍼를 복사 — private이므로 재사용 불가.
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
 * Block 컨텍스트 자식 CanvasLayoutNode의 style을 EngineStyle로 변환
 *
 * flexStyleAdapter의 elementToEngineStyle()과 달리 flex 전용 속성(flex-flow,
 * flex shorthand, order 등)을 파싱하지 않습니다.
 * engineConfig 의 display 를 그대로 싣는다 (나머지 필드는 Phase 5 이후 채워지지 않는 자리 — `EngineDisplayConfig` 참조).
 *
 * @param element - 대상 CanvasLayoutNode
 * @param engineConfig - toEngineDisplay()의 반환값 (자식 노드용)
 * @param ctx - CSS 값 파싱 컨텍스트
 */
export function elementToEngineBlockStyle(
  element: CanvasLayoutNode,
  engineConfig: EngineDisplayConfig,
  ctx: CSSValueContext = {},
  computedFontSize?: number,
): EngineStyle {
  const style = (element.props?.style || {}) as Record<string, unknown>;
  const result: EngineStyle = {};

  // Display — displayAdapter 결과 적용
  result.display = engineConfig.engineDisplay;

  // EngineDisplayConfig 전체 필드 패스스루
  // inline-block 리프: flexGrow/flexShrink 고정 (크기 고정 아이템)
  if (engineConfig.flexGrow !== undefined)
    result.flexGrow = engineConfig.flexGrow;
  if (engineConfig.flexShrink !== undefined)
    result.flexShrink = engineConfig.flexShrink;
  // inline-block 부모 (flex row wrap 시뮬레이션): flexDirection/flexWrap/alignItems/alignContent
  if (engineConfig.flexDirection)
    result.flexDirection = engineConfig.flexDirection;
  if (engineConfig.flexWrap) result.flexWrap = engineConfig.flexWrap;
  if (engineConfig.alignItems)
    result.alignItems = engineConfig.alignItems as EngineStyle["alignItems"];
  if (engineConfig.alignContent)
    result.alignContent =
      engineConfig.alignContent as EngineStyle["alignContent"];

  // Position
  if (style.position === "absolute" || style.position === "fixed") {
    result.position = "absolute";
  } else if (style.position === "relative") {
    result.position = "relative";
  }

  // Size + Min/Max + Padding + Border + Gap (공통 헬퍼)
  // 엔진(Taffy 0.9 계보) box model: style.size = border-box (padding+border 포함)
  // applyCommonEngineStyle()이 size/padding/border/gap 처리 → padding 차감 금지
  applyCommonEngineStyle(result as Record<string, unknown>, style, ctx, computedFontSize);

  // Align self (block 자식도 flex 부모 안에 들어갈 수 있음)
  if (style.alignSelf) {
    result.alignSelf = style.alignSelf as EngineStyle["alignSelf"];
  }

  // Justify self
  if (style.justifySelf) {
    result.justifySelf = style.justifySelf as EngineStyle["justifySelf"];
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
  // 엔진(Taffy 0.9 계보)은 Position::Relative와 Position::Absolute 모두에서 inset을 네이티브 처리
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
