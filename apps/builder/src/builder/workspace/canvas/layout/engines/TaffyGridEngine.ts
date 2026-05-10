/**
 * Taffy 기반 CSS Grid 레이아웃 엔진
 *
 * 기존 GridEngine의 커스텀 JS 구현 대신 Taffy WASM의 네이티브 Grid 지원을 사용합니다.
 * Feature Flag(taffyGrid)가 활성화된 경우에만 사용됩니다.
 *
 * CSS Grid 속성 → TaffyStyle 변환 포함:
 * - gridTemplateColumns / gridTemplateRows (트랙 배열)
 * - gridAutoFlow, gridAutoColumns, gridAutoRows
 * - gridColumn / gridRow (line 기반 배치: "1 / 3", "span 2")
 * - gridArea (숫자 기반 shorthand: "row-start / col-start / row-end / col-end")
 * - gap / rowGap / columnGap
 * - justifyContent / justifyItems / alignItems / alignContent
 * - justifySelf / alignSelf (아이템)
 *
 * @since 2026-02-17 Phase 6 - Grid → Taffy Grid 통합
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
  parseCSSPropWithContext,
  applyCommonTaffyStyle,
} from "./utils";
import { resolveStyle } from "./cssResolver";
import type { ComputedStyle } from "./cssResolver";
import type { CSSValueContext } from "./cssValueParser";

// ─── CSS 파싱 유틸리티 ────────────────────────────────────────────────

/**
 * CSS grid-template 문자열을 트랙 토큰 배열로 파싱
 *
 * Phase 4-3: repeat() 전개는 Rust 브릿지(GridTemplateComponent::Repeat)에서 처리.
 * TS는 최상위 토큰 분리만 수행하며, repeat() 토큰은 그대로 전달.
 *
 * 예) "1fr 1fr 1fr" → ["1fr", "1fr", "1fr"]
 *     "200px auto 1fr" → ["200px", "auto", "1fr"]
 *     "repeat(3, 1fr)" → ["repeat(3, 1fr)"]
 *     "minmax(100px, 1fr) 200px" → ["minmax(100px, 1fr)", "200px"]
 *     "repeat(auto-fill, minmax(200px, 1fr)) 100px" → ["repeat(auto-fill, minmax(200px, 1fr))", "100px"]
 */
export function parseGridTemplate(template: string | undefined): string[] {
  if (!template || template.trim() === "") return [];

  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  const s = template.trim();

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === " " && depth === 0) {
      const t = current.trim();
      if (t) tokens.push(t);
      current = "";
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) tokens.push(last);

  return tokens;
}

/**
 * CSS grid-column / grid-row 단축 속성을 start/end로 분리합니다.
 *
 * 예) "1 / 3" → { start: "1", end: "3" }
 *     "span 2" → { start: "span 2", end: "auto" }
 *     "2" → { start: "2", end: "auto" }
 *     "1 / span 2" → { start: "1", end: "span 2" }
 */
function parseGridLineShorthand(value: string): { start: string; end: string } {
  const trimmed = value.trim();
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx !== -1) {
    return {
      start: trimmed.slice(0, slashIdx).trim(),
      end: trimmed.slice(slashIdx + 1).trim(),
    };
  }
  return { start: trimmed, end: "auto" };
}

/**
 * CSS grid-area 단축 속성을 row-start / col-start / row-end / col-end로 분리합니다.
 *
 * 지원 형식:
 * - "1 / 2 / 3 / 4" (숫자 기반)
 * - "header" (이름 기반 — templateAreas에서 해석)
 */
function parseGridAreaShorthand(
  value: string,
  templateAreas?: TemplateAreasMap,
): {
  rowStart: string;
  colStart: string;
  rowEnd: string;
  colEnd: string;
} | null {
  if (value.includes("/")) {
    const parts = value.split("/").map((s) => s.trim());
    if (parts.length === 4) {
      return {
        rowStart: parts[0],
        colStart: parts[1],
        rowEnd: parts[2],
        colEnd: parts[3],
      };
    }
    return null;
  }

  // 이름 기반 영역: templateAreas에서 찾아서 숫자로 변환
  if (templateAreas) {
    const area = templateAreas.get(value);
    if (area) {
      return {
        rowStart: String(area.rowStart),
        colStart: String(area.colStart),
        rowEnd: String(area.rowEnd),
        colEnd: String(area.colEnd),
      };
    }
  }

  return null;
}

/** grid-template-areas 파싱 결과 타입 */
type TemplateAreasMap = Map<
  string,
  {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  }
>;

/**
 * CSS grid-template-areas 문자열을 파싱하여 영역 맵 생성
 *
 * 입력: '"header header" "sidebar main" "footer footer"'
 * 출력: Map { "header" => {rowStart:1, rowEnd:2, colStart:1, colEnd:3}, ... }
 */
function parseGridTemplateAreas(
  template: string | undefined,
): TemplateAreasMap | undefined {
  if (!template) return undefined;

  const areas: TemplateAreasMap = new Map();
  const rows = template.match(/"[^"]+"/g);
  if (!rows) return undefined;

  rows.forEach((row, rowIndex) => {
    const cells = row.replace(/"/g, "").trim().split(/\s+/);
    cells.forEach((cellName, colIndex) => {
      if (cellName === ".") return;

      const existing = areas.get(cellName);
      if (existing) {
        existing.rowEnd = Math.max(existing.rowEnd, rowIndex + 2);
        existing.colEnd = Math.max(existing.colEnd, colIndex + 2);
      } else {
        areas.set(cellName, {
          rowStart: rowIndex + 1,
          rowEnd: rowIndex + 2,
          colStart: colIndex + 1,
          colEnd: colIndex + 2,
        });
      }
    });
  });

  return areas.size > 0 ? areas : undefined;
}

// ─── Style 변환 ────────────────────────────────────────────────────────

/**
 * CanvasLayoutNode의 CSS Grid 스타일을 TaffyStyle로 변환합니다.
 *
 * 컨테이너 속성(display, gridTemplate*, gap 등)과
 * 아이템 속성(gridColumn, gridRow, gridArea, alignSelf 등)을 모두 변환합니다.
 */
export function elementToTaffyGridStyle(
  element: CanvasLayoutNode,
  _computedStyle?: ComputedStyle,
  templateAreas?: TemplateAreasMap,
  ctx: CSSValueContext = {},
): TaffyStyle {
  const style = (element.props?.style || {}) as Record<string, unknown>;
  const result: TaffyStyle = {};

  // --- Display ---
  const display = style.display as string | undefined;
  if (display === "grid" || display === "inline-grid") {
    result.display = "grid";
  } else if (display === "none") {
    result.display = "none";
  } else {
    result.display = "grid";
  }

  // --- Position ---
  if (style.position === "absolute" || style.position === "fixed") {
    result.position = "absolute";
  }

  // Size + Min/Max + Padding + Border + Gap (공통 헬퍼)
  applyCommonTaffyStyle(result as Record<string, unknown>, style, ctx);

  // --- Grid container: 트랙 정의 ---
  const gridTemplateColumns = style.gridTemplateColumns as string | undefined;
  const gridTemplateRows = style.gridTemplateRows as string | undefined;
  const gridAutoColumns = style.gridAutoColumns as string | undefined;
  const gridAutoRows = style.gridAutoRows as string | undefined;

  const colTracks = parseGridTemplate(gridTemplateColumns);
  const rowTracks = parseGridTemplate(gridTemplateRows);
  const autoColTracks = parseGridTemplate(gridAutoColumns);
  const autoRowTracks = parseGridTemplate(gridAutoRows);

  if (colTracks.length > 0) result.gridTemplateColumns = colTracks;
  if (rowTracks.length > 0) result.gridTemplateRows = rowTracks;
  if (autoColTracks.length > 0) result.gridAutoColumns = autoColTracks;
  if (autoRowTracks.length > 0) result.gridAutoRows = autoRowTracks;

  // --- Grid container: auto-flow ---
  const gridAutoFlow = style.gridAutoFlow as string | undefined;
  if (gridAutoFlow) {
    result.gridAutoFlow = gridAutoFlow as TaffyStyle["gridAutoFlow"];
  }

  // --- Grid container: 정렬 ---
  // place-items shorthand 파싱: "align-items justify-items" 또는 단일값
  // 개별 속성(alignItems, justifyItems)이 이미 설정되어 있으면 shorthand보다 우선합니다.
  let resolvedAlignItems = style.alignItems as string | undefined;
  let resolvedJustifyItems = style.justifyItems as string | undefined;
  if (style.placeItems) {
    const parts = String(style.placeItems).split(/\s+/);
    resolvedAlignItems = resolvedAlignItems ?? parts[0];
    resolvedJustifyItems = resolvedJustifyItems ?? parts[1] ?? parts[0];
  }

  // place-content shorthand 파싱: "align-content justify-content" 또는 단일값
  // 개별 속성(alignContent, justifyContent)이 이미 설정되어 있으면 shorthand보다 우선합니다.
  let resolvedAlignContent = style.alignContent as string | undefined;
  let resolvedJustifyContent = style.justifyContent as string | undefined;
  if (style.placeContent) {
    const parts = String(style.placeContent).split(/\s+/);
    resolvedAlignContent = resolvedAlignContent ?? parts[0];
    resolvedJustifyContent = resolvedJustifyContent ?? parts[1] ?? parts[0];
  }

  if (resolvedJustifyContent) {
    result.justifyContent =
      resolvedJustifyContent as TaffyStyle["justifyContent"];
  }
  if (resolvedJustifyItems) {
    result.justifyItems = resolvedJustifyItems as TaffyStyle["justifyItems"];
  }
  if (resolvedAlignItems) {
    result.alignItems = resolvedAlignItems as TaffyStyle["alignItems"];
  }
  if (resolvedAlignContent) {
    result.alignContent = resolvedAlignContent as TaffyStyle["alignContent"];
  }

  // --- Grid item: gridArea (숫자 기반 shorthand + 이름 기반 영역) ---
  const gridArea = style.gridArea as string | undefined;
  if (gridArea) {
    const area = parseGridAreaShorthand(gridArea, templateAreas);
    if (area) {
      result.gridRowStart = area.rowStart;
      result.gridRowEnd = area.rowEnd;
      result.gridColumnStart = area.colStart;
      result.gridColumnEnd = area.colEnd;
    } else if (import.meta.env.DEV) {
      console.warn(
        `[TaffyGridEngine] 유효하지 않은 gridArea 값: "${gridArea}"`,
        templateAreas
          ? "(정의된 영역: " + [...templateAreas.keys()].join(", ") + ")"
          : "(templateAreas 미정의)",
      );
    }
  }

  // --- Grid item: gridColumn / gridRow (area가 해석되지 않은 경우만) ---
  if (!result.gridColumnStart && !result.gridRowStart) {
    const gridColumn = style.gridColumn as string | undefined;
    const gridRow = style.gridRow as string | undefined;

    if (gridColumn) {
      const { start, end } = parseGridLineShorthand(gridColumn);
      result.gridColumnStart = start;
      result.gridColumnEnd = end;
    }
    if (gridRow) {
      const { start, end } = parseGridLineShorthand(gridRow);
      result.gridRowStart = start;
      result.gridRowEnd = end;
    }
  }

  // --- Grid item: 직접 지정된 start/end (gridColumn/gridRow가 없는 경우) ---
  if (style.gridColumnStart !== undefined && !result.gridColumnStart) {
    result.gridColumnStart = String(style.gridColumnStart);
  }
  if (style.gridColumnEnd !== undefined && !result.gridColumnEnd) {
    result.gridColumnEnd = String(style.gridColumnEnd);
  }
  if (style.gridRowStart !== undefined && !result.gridRowStart) {
    result.gridRowStart = String(style.gridRowStart);
  }
  if (style.gridRowEnd !== undefined && !result.gridRowEnd) {
    result.gridRowEnd = String(style.gridRowEnd);
  }

  // --- Grid item: 자기 정렬 ---
  if (style.alignSelf) {
    result.alignSelf = style.alignSelf as TaffyStyle["alignSelf"];
  }
  if (style.justifySelf) {
    result.justifySelf = style.justifySelf as TaffyStyle["justifySelf"];
  }

  // --- Margin --- (Grid는 margin:auto 미지원, applyCommonTaffyStyle에 미포함)
  const margin = parseMargin(style);
  if (margin.top !== 0) result.marginTop = margin.top;
  if (margin.right !== 0) result.marginRight = margin.right;
  if (margin.bottom !== 0) result.marginBottom = margin.bottom;
  if (margin.left !== 0) result.marginLeft = margin.left;

  // --- Inset ---
  if (style.position === "absolute" || style.position === "fixed") {
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

// ─── TaffyGridEngine ──────────────────────────────────────────────────

/**
 * Taffy Grid WASM 엔진 가용 여부
 *
 * selectEngine()에서 조기 라우팅 판단에 사용.
 */
export function isTaffyGridAvailable(): boolean {
  const instance = TaffyGridEngine.instance;
  if (!instance) return true; // 아직 생성 전이면 사용 가능으로 간주
  return instance.isAvailable();
}

/**
 * Taffy 기반 CSS Grid 레이아웃 엔진
 *
 * Taffy WASM의 네이티브 Grid 지원을 사용합니다.
 * BaseTaffyEngine의 인스턴스 관리, calculate() 스켈레톤, 결과 수집을 상속합니다.
 */
export class TaffyGridEngine extends BaseTaffyEngine {
  static instance: TaffyGridEngine | null = null;

  readonly displayTypes = ["grid", "inline-grid"];
  protected readonly engineName = "TaffyGridEngine";

  constructor() {
    super();
    TaffyGridEngine.instance = this;
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
    // grid-template-areas 파싱 (자식 gridArea 해석에 필요)
    const parentRawStyle = (parent.props?.style || {}) as Record<
      string,
      unknown
    >;
    const templateAreas = parseGridTemplateAreas(
      parentRawStyle.gridTemplateAreas as string | undefined,
    );

    // 1. 자식 노드 생성 (grid item 속성 포함)
    const childHandles: TaffyNodeHandle[] = [];
    const childMap = new Map<TaffyNodeHandle, CanvasLayoutNode>();
    const getChildElements = context?.getChildElements;

    for (const child of children) {
      const childRawStyle = child.props?.style as
        | Record<string, unknown>
        | undefined;
      // 부모 computed style 기반으로 자식 CSS 상속 해석 (em 단위 등)
      const childComputed = resolveStyle(childRawStyle, parentComputed);
      // Phase 4-4: Grid item에도 intrinsic size 주입 (Button 등 높이 collapse 방지)
      const childChildren = getChildElements?.(child.id);
      const enrichedChild = enrichWithIntrinsicSize(
        child,
        availableWidth,
        availableHeight,
        childComputed,
        childChildren,
        getChildElements,
        true,
      );
      const taffyStyle = elementToTaffyGridStyle(
        enrichedChild,
        childComputed,
        templateAreas,
        cssCtx,
      );
      // 자식 노드는 grid item이므로 display를 grid로 강제하지 않음
      // Taffy는 grid 컨테이너 내에서 아이템을 자동으로 처리함
      // grid item에서 display 속성은 아이템 자체의 inner display를 의미하므로 제거
      delete taffyStyle.display;
      const handle = taffy.createNode(taffyStyle);
      childHandles.push(handle);
      childMap.set(handle, child);
    }

    // 2. 부모 노드 생성 (grid container 속성)
    const parentStyle = elementToTaffyGridStyle(
      parent,
      parentComputed,
      undefined,
      cssCtx,
    );
    parentStyle.display = "grid";
    this.setupParentDimensions(parentStyle, availableWidth, availableHeight);

    // Phase 4-3: repeat(auto-fill/auto-fit) 전개는 Rust 브릿지에서 처리
    // Taffy가 네이티브로 auto-fill/auto-fit repeat count를 계산
    const rootHandle = taffy.createNodeWithChildren(parentStyle, childHandles);

    // 3. 레이아웃 계산
    taffy.computeLayout(rootHandle, availableWidth, availableHeight);

    // 4. 결과 수집
    return this.collectResults(taffy, childHandles, childMap);
  }
}
