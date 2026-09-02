/**
 * CSS display 값 → 엔진 경계 운반 레이어 (ADR-923 Phase 5 cutover, 2026-09-02)
 *
 * Presentation 레이어(style panel, CSS export, Preview)는 원본 CSS display 값을 그대로
 * 유지하고, 레이아웃 파이프라인은 이 모듈을 거쳐 그 값을 **손실 없이** 엔진 경계
 * (`buildTreeBatch`) 로 보낸다. display 의 해석 — outer(line item)/inner(solver)/flex·grid
 * 자식 blockify — 은 엔진 `display.rs`·`tree.rs`·`block.rs` 소유다. 이 모듈은 더 이상
 * CSS Block Layout 을 flex 엔진에서 시뮬레이션하지 않는다 (종전 단일 소스 역할은 삭제됐다).
 *
 * === CSS Display Level 3 기반 Display 이원 구조 ===
 *
 * `parseDisplay` / `displayToString` 은 Dropflow 원본(packages/layout-flow/) 의
 * Display = { outer: OuterDisplay, inner: InnerDisplay } 모델을 쓴다:
 * - outer: 요소의 외부 참여 방식 (inline | block | none)
 * - inner: 요소 내부의 formatting context (flow | flow-root | flex | grid | none)
 *
 * 이 파일의 이원 구조는 `normalizeCssDisplay` (운반 union 정규화) 와 패널·게이트의 outer/inner
 * 판독에만 쓰인다 — 엔진은 같은 모델의 Rust 판 (`display.rs`) 을 자체 소비한다.
 *
 * === 번역 규칙 (ADR-923 Phase 5 cutover, 2026-09-02) ===
 *
 * TS 는 CSS display 값을 **그대로** 엔진 경계(`buildTreeBatch`)로 보낸다 — outer/inner 해석은
 * 엔진 `display.rs` 가 맡는다 (outer=inline 은 block 부모의 line item, inner 는 solver 선택,
 * flex/grid 자식의 blockify 는 `tree.rs`). 종전의 TS IFC 시뮬레이션 — block 부모 + inline-level
 * 자식 → flex row wrap 합성, inline-block → 크기 고정 block 리프, block 형제 width:100% 보정,
 * vertical-align → alignItems 근사, TS blockify, inline-flex → flex 정규화 — 는 전부 삭제됐다
 * (ADR-923 breakdown §2.2 S1·S2·S3·S6·S9).
 *
 * 1. `normalizeCssDisplay(raw)`: 인식되는 CSS 값을 운반 union `TaffyDisplay` 로 — 손실 없는
 *    정규화 (inline-* 보존). 미인식 값만 `block` 폴백 (엔진 `parse_display` 의 폴백과 같다).
 * 2. `getElementDisplay(element)`: 명시 `style.display` 우선, 없으면 `resolveDefaultDisplay(type)`
 *    (catalog 파생 → 손 목록 → block, `defaultDisplay.ts`).
 * 3. `toTaffyDisplay(display, childDisplays)`: `{ taffyDisplay: normalizeCssDisplay(display) }` —
 *    부모는 자식 display 와 무관하게 자기 값만 보낸다. `childDisplays` 는 HC1 게이트
 *    (`tests/parity/adr923Hc1ChildDisplay`) 가 "부모가 본 자식 값 == 자식이 보낸 값" 을 대조하는
 *    관측 인자다.
 *
 * @see packages/layout-flow/src/types.ts — Display, OuterDisplay, InnerDisplay 타입
 * @see packages/layout-flow/src/style.ts — Style.blockify(), Style.display 기본값
 * @see packages/layout-flow/src/adapters/composition-adapter.ts — parseDisplay(), classifyChild()
 * @see ADR-009 (docs/adr/009-full-tree-wasm-layout.md)
 * @since 2026-02-28
 */

import type { TaffyDisplay } from "../../wasm-bindings/layoutTypes";
import { resolveDefaultDisplay } from "./defaultDisplay";

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

// ============================================
// Taffy 변환 결과 타입
// ============================================

/**
 * 엔진에 전달하는 display 설정.
 *
 * `taffyDisplay` 는 **CSS display 값 그대로** (`TaffyDisplay` 운반 union, ADR-923 Phase 5).
 * 나머지 필드는 종전 IFC 시뮬레이션이 주입하던 암묵 flex 속성 자리 — Phase 5 이후 어느 경로도
 * 채우지 않는다 (`elementToTaffyBlockStyle` 패스스루 계약만 유지, 명명 정리는 Phase 6).
 */
export interface TaffyDisplayConfig {
  /** 엔진 경계로 보내는 CSS display 값 */
  taffyDisplay: TaffyDisplay;
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
 * CSS display 문자열 → 운반 union `TaffyDisplay` (손실 없는 정규화, ADR-923 Phase 5).
 *
 * `parseDisplay` 로 outer/inner 를 읽고 CSS 문자열로 되돌린다 — 인식되는 값은 그대로
 * (inline-flex · inline-grid · inline-block · inline 보존), `flow-root` 는 `block` (엔진 solver 는
 * 둘 다 Block), 미인식 값은 `block` 폴백 (엔진 `parse_display` 와 같다). outer 해석은 엔진 몫이다.
 */
export function normalizeCssDisplay(raw: string | undefined): TaffyDisplay {
  const d = parseDisplay(raw);
  if (d.outer === "none") return "none";
  const inline = d.outer === "inline";
  switch (d.inner) {
    case "flex":
      return inline ? "inline-flex" : "flex";
    case "grid":
      return inline ? "inline-grid" : "grid";
    case "flow-root":
      return inline ? "inline-block" : "block";
    default:
      return inline ? "inline" : "block";
  }
}

/**
 * 요소의 CSS display 기본값 결정.
 *
 * 1. 명시적 `style.display` 가 있으면 그대로
 * 2. 없으면 `resolveDefaultDisplay(type)` — catalog(`containerStyles.display`) 파생 → 파생 원천
 *    없는 손 목록(`INLINE_BLOCK_TAG_CLASSIFICATION` hand) → `block` (ADR-923 Phase 5 배선;
 *    종전 `INLINE_BLOCK_TAGS → inline-block` 목록은 삭제됐다).
 *
 * 반환값은 CSS display 문자열이다 — 부모가 자식을 볼 때와 자식이 자기 batch 를 만들 때 같은
 * 함수를 쓰므로 두 시각이 갈리지 않는다 (HC1).
 */
export function getElementDisplay(element: {
  type?: string;
  props?: { style?: unknown };
}): string {
  const style = (element.props?.style ?? {}) as Record<string, unknown>;
  if (typeof style.display === "string" && style.display.length > 0) {
    return style.display;
  }
  return resolveDefaultDisplay(element.type);
}

/**
 * CSS display 값을 엔진 경계 설정으로 변환한다 — 값을 그대로 운반한다 (ADR-923 Phase 5).
 *
 * 종전에는 block 부모가 inline-level 자식을 보면 flex row wrap 으로 IFC 를 시뮬레이션하고
 * inline-block 자신은 크기 고정 block 리프로 바꿨다. 지금은 부모도 자식도 자기 CSS 값만 보내고,
 * block 부모 안의 inline-level 자식 배치(line box)는 엔진 `block.rs` 가 맡는다.
 *
 * @param display - 요소의 CSS display 값
 * @param _childDisplays - 직계 자식의 CSS display 값 (관측 전용 — HC1 게이트가 module mock 으로
 *   "부모가 본 자식 값 == 자식 batch display" 를 대조한다; 변환에는 쓰지 않는다)
 */
export function toTaffyDisplay(
  display: string,
  _childDisplays: readonly string[],
): TaffyDisplayConfig {
  return { taffyDisplay: normalizeCssDisplay(display) };
}
