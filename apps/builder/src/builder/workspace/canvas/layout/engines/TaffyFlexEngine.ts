/**
 * Taffy 기반 Flexbox 레이아웃 엔진
 *
 * Yoga/@pixi/layout 위임 대신 Taffy WASM을 직접 호출하여
 * Flexbox 레이아웃을 계산합니다.
 *
 * Feature Flag(useTaffyFlex)가 활성화된 경우에만 사용됩니다.
 *
 * @since 2026-02-17 Phase 5 - Flex Yoga → Taffy 전환
 */

import type { CanvasLayoutNode } from "../layoutNode";
import type { ComputedLayout, LayoutContext } from "./LayoutEngine";
import { TaffyLayout } from "../../wasm-bindings/taffyLayout";
import type {
  TaffyStyle,
  TaffyNodeHandle,
} from "../../wasm-bindings/taffyLayout";
import { BaseTaffyEngine } from "./BaseTaffyEngine";
import {
  parseMargin,
  enrichWithIntrinsicSize,
  INLINE_BLOCK_TAGS,
  TEXT_LEAF_TAGS,
  parseCSSPropWithContext,
  applyCommonTaffyStyle,
  getPhantomIndicatorSpace,
} from "./utils";
import { resolveStyle } from "./cssResolver";
import type { ComputedStyle } from "./cssResolver";
import { FIT_CONTENT, MIN_CONTENT, MAX_CONTENT } from "./cssValueParser";
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
  _computedStyle?: ComputedStyle,
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
  applyCommonTaffyStyle(result as Record<string, unknown>, style, ctx);

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

// ─── TaffyFlexEngine ─────────────────────────────────────────────────

/**
 * Taffy Flex WASM 엔진 가용 여부
 *
 * selectEngine()에서 조기 라우팅 판단에 사용.
 */
export function isTaffyFlexAvailable(): boolean {
  const instance = TaffyFlexEngine.instance;
  if (!instance) return true; // 아직 생성 전이면 사용 가능으로 간주
  return instance.isAvailable();
}

/**
 * Taffy 기반 Flexbox 레이아웃 엔진
 *
 * Yoga 위임 대신 Taffy WASM으로 Flexbox 레이아웃을 직접 계산합니다.
 * BaseTaffyEngine의 인스턴스 관리, calculate() 스켈레톤, 결과 수집을 상속합니다.
 */
export class TaffyFlexEngine extends BaseTaffyEngine {
  static instance: TaffyFlexEngine | null = null;

  readonly displayTypes = ["flex", "inline-flex"];
  protected readonly engineName = "TaffyFlexEngine";

  constructor() {
    super();
    TaffyFlexEngine.instance = this;
  }

  protected computeWithTaffy(
    taffy: TaffyLayout,
    parent: CanvasLayoutNode,
    children: CanvasLayoutNode[],
    availableWidth: number,
    availableHeight: number,
    parentComputed: ComputedStyle,
    cssCtx: CSSValueContext = {},
    context?: LayoutContext,
  ): ComputedLayout[] {
    // §6 P3: 2-pass 레이아웃
    // 1차 pass: 부모 availableWidth로 enrichment → Taffy 계산
    // 2차 pass (조건부): inline-block 자식의 실제 Taffy 할당 width가
    //   enrichment 시 사용한 width와 다르면 → 정확한 width로 re-enrich → Taffy 재계산
    // 이는 flex row에서 자식 width가 flex-grow/shrink로 변경될 때 텍스트 wrap 높이를 교정

    // ── 자식별 computed style 캐시 (1차/2차 공용) ─────────────────────
    const childComputedStyles = children.map((child) => {
      const childRawStyle = child.props?.style as
        | Record<string, unknown>
        | undefined;
      return resolveStyle(childRawStyle, parentComputed);
    });

    // ── 1차 pass: enrichment + Taffy 계산 ─────────────────────────────
    // M1: enrichedChildren을 먼저 계산하여 2차 pass 판단에 사용
    const getChildElements = context?.getChildElements;
    const enrichedChildren = children.map((child, i) => {
      const childChildren = getChildElements?.(child.id);
      return enrichWithIntrinsicSize(
        child,
        availableWidth,
        availableHeight,
        childComputedStyles[i],
        childChildren,
        getChildElements,
        true,
      );
    });
    const firstPassResult = this._runTaffyPassRaw(
      taffy,
      parent,
      enrichedChildren,
      children,
      availableWidth,
      availableHeight,
      parentComputed,
      cssCtx,
    );

    // ── 2차 pass 필요성 판단 ──────────────────────────────────────────
    // inline-block 또는 text leaf 자식 중 height가 주입되고 실제 width가 enrichment width와 다른 경우
    let needsSecondPass = false;
    const WIDTH_TOLERANCE = 2; // 2px 이내 차이는 무시

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const type = (child.type ?? "").toLowerCase();
      if (!INLINE_BLOCK_TAGS.has(type) && !TEXT_LEAF_TAGS.has(type)) continue;

      const childStyle = child.props?.style as
        | Record<string, unknown>
        | undefined;
      const rawHeight = childStyle?.height;
      // RC-4: intrinsic 키워드 + sentinel 값 모두 auto height로 판정
      const hasAutoHeight =
        !rawHeight ||
        rawHeight === "auto" ||
        rawHeight === "fit-content" ||
        rawHeight === "min-content" ||
        rawHeight === "max-content" ||
        rawHeight === FIT_CONTENT ||
        rawHeight === MIN_CONTENT ||
        rawHeight === MAX_CONTENT;
      if (!hasAutoHeight) continue;

      const layout = firstPassResult.find((l) => l.elementId === child.id);
      if (!layout) continue;

      // M1: enrichment 시 주입된 width와 Taffy 실제 width 비교
      // 기존: availableWidth와 비교 → 명시적 width가 주입된 경우 잘못된 비교
      const enrichedStyle = enrichedChildren[i].props?.style as
        | Record<string, unknown>
        | undefined;
      const enrichedWidth =
        typeof enrichedStyle?.width === "number"
          ? enrichedStyle.width
          : availableWidth;
      if (Math.abs(layout.width - enrichedWidth) > WIDTH_TOLERANCE) {
        needsSecondPass = true;
        break;
      }
    }

    if (!needsSecondPass) {
      return firstPassResult;
    }

    // ── 2차 pass: 실제 Taffy width로 re-enrich ───────────────────────
    // 1차 pass 결과에서 각 자식의 실제 width를 가져와 availableWidth로 사용
    taffy.clear();
    const actualWidths = new Map<string, number>();
    for (const layout of firstPassResult) {
      actualWidths.set(layout.elementId, layout.width);
    }

    const secondPassChildren = children.map((child, i) => {
      const type = (child.type ?? "").toLowerCase();
      if (!INLINE_BLOCK_TAGS.has(type) && !TEXT_LEAF_TAGS.has(type))
        return child;

      const actualWidth = actualWidths.get(child.id);
      if (actualWidth === undefined) return child;

      const childChildren = getChildElements?.(child.id);
      return enrichWithIntrinsicSize(
        child,
        actualWidth,
        availableHeight,
        childComputedStyles[i],
        childChildren,
        getChildElements,
        true,
      );
    });

    return this._runTaffyPassRaw(
      taffy,
      parent,
      secondPassChildren,
      children,
      availableWidth,
      availableHeight,
      parentComputed,
      cssCtx,
    );
  }

  /**
   * Taffy pass 공통 로직: 노드 생성 → 계산 → 결과 수집
   *
   * @param enrichedChildren - enrichment 적용된 자식 (Taffy 스타일 변환용)
   * @param originalChildren - 원본 자식 (margin 파싱, elementId 매칭용)
   */
  private _runTaffyPassRaw(
    taffy: TaffyLayout,
    parent: CanvasLayoutNode,
    enrichedChildren: CanvasLayoutNode[],
    originalChildren: CanvasLayoutNode[],
    availableWidth: number,
    availableHeight: number,
    parentComputed: ComputedStyle,
    cssCtx: CSSValueContext = {},
  ): ComputedLayout[] {
    // CSS order: Taffy 0.9.2는 Style.order를 미지원하므로 TS 레이어에서 재정렬
    // stable sort로 같은 order 값의 요소는 원래 DOM 순서를 유지 (CSS spec)
    const getOrder = (el: CanvasLayoutNode): number => {
      const s = el.props?.style as Record<string, unknown> | undefined;
      const o = parseInt(String(s?.order ?? "0"), 10);
      return isNaN(o) ? 0 : o;
    };
    const needsSort = originalChildren.some((c) => getOrder(c) !== 0);
    let sortedEnriched = enrichedChildren;
    let sortedOriginal = originalChildren;
    if (needsSort) {
      const indices = enrichedChildren.map((_, i) => i);
      indices.sort(
        (a, b) => getOrder(originalChildren[a]) - getOrder(originalChildren[b]),
      );
      sortedEnriched = indices.map((i) => enrichedChildren[i]);
      sortedOriginal = indices.map((i) => originalChildren[i]);
    }

    // 부모 overflow 확인: non-visible이면 자식 flexShrink 기본값을 0으로 설정
    // CSS에서 overflow clipped 컨테이너(hidden/clip/scroll/auto)의 자식은 shrink 안 함
    const parentRawStyle = parent.props?.style as
      | Record<string, unknown>
      | undefined;
    const parentOverflow = (parentRawStyle?.overflow as string) ?? "visible";
    const parentOverflowX =
      (parentRawStyle?.overflowX as string) ?? parentOverflow;
    const parentOverflowY =
      (parentRawStyle?.overflowY as string) ?? parentOverflow;
    const isParentClippedX = parentOverflowX !== "visible";
    const isParentClippedY = parentOverflowY !== "visible";

    // 1. 자식 노드 생성
    const childHandles: TaffyNodeHandle[] = [];
    const childMap = new Map<TaffyNodeHandle, CanvasLayoutNode>();

    for (let i = 0; i < sortedEnriched.length; i++) {
      const enrichedChild = sortedEnriched[i];
      const originalChild = sortedOriginal[i];
      const childRawStyle = enrichedChild.props?.style as
        | Record<string, unknown>
        | undefined;
      const childComputed = resolveStyle(childRawStyle, parentComputed);
      const taffyStyle = elementToTaffyStyle(
        enrichedChild,
        childComputed,
        cssCtx,
      );

      // overflow clipped 부모의 자식은 명시적 flexShrink가 없으면 shrink 방지
      if (taffyStyle.flexShrink === undefined) {
        const isRow =
          !parentRawStyle?.flexDirection ||
          parentRawStyle.flexDirection === "row" ||
          parentRawStyle.flexDirection === "row-reverse";
        if ((isRow && isParentClippedX) || (!isRow && isParentClippedY)) {
          taffyStyle.flexShrink = 0;
        }
      }

      const handle = taffy.createNode(taffyStyle);
      childHandles.push(handle);
      childMap.set(handle, originalChild);
    }

    // 2. 부모 노드 생성 (자식 포함)
    const parentStyle = elementToTaffyStyle(parent, parentComputed, cssCtx);
    parentStyle.display = "flex";
    this.setupParentDimensions(parentStyle, availableWidth, availableHeight);

    // ── Phantom indicator: DOM에만 존재하는 indicator 요소의 레이아웃 공간 확보 ──
    // Switch/Checkbox/Radio: Preview DOM은 indicator + label 구조이지만
    // WebGL에서는 label 자식만 존재. Spec shapes(Skia)가 indicator를 그리지만
    // 레이아웃 트리에는 없으므로 phantom 노드로 공간을 예약한다.
    // childMap에 등록하지 않으므로 collectResults()에서 자동 스킵된다.
    const parentTag = (parent.type ?? "").toLowerCase();
    const isRowLayout =
      !parentStyle.flexDirection ||
      parentStyle.flexDirection === "row" ||
      parentStyle.flexDirection === "row-reverse";

    if (isRowLayout) {
      const parentProps = parent.props as Record<string, unknown> | undefined;
      const parentSize = (parentProps?.size as string) ?? "md";
      const indicatorSpace = getPhantomIndicatorSpace(parentTag, parentSize);
      if (indicatorSpace) {
        // CSS gap이 설정되면 Taffy가 gap을 적용하므로 phantom width에서 specGap 제거
        // gap 미설정 시 specGap이 포함된 width로 기존 동작 유지
        const parentStyle2 = parent.props?.style as
          | Record<string, unknown>
          | undefined;
        const hasCSSGap =
          parentStyle2?.gap !== undefined ||
          parentStyle2?.columnGap !== undefined;
        const phantomW = hasCSSGap
          ? indicatorSpace.width - (indicatorSpace.gap ?? 0)
          : indicatorSpace.width;
        const phantomStyle: TaffyStyle = {
          display: "flex",
          width: `${phantomW}px`,
          height: `${indicatorSpace.height}px`,
          flexShrink: 0,
        };
        const phantomHandle = taffy.createNode(phantomStyle);
        childHandles.unshift(phantomHandle);
      }
    }

    const rootHandle = taffy.createNodeWithChildren(parentStyle, childHandles);

    // 3. 레이아웃 계산
    taffy.computeLayout(rootHandle, availableWidth, availableHeight);

    // 4. 결과 수집
    return this.collectResults(taffy, childHandles, childMap);
  }
}
