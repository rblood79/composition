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
    // ADR-912 단계 4 C1 (2026-06-03): shell-only 전환. 2D grid(header/row/cell) paint 는
    //   Table projected tree(canvasSceneNode appendTableRowProjection → TableRow/TableCell.spec.
    //   render.shapes)가 담당한다(GridList.spec 동형). Table parent spec 은 container shell
    //   (bg + border)만 반환. columns/rows 2D 순회 제거 — 발효(skiaLegacy 제거) 후 Table 은
    //   isCatalogSkiaCutover 경로(buildCatalogShapes 컨테이너 shell, rule fill {color.base} +
    //   border {color.border})라 본 render.shapes 는 Skia 미경유이나, layout/legacy consumer
    //   회귀 0 위해 shell parity 유지(ListBox/GridList 패턴).
    shapes: (props, size, _state = "default") => {
      const variant =
        TableSpec.variants![
          (props as { variant?: keyof typeof TableSpec.variants }).variant ??
            TableSpec.defaultVariant!
        ];
      const fill = resolveFillTokens(variant);
      const bgColor = props.style?.backgroundColor ?? fill.default.base;
      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );
      const totalWidth =
        props.columns?.reduce((sum, col) => sum + (col.width || 100), 0) ||
        0 ||
        ((props.style?.width as number | undefined) ?? 360);

      const shapes: Shape[] = [];

      // 컨테이너 배경 (Table rule fill = {color.base} 정합).
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

      // 테두리 (Table rule border = {color.border} 정합).
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
