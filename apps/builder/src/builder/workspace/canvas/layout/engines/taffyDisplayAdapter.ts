/**
 * CSS display 값 → Taffy 내부 표현 변환 레이어
 *
 * Presentation 레이어(style panel, CSS export, Preview)는 원본 CSS display 값을
 * 그대로 유지하고, Taffy 엔진 레이어에서만 이 모듈을 통해 내부 변환을 적용한다.
 *
 * 이 모듈은 Dropflow 오픈소스 원본(packages/layout-flow/)의 검증된
 * Display 타입 시스템을 기반으로, CSS Block Layout을 Taffy(Flexbox 엔진)에서
 * 시뮬레이션하기 위한 단일 소스이다.
 *
 * === CSS Display Level 3 기반 Display 이원 구조 ===
 *
 * Dropflow 원본의 Display = { outer: OuterDisplay, inner: InnerDisplay } 모델을 사용:
 * - outer: 요소의 외부 참여 방식 (inline | block | none)
 * - inner: 요소 내부의 formatting context (flow | flow-root | flex | grid | none)
 *
 * 이를 통해 blockification, inline-level 판별, BFC 생성 판단이
 * 타입 시스템 수준에서 정확히 보장된다.
 *
 * === Taffy 시뮬레이션 규칙 ===
 *
 * 1. display 변환 (parseDisplay → Display 객체 → Taffy 매핑):
 *    - inline-block {outer:inline, inner:flow-root} → block 리프 (크기 고정)
 *    - inline-block 자식을 가진 부모 → flex row wrap (inline flow 시뮬레이션)
 *    - block/flow-root {outer:block, inner:flow*} → block
 *    - inline {outer:inline, inner:flow} → block (Taffy는 inline 개념 없음)
 *    - flex/inline-flex {inner:flex} → flex
 *    - grid/inline-grid {inner:grid} → grid
 *    - none {outer:none} → none
 *
 * 2. CSS Blockification (CSS Display Level 3):
 *    - flex/grid 부모의 자식은 outer:inline → outer:block 으로 자동 변환
 *    - Dropflow Style.blockify() 패턴: outer만 변환, inner 유지
 *
 * 3. Block-level 자식 자동 폭:
 *    - CSS block container 내 block-level 자식은 부모 폭 100% 자동 확장
 *    - flex-row-wrap 시뮬레이션에서는 명시적 width:100% 필요
 *
 * 4. Vertical Alignment:
 *    - Button/Badge/Select 등 UI 컴포넌트 → vertical-align: middle (= alignItems: center)
 *    - 일반 요소 → vertical-align: baseline
 *
 * @see packages/layout-flow/src/types.ts — Display, OuterDisplay, InnerDisplay 타입
 * @see packages/layout-flow/src/style.ts — Style.blockify(), Style.display 기본값
 * @see packages/layout-flow/src/adapters/composition-adapter.ts — parseDisplay(), classifyChild()
 * @see packages/layout-flow/src/layout-box.ts — FormattingBox.isInlineLevel()
 * @see ADR-009 (docs/adr/009-full-tree-wasm-layout.md)
 * @since 2026-02-28
 */

import type { CanvasLayoutNode } from "../layoutNode";
import { INLINE_BLOCK_TAGS } from "./utils";

// ============================================
// CSS Display Level 3 타입 — Dropflow 원본 기반
// ============================================

/**
 * 요소의 외부 display 타입 (외부 참여 방식)
 *
 * CSS Display Level 3: "outer display type"
 * - 'inline': 부모의 inline formatting context에 참여
 * - 'block': 부모의 block formatting context에 참여
 * - 'none': 레이아웃에서 제외
 *
 * @see packages/layout-flow/src/types.ts:47 — OuterDisplay
 */
type OuterDisplay = "inline" | "block" | "none";

/**
 * 요소의 내부 display 타입 (내부 formatting context 종류)
 *
 * CSS Display Level 3: "inner display type"
 * - 'flow': normal flow (block formatting context 또는 inline formatting context)
 * - 'flow-root': 새로운 BFC 생성 (inline-block, overflow:hidden 등)
 * - 'flex': flex formatting context
 * - 'grid': grid formatting context
 * - 'none': 레이아웃에서 제외
 *
 * NOTE: Dropflow 원본은 'flow'/'flow-root'/'none'만 지원 (block-only 엔진).
 * Taffy adapter는 flex/grid도 처리해야 하므로 확장.
 *
 * @see packages/layout-flow/src/types.ts:48 — InnerDisplay
 */
type InnerDisplay = "flow" | "flow-root" | "flex" | "grid" | "none";

/**
 * CSS Display Level 3 이원 display 구조
 *
 * CSS 명세의 two-value display syntax를 정확히 반영:
 * - display: block       → { outer: 'block',  inner: 'flow' }
 * - display: inline      → { outer: 'inline', inner: 'flow' }
 * - display: inline-block → { outer: 'inline', inner: 'flow-root' }
 * - display: flex        → { outer: 'block',  inner: 'flex' }
 * - display: inline-flex → { outer: 'inline', inner: 'flex' }
 *
 * @see packages/layout-flow/src/types.ts:49 — Display
 * @see https://www.w3.org/TR/css-display-3/#the-display-properties
 */
type Display = { outer: OuterDisplay; inner: InnerDisplay };

/**
 * 자식 요소의 display 분류
 *
 * Dropflow 원본의 classifyChild() (composition-adapter.ts:394-414)에서
 * 'replaced' 제외 (Taffy adapter에서는 태그 정보 없이 display 문자열만 사용).
 *
 * @see packages/layout-flow/src/adapters/composition-adapter.ts:394 — ChildDisplayClass
 */
type ChildDisplayClass = "block" | "inline" | "none";

// ============================================
// Taffy 변환 결과 타입
// ============================================

/**
 * Taffy 엔진에 전달하는 display 설정
 *
 * taffyDisplay는 Taffy가 이해하는 display 모드이며,
 * 나머지 필드는 부모-자식 관계에 따라 주입되는 암묵적 flex 속성이다.
 */
export interface TaffyDisplayConfig {
  /** Taffy 내부 display 모드 */
  taffyDisplay: "flex" | "block" | "grid" | "none";
  /** flex 방향 (taffyDisplay === 'flex'일 때 유효) */
  flexDirection?: "row" | "column";
  /** flex 줄바꿈 (taffyDisplay === 'flex'일 때 유효) */
  flexWrap?: "nowrap" | "wrap";
  /** 교차축 정렬 (taffyDisplay === 'flex'일 때 유효) */
  alignItems?: string;
  /** flex line 정렬 (taffyDisplay === 'flex' + flexWrap일 때 유효) */
  alignContent?: string;
  /** flex 확장 비율 (inline-block 리프 고정 크기용) */
  flexGrow?: number;
  /** flex 축소 비율 (inline-block 리프 고정 크기용) */
  flexShrink?: number;
}

// ============================================
// 상수
// ============================================

/**
 * composition UI 컴포넌트 중 vertical-align: middle이 기본인 태그.
 *
 * CSS/React Aria에서 설정됨 (Button.css, ToggleButton.css 등).
 * 브라우저 UA stylesheet에서도 button/input 계열은 middle이 기본.
 *
 * NOTE: Dropflow 원본은 DOM 기반이라 UA stylesheet에서 처리.
 * composition는 prop 기반 컴포넌트이므로 태그 목록으로 관리.
 */
export const VERTICAL_ALIGN_MIDDLE_TAGS: ReadonlySet<string> = new Set([
  "button",
  "submitbutton",
  "fancybutton",
  "togglebutton",
  "checkbox",
  "radio",
  "switch",
  "togglebuttongroup",
  "badge",
  "type",
  "chip",
  "textfield",
  "numberfield",
  "searchfield",
  "select",
  "combobox",
  "colorpicker",
  "datepicker",
  "daterangepicker",
  "slider",
]);

// ============================================
// Taffy 변환 결과 상수
// ============================================

/** block 폴백 결과 (미인식 display 값 및 inline → block) */
const BLOCK_FALLBACK: TaffyDisplayConfig = { taffyDisplay: "block" };

// ============================================
// 내부 헬퍼
// ============================================

/**
 * inline-block 자식들의 vertical-align 값을 기반으로
 * 부모 flex row wrap의 alignItems 값을 동적으로 결정한다.
 *
 * ADR-006 P2-3: vertical-align이 명시된 자식이 없으면 기존 'center'를 유지하여
 * 하위 호환성을 보장한다. 명시된 자식이 있으면 첫 번째 값을 사용한다.
 *
 * CSS vertical-align → Flexbox alignItems 매핑:
 * - top    → 'flex-start'
 * - middle → 'center'
 * - bottom → 'flex-end'
 * - baseline → 'baseline'
 *
 * @param childElements - 직계 자식 CanvasLayoutNode 배열
 * @returns Taffy alignItems 값 (기본값: 'center')
 */
function resolveInlineBlockAlignItems(
  childElements: CanvasLayoutNode[],
): string {
  const map: Record<string, string> = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end",
    baseline: "baseline",
  };

  const explicitAligns = childElements
    .map(
      (el) =>
        (el.props?.style as Record<string, unknown> | undefined)
          ?.verticalAlign as string | undefined,
    )
    .filter((va): va is string => va !== undefined && va !== "");

  // 하위 호환성: vertical-align을 명시한 자식이 없으면 기존 'center' 유지
  if (explicitAligns.length === 0) return "center";

  return map[explicitAligns[0]] ?? "center";
}

/**
 * inline-block 자식을 가진 block 부모가 사용하는 flex row wrap 설정.
 *
 * CSS inline formatting context를 Taffy flex로 시뮬레이션:
 * - flexDirection: 'row' — 가로 배치
 * - flexWrap: 'wrap' — 줄바꿈
 * - alignItems: 'center' — VERTICAL_ALIGN_MIDDLE_TAGS 대다수가 middle (동적 오버라이드 가능)
 * - alignContent: 'flex-start' — CSS line box는 상단부터 쌓임 (Taffy 기본 stretch 방지)
 */
const INLINE_BLOCK_PARENT_CONFIG: TaffyDisplayConfig = {
  taffyDisplay: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  alignContent: "flex-start",
};

/** inline-block 자신이 사용하는 크기 고정 block 리프 설정 */
const INLINE_BLOCK_LEAF_CONFIG: TaffyDisplayConfig = {
  taffyDisplay: "block",
  flexGrow: 0,
  flexShrink: 0,
};

// ============================================
// Dropflow 원본 기반 — 내부 함수
// ============================================

/**
 * CSS display 문자열을 Display 이원 구조로 파싱.
 *
 * Dropflow 원본 (composition-adapter.ts:313-330)을 기반으로 하되,
 * Taffy가 처리하는 flex/grid를 inner display로 확장.
 *
 * CSS Display Level 3 매핑:
 * - block        → { outer: 'block',  inner: 'flow' }
 * - inline       → { outer: 'inline', inner: 'flow' }
 * - inline-block → { outer: 'inline', inner: 'flow-root' }
 * - flow-root    → { outer: 'block',  inner: 'flow-root' }
 * - flex         → { outer: 'block',  inner: 'flex' }
 * - inline-flex  → { outer: 'inline', inner: 'flex' }
 * - grid         → { outer: 'block',  inner: 'grid' }
 * - inline-grid  → { outer: 'inline', inner: 'grid' }
 * - none         → { outer: 'none',   inner: 'none' }
 *
 * @see packages/layout-flow/src/adapters/composition-adapter.ts:313 — parseDisplay()
 * @see https://www.w3.org/TR/css-display-3/#the-display-properties
 */
function parseDisplay(value: string | undefined): Display {
  switch (value?.trim().toLowerCase()) {
    case "block":
      return { outer: "block", inner: "flow" };
    case "inline":
      return { outer: "inline", inner: "flow" };
    case "inline-block":
      return { outer: "inline", inner: "flow-root" };
    case "flow-root":
      return { outer: "block", inner: "flow-root" };
    case "flex":
      return { outer: "block", inner: "flex" };
    case "inline-flex":
      return { outer: "inline", inner: "flex" };
    case "grid":
      return { outer: "block", inner: "grid" };
    case "inline-grid":
      return { outer: "inline", inner: "grid" };
    case "none":
      return { outer: "none", inner: "none" };
    default:
      if (import.meta.env.DEV) {
        console.warn(
          `[taffyDisplayAdapter] Unrecognized CSS display value: "${value}". Falling back to block.`,
        );
      }
      return { outer: "block", inner: "flow" };
  }
}

/**
 * Display 이원 구조를 CSS display 문자열로 역변환.
 *
 * parseDisplay()의 역함수. blockifyDisplay() 등에서
 * Display 객체를 조작한 후 문자열로 반환할 때 사용.
 */
function displayToString(d: Display): string {
  if (d.outer === "none") return "none";
  if (d.inner === "flex") return d.outer === "inline" ? "inline-flex" : "flex";
  if (d.inner === "grid") return d.outer === "inline" ? "inline-grid" : "grid";
  if (d.inner === "flow-root")
    return d.outer === "inline" ? "inline-block" : "flow-root";
  // inner === 'flow'
  return d.outer === "inline" ? "inline" : "block";
}

/**
 * 자식 display 분류 — Dropflow classifyChild() 패턴.
 *
 * Dropflow 원본 (composition-adapter.ts:400-414):
 * - display === 'none'                          → 'none'
 * - display === 'inline' || 'inline-block'      → 'inline'
 * - display === 'block' / 'flex' / 'grid' / ... → 'block'
 *
 * inline-flex/inline-grid는 Taffy가 flex/grid로 네이티브 처리하므로
 * Dropflow 원본과 동일하게 'block'으로 분류한다.
 * (IFC 시뮬레이션이 아닌 Taffy native flex/grid 경로를 타야 함)
 *
 * @see packages/layout-flow/src/adapters/composition-adapter.ts:400 — classifyChild()
 */
function classifyChildDisplay(display: string): ChildDisplayClass {
  const parsed = parseDisplay(display);
  if (parsed.outer === "none") return "none";
  // Dropflow 원본 패턴: inline/inline-block만 inline 분류
  // inner가 flow 또는 flow-root인 경우만 IFC 참여 대상
  // inline-flex(inner:flex), inline-grid(inner:grid)는 block 분류
  if (
    parsed.outer === "inline" &&
    (parsed.inner === "flow" || parsed.inner === "flow-root")
  ) {
    return "inline";
  }
  return "block";
}

// ============================================
// 공개 함수
// ============================================

/**
 * CSS Display Level 3 Blockification 규칙.
 *
 * Dropflow 원본 Style.blockify() (style.ts:268-272) 패턴:
 * outer display만 block으로 변환하고, inner display는 유지.
 *
 * - { outer: 'inline', inner: 'flow' }       → 'block'       (inline → block)
 * - { outer: 'inline', inner: 'flow-root' }  → 'flow-root'   (inline-block → flow-root)
 * - { outer: 'inline', inner: 'flex' }       → 'flex'        (inline-flex → flex)
 * - { outer: 'inline', inner: 'grid' }       → 'grid'        (inline-grid → grid)
 * - { outer: 'block', ... }                  → 변경 없음
 *
 * NOTE: inline-block → 'flow-root' (CSS 명세 정확). Taffy 컨텍스트에서
 * toTaffyDisplay('flow-root', ...) → BLOCK_FALLBACK이므로
 * toTaffyDisplay('block', ...)과 동일한 Taffy 결과를 생성한다.
 *
 * 공개 인터페이스: CSS display 문자열 → CSS display 문자열 (호출부 호환)
 *
 * @see packages/layout-flow/src/style.ts:268 — Style.blockify()
 * @see https://www.w3.org/TR/css-display-3/#blockification
 */
export function blockifyDisplay(display: string): string {
  const parsed = parseDisplay(display);
  if (parsed.outer === "inline") {
    return displayToString({ outer: "block", inner: parsed.inner });
  }
  return display;
}

/**
 * 요소의 CSS display 기본값 결정.
 *
 * 우선순위:
 * 1. 명시적 display가 있으면 그대로 반환
 * 2. INLINE_BLOCK_TAGS(Button, Badge 등)는 기본 'inline-block'
 * 3. 그 외는 기본 'block'
 *
 * 반환값은 CSS display 문자열이며, parseDisplay()로 변환하여
 * Display 이원 구조로 해석할 수 있다.
 *
 * @see utils.ts — INLINE_BLOCK_TAGS
 */
export function getElementDisplay(element: {
  type?: string;
  props?: { style?: unknown };
}): string {
  const style = (element.props?.style ?? {}) as Record<string, unknown>;
  if (typeof style.display === "string" && style.display.length > 0) {
    return style.display;
  }
  const type = (element.type ?? "").toLowerCase();
  if (INLINE_BLOCK_TAGS.has(type)) {
    return "inline-block";
  }
  return "block";
}

/**
 * display 값이 inline-level인지 판별.
 *
 * Dropflow 원본 패턴: display.outer === 'inline'
 * CSS 명세: inline-level box는 outer display type이 inline인 box.
 *
 * @see packages/layout-flow/src/layout-box.ts:523 — FormattingBox.isInlineLevel()
 */
export function isInlineLevel(display: string): boolean {
  return parseDisplay(display).outer === "inline";
}

/**
 * flex-row-wrap 부모(inline-block 시뮬레이션) 안의 block-level 자식이
 * width:100%를 받아야 하는지 판별.
 *
 * CSS 명세: block container 내 block-level 자식은 자동으로 부모 폭 100%.
 * Taffy flex에서는 자식이 intrinsic 크기로 축소되므로 명시적 width 필요.
 *
 * 조건:
 * - 자식 display가 inline-level이 아님 (block, flex, grid 등)
 * - 자식에 명시적 width가 없거나 'auto'
 */
export function needsBlockChildFullWidth(
  childDisplay: string,
  childWidth: unknown,
): boolean {
  if (isInlineLevel(childDisplay)) return false;
  if (childWidth != null && childWidth !== "auto") return false;
  return true;
}

/**
 * CSS display 값을 Taffy 엔진 내부 표현으로 변환한다.
 *
 * Display 이원 구조(parseDisplay)를 기반으로 변환:
 * - inner로 Taffy native 모드 판별 (flex, grid)
 * - outer로 inline-level 여부 판별 (inline-block 리프, 순수 inline)
 * - 자식 분류(classifyChildDisplay)로 부모 IFC 시뮬레이션 판별
 *
 * @param display - 요소의 CSS display 값 (e.g. 'block', 'flex', 'inline-block')
 * @param childDisplays - 직계 자식 요소들의 CSS display 값 배열
 * @param childElements - 직계 자식 CanvasLayoutNode 배열 (optional). 전달 시 vertical-align 기반
 *                        alignItems 동적 결정에 사용된다. (ADR-006 P2-3)
 * @returns Taffy 엔진에 전달할 TaffyDisplayConfig
 *
 * @example
 * // inline-block 자신 → block 리프
 * toTaffyDisplay('inline-block', [])
 * // { taffyDisplay: 'block', flexGrow: 0, flexShrink: 0 }
 *
 * @example
 * // block 부모 + inline-block 자식 → flex row wrap
 * toTaffyDisplay('block', ['inline-block', 'inline-block'])
 * // { taffyDisplay: 'flex', flexDirection: 'row', flexWrap: 'wrap', ... }
 *
 * @example
 * // flex 컨테이너
 * toTaffyDisplay('flex', ['block', 'block'])
 * // { taffyDisplay: 'flex' }
 */
export function toTaffyDisplay(
  display: string,
  childDisplays: string[],
  childElements?: CanvasLayoutNode[],
): TaffyDisplayConfig {
  const parsed = parseDisplay(display);

  // none → none
  if (parsed.outer === "none") {
    return { taffyDisplay: "none" };
  }

  // flex/grid (native) — inner 값 그대로 사용, outer 무관 (inline-flex/inline-grid 포함)
  if (parsed.inner === "flex" || parsed.inner === "grid") {
    return { taffyDisplay: parsed.inner };
  }

  // inline-block (outer=inline, inner=flow-root) → 크기 고정 block 리프
  // 부모가 flex row wrap으로 전환된 컨테이너 안에 들어감
  if (parsed.outer === "inline" && parsed.inner === "flow-root") {
    return INLINE_BLOCK_LEAF_CONFIG;
  }

  // 순수 inline (outer=inline, inner=flow) → block 폴백
  // Taffy는 inline formatting context를 지원하지 않으므로 block으로 격상
  if (parsed.outer === "inline") {
    return BLOCK_FALLBACK;
  }

  // block 부모 + inline-level 자식 → flex row wrap으로 IFC 시뮬레이션
  // classifyChildDisplay()로 Dropflow classifyChild() 패턴 적용
  if (childDisplays.some((cd) => classifyChildDisplay(cd) === "inline")) {
    // ADR-006 P2-3: vertical-align 명시 자식이 있으면 alignItems를 동적으로 결정
    if (childElements !== undefined && childElements.length > 0) {
      const alignItems = resolveInlineBlockAlignItems(childElements);
      if (alignItems !== INLINE_BLOCK_PARENT_CONFIG.alignItems) {
        return { ...INLINE_BLOCK_PARENT_CONFIG, alignItems };
      }
    }
    return INLINE_BLOCK_PARENT_CONFIG;
  }

  // block / flow-root → block
  return BLOCK_FALLBACK;
}
