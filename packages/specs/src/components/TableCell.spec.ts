/**
 * TableCell + TableRow Component Spec — ADR-912 단계 4 C1 (Table 2D projection).
 *
 * Table 2D projected tree(RowsGroup → Row[i] → Cell[i][j])의 행/셀 self-render spec.
 * GridListItem.spec(ADR-912 C1 카드 렌더 이전) 패턴 동형:
 *   - 부모 Table.render.shapes 는 shell(bg+border)만 그린다.
 *   - projected Row/Cell node 가 catalog 미등록(TAG_SPEC_MAP childSpecs 자동 등록만) →
 *     isCatalogSkiaCutover=false → spec.render.shapes 경로로 자체 렌더.
 *
 * **역할 분리** (사용자 결정 2026-06-03 "행 단위 셀 노드"):
 *   - TableRow: 행 배경(striped/selected) + 하단 구분선. 셀은 자식 노드(Taffy flex row 배치).
 *   - TableCell: 셀 텍스트 1개(header=fw600 / data=fw400). bg 는 행이 담당 → 셀은 text-only.
 *
 * 시각 정본: 기존 Table.render.shapes 2D grid 로직(header bg {color.layer-2} + header divider +
 *   striped {color.layer-2} + selected {color.accent-subtle} bg / {color.neutral} text + cell text).
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { parsePxValue } from "../primitives";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";

// ── TableCell ──────────────────────────────────────────────────────────────

/**
 * TableCell Props — projected cell node 가 주입받는 셀 렌더 데이터.
 *
 * `_isHeader`=컬럼 헤더 셀(fw600) / data 셀(fw400). `_columnWidth`=컬럼 폭(maxWidth 계산).
 * `_align`=텍스트 정렬.
 */
export interface TableCellProps {
  size?: "sm" | "md" | "lg";
  children?: unknown;
  _isHeader?: boolean;
  _columnWidth?: number;
  _align?: "left" | "center" | "right";
  style?: Record<string, string | number | undefined>;
}

function readCellText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export const TableCellSpec: ComponentSpec<TableCellProps> = {
  name: "TableCell",
  description:
    "Table 2D projected cell — text-only self-render (skipCSSGeneration, Skia 전용)",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: true,
  defaultSize: "md",

  sizes: {
    sm: {
      height: 36,
      paddingX: 8,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 44,
      paddingX: 12,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 52,
      paddingX: 16,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    hover: {},
    disabled: { opacity: 0.38, pointerEvents: "none" },
    focusVisible: { focusRing: "{focus.ring.default}" },
  },

  render: {
    // Table.render.shapes 의 header/cell text 로직을 셀 1개 단위로 이전.
    //   배치(x offset = columnWidth 누적)는 Taffy flex row 가 담당 → 셀은 (0,0) origin 단일 text.
    shapes: (props, size, _state = "default") => {
      const style = (props.style ?? {}) as Record<string, unknown>;
      const fontSize = resolveSpecFontSize(
        (style.fontSize as string | number | undefined) ?? size.fontSize,
        16,
      );
      const paddingX = parsePxValue(
        style.paddingLeft ?? style.paddingRight ?? style.padding,
        size.paddingX,
      );
      const ff = (style.fontFamily as string) || fontFamily.sans;
      const columnWidth =
        typeof props._columnWidth === "number" ? props._columnWidth : 100;
      const isHeader = props._isHeader === true;
      const fw =
        (style.fontWeight as string | number | undefined) ??
        (isHeader ? 600 : 400);
      // 선택 행/일반 행 모두 {color.neutral} (기존 Table.render.shapes 와 동일 — selected 시각은
      //   행 배경 {color.accent-subtle} 으로 표현, 텍스트 색은 불변). style.color override 우선.
      const textColor =
        (style.color as string | undefined) ?? ("{color.neutral}" as TokenRef);
      const align = props._align ?? "left";
      const rowHeight = parsePxValue(style.height, size.height);

      const shapes: Shape[] = [];
      shapes.push({
        type: "text",
        x: paddingX,
        y: rowHeight / 2,
        text: readCellText(props.children),
        fontSize,
        fontFamily: ff,
        fontWeight: fw,
        fill: textColor,
        baseline: "middle" as const,
        align,
        maxWidth: columnWidth - paddingX * 2,
      });
      return shapes;
    },
    react: () => ({ role: "cell" }),
  },
};

// ── TableRow ───────────────────────────────────────────────────────────────

/**
 * TableRow Props — projected row node 가 주입받는 행 시각 데이터.
 *
 * `_isHeader`=헤더 행(bg {color.layer-2}) / `_striped`=striped 짝수행(bg {color.layer-2}) /
 * `_isSelected`=선택 행(bg {color.accent-subtle}). `_rowWidth`=구분선 폭(전체 컬럼 합).
 */
export interface TableRowProps {
  size?: "sm" | "md" | "lg";
  _isHeader?: boolean;
  _striped?: boolean;
  _isSelected?: boolean;
  _rowWidth?: number;
  style?: Record<string, string | number | undefined>;
}

export const TableRowSpec: ComponentSpec<TableRowProps> = {
  name: "TableRow",
  description:
    "Table 2D projected row — bg(striped/selected) + divider self-render (Skia 전용)",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: true,
  defaultSize: "md",

  // ADR-912 collection sub-part cutover (2026-06-14): 셀 가로 배치(display:flex/row)는
  //   appendTableRowProjection 이 render-space style 로 무조건 직접 주입(canvasSceneNode.ts:966-971,
  //   ADR-135 정합)하므로 spec body 비의존. resolveContainerStylesFallback generic 읽기 의존 제거 —
  //   spec body 물리 삭제 후에도 projection style(rawStyle) override 로 layout 불변(redundant 확정).

  sizes: {
    sm: {
      height: 36,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 44,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 52,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    hover: {},
    disabled: { opacity: 0.38, pointerEvents: "none" },
    focusVisible: { focusRing: "{focus.ring.default}" },
  },

  render: {
    // Table.render.shapes 의 행 배경 + 하단 구분선 로직을 행 1개 단위로 이전.
    shapes: (props, size, _state = "default") => {
      const style = (props.style ?? {}) as Record<string, unknown>;
      const rowHeight = parsePxValue(style.height, size.height);
      const rowWidth =
        typeof props._rowWidth === "number" ? props._rowWidth : 360;
      const borderColor =
        (style.borderColor as string | undefined) ??
        ("{color.border}" as TokenRef);

      const bg: TokenRef = props._isSelected
        ? ("{color.accent-subtle}" as TokenRef)
        : props._isHeader || props._striped
          ? ("{color.layer-2}" as TokenRef)
          : ("{color.base}" as TokenRef);

      const shapes: Shape[] = [];
      // 행 배경
      shapes.push({
        id: "row-bg",
        type: "rect",
        x: 0,
        y: 0,
        width: "auto",
        height: rowHeight,
        fill: bg,
      });
      // 하단 구분선 (header/data 공통)
      shapes.push({
        type: "line",
        x1: 0,
        y1: rowHeight,
        x2: rowWidth,
        y2: rowHeight,
        stroke: borderColor,
        strokeWidth: 1,
      });
      return shapes;
    },
    react: (props) => ({
      role: props._isHeader ? "rowheader" : "row",
    }),
  },
};
