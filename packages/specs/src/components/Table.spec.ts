/**
 * Table Component Spec
 *
 * React Aria 기반 데이터 테이블 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
// ADR-908 Phase 3-A-2: Fill token dual-read seam
import { resolveFillTokens } from "../utils/fillTokens";
// ADR-912 단계 4 C1: Table 2D projected row/cell self-render spec (childSpecs 자동 등록).
import { TableRowSpec, TableCellSpec } from "./TableCell.spec";

/**
 * Table Column
 */
export interface TableColumn {
  id: string;
  label: string;
  width?: number;
  allowsSorting?: boolean;
}

/**
 * Table Row
 */
export interface TableRow {
  id: string;
  cells: Record<string, unknown>;
  isSelected?: boolean;
}

/**
 * Table Props
 */
export interface TableProps {
  variant?: "default" | "striped" | "bordered";
  size?: "sm" | "md" | "lg";
  columns?: TableColumn[];
  rows?: TableRow[];
  selectionMode?: "none" | "single" | "multiple";
  style?: Record<string, string | number | undefined>;
}

/**
 * Table Component Spec
 */
export const TableSpec: ComponentSpec<TableProps> = {
  name: "Table",
  description: "React Aria 기반 데이터 테이블 컴포넌트",
  element: "div",
  skipCSSGeneration: true,

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    striped: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    bordered: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border-hover}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 36,
      paddingX: 8,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 44,
      paddingX: 12,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 52,
      paddingX: 16,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    hover: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  // ADR-912 단계 4 C1: TableRow/TableCell 을 childSpecs 로 선언 → TAG_SPEC_MAP 자동 확장
  //   (GridList childSpecs:[GridListItemSpec] 패턴 동형). projected Row/Cell node type 이
  //   getSpecForTag 로 resolve 되어 spec.render.shapes 경로로 자체 렌더한다.
  childSpecs: [TableRowSpec, TableCellSpec],

  render: {
    shapes: (props, size, _state = "default") => {
      const variant =
        TableSpec.variants![
          (props as { variant?: keyof typeof TableSpec.variants }).variant ??
            TableSpec.defaultVariant!
        ];
      // 샘플 데이터 fallback — props가 없을 때 캔버스에 기본 테이블을 표시
      const DEFAULT_COLUMNS: TableColumn[] = [
        { id: "name", label: "Name", width: 120 },
        { id: "email", label: "Email", width: 160 },
        { id: "role", label: "Role", width: 80 },
      ];
      const DEFAULT_ROWS: TableRow[] = [
        {
          id: "r1",
          cells: { name: "John Doe", email: "john@example.com", role: "Admin" },
        },
        {
          id: "r2",
          cells: {
            name: "Jane Smith",
            email: "jane@example.com",
            role: "Editor",
          },
        },
        {
          id: "r3",
          cells: { name: "Bob Lee", email: "bob@example.com", role: "Viewer" },
        },
      ];

      const columns =
        props.columns && props.columns.length > 0
          ? props.columns
          : DEFAULT_COLUMNS;
      const rows =
        props.rows && props.rows.length > 0 ? props.rows : DEFAULT_ROWS;
      const totalWidth =
        columns.reduce((sum, col) => sum + (col.width || 100), 0) || 360;

      // 사용자 스타일 우선, 없으면 spec 기본값 (ADR-908 Phase 3-A-2: fill seam)
      const fill = resolveFillTokens(variant);
      const bgColor = props.style?.backgroundColor ?? fill.default.base;

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );

      const textColor = props.style?.color ?? variant.text;
      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        16,
      );
      const fwRaw = props.style?.fontWeight;
      const headerFw =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 600
          : 600;
      const cellFw =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 400
          : 400;
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const textAlign =
        (props.style?.textAlign as "left" | "center" | "right") || "left";

      const shapes: Shape[] = [];

      // 컨테이너 배경
      shapes.push({
        id: "bg",
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width: totalWidth,
        height: "auto",
        radius: borderRadius as unknown as number,
        fill: bgColor,
      });

      // 테두리
      const borderColor = props.style?.borderColor ?? variant.border;
      const defaultBw = props.variant === "bordered" ? 2 : 1;
      const borderWidth = parseBorderWidth(props.style?.borderWidth, defaultBw);
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          radius: borderRadius as unknown as number,
        });
      }

      // 헤더 행 배경
      shapes.push({
        type: "rect" as const,
        x: 0,
        y: 0,
        width: totalWidth,
        height: size.height,
        fill: "{color.layer-2}" as TokenRef,
      });

      // 헤더 텍스트
      let xOffset = 0;
      columns.forEach((col) => {
        const colWidth = col.width || 100;
        shapes.push({
          type: "text" as const,
          x: xOffset + size.paddingX,
          y: size.height / 2,
          text: col.label,
          fontSize: fontSize,
          fontFamily: ff,
          fontWeight: headerFw,
          fill: textColor,
          baseline: "middle" as const,
          align: textAlign,
          maxWidth: colWidth - size.paddingX * 2,
        });
        xOffset += colWidth;
      });

      // 헤더 하단 구분선
      shapes.push({
        type: "line" as const,
        x1: 0,
        y1: size.height,
        x2: totalWidth,
        y2: size.height,
        stroke: borderColor || ("{color.border}" as TokenRef),
        strokeWidth: 1,
      });

      // 데이터 행
      let yOffset = size.height;
      rows.forEach((row, rowIndex) => {
        const isEven = rowIndex % 2 === 0;
        const rowBg =
          props.variant === "striped" && !isEven
            ? ("{color.layer-2}" as TokenRef)
            : (bgColor ?? fill.default.base);

        // 행 배경
        shapes.push({
          type: "rect" as const,
          x: 0,
          y: yOffset,
          width: totalWidth,
          height: size.height,
          fill: row.isSelected ? ("{color.accent-subtle}" as TokenRef) : rowBg,
        });

        // 셀 텍스트
        let cellXOffset = 0;
        columns.forEach((col) => {
          const colWidth = col.width || 100;
          const cellValue = String(row.cells[col.id] || "");
          shapes.push({
            type: "text" as const,
            x: cellXOffset + size.paddingX,
            y: yOffset + size.height / 2,
            text: cellValue,
            fontSize: fontSize,
            fontFamily: ff,
            fontWeight: cellFw,
            fill: row.isSelected ? ("{color.neutral}" as TokenRef) : textColor,
            baseline: "middle" as const,
            align: textAlign,
            maxWidth: colWidth - size.paddingX * 2,
          });
          cellXOffset += colWidth;
        });

        // 행 하단 구분선
        shapes.push({
          type: "line" as const,
          x1: 0,
          y1: yOffset + size.height,
          x2: totalWidth,
          y2: yOffset + size.height,
          stroke: borderColor || ("{color.border}" as TokenRef),
          strokeWidth: 1,
        });

        yOffset += size.height;
      });

      return shapes;
    },

    react: (props) => ({
      role: "table",
      "aria-rowcount": props.rows?.length,
      "aria-colcount": props.columns?.length,
    }),

    pixi: () => ({
      eventMode: "static" as const,
      cursor: "default",
    }),
  },
};
