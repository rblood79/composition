import type React from "react";

// ADR-253 Phase 6 (2026-10-07): moved here from the old Preview renderers (`renderers/LayoutRenderers.tsx`,
// deleted) — the catalog DOM binding (`delegatedDom.tsx`) is its only reader.

/**
 * TableView 자식 트리(TableHeader/TableBody/Column/Row/Cell)의 type별 시각 계약.
 *
 * **D3 대칭 SSOT (catalog `generated/componentRulesTable.ts`)**: 각 type 의 catalog
 * `containerStyles` / `sizes.M` 시각값을 DOM 의 generic div 인라인에 그대로 반영하여
 * Skia(buildCatalogShapes 가 같은 catalog rule 소비) ↔ Preview DOM 시각 대칭을 맞춘다.
 *   - TableHeader: flex row | TableBody: flex column | Row: flex row
 *   - Column: padding 8px(`{spacing.sm}`) + fontWeight 600
 *   - Cell:   padding 8px(`{spacing.sm}`)
 *   - 열 폭: TableHeader · Row 가 Column 들의 트랙 목록으로 grid (ADR-257 — `delegatedDom` 의
 *     `_tableTracks`, Canvas `styleOf` 와 같은 값). Column · Cell 은 그 열의 grid 칸.
 * RAC Table.css 정본(`.react-aria-Cell,.react-aria-Column{padding:var(--spacing-2)}`=8px,
 * `.column-header{font-weight:600}`)과 동일.
 *
 * **className 비부여 (CRITICAL)**: `react-aria-Row` / `react-aria-TableBody` 클래스를 주면
 * composition `Table.css`(data-driven Table 의 TanStack 가상화 전용)의
 * `.react-aria-TableBody & .react-aria-Row { position: absolute }` 규칙이 누수되어 Row 가
 * absolute 로 빠지고 부모(TableBody/grid) 높이가 0 으로 붕괴한다. 시각값을 100% 인라인으로
 * 완결하고(generic div), 식별은 `data-tableview-part` 중립 속성만 사용. Row 는 누수 방어로
 * position:relative 명시.
 */
export const TABLEVIEW_CHILD_STYLE: Record<
  string,
  { role: string; style: React.CSSProperties }
> = {
  TableHeader: {
    role: "rowgroup",
    // flexShrink:0 — grid(flex column) main-axis 에서 자식이 축소되지 않도록(overflow:hidden 클리핑 방지).
    style: { display: "flex", flexDirection: "row", flexShrink: 0 },
  },
  TableBody: {
    role: "rowgroup",
    style: { display: "flex", flexDirection: "column", flexShrink: 0 },
  },
  Row: {
    role: "row",
    style: { display: "flex", flexDirection: "row", position: "relative" },
  },
  Column: {
    role: "columnheader",
    // textAlign left: catalog COMPONENT_RULES_TABLE.Column.variants.default.textAlign 미러
    //   (starter Table.css `.react-aria-Column{text-align:left}` 정본). Skia(rule.textAlign)와
    //   동일 값 명시 — generic div 인라인 완결 패턴(브라우저 기본 left 의존 대신 SSOT 미러).
    // fontSize/lineHeight 16/24: catalog COMPONENT_RULES_TABLE.Column sizes 미러 (ADR-151
    //   후속 2026-07-17) — 루트 .react-aria-TableView 가 font-size:text-sm(14) 을 cascade
    //   하면서 상속 의존이 깨져(행 37 vs Skia 40) 명시 미러로 전환. Skia
    //   calculateContentHeight(estimateTextHeight 16/24 + paddingY*2=40)와 동일 source.
    style: {
      padding: 8,
      fontWeight: 600,
      textAlign: "left",
      fontSize: 16,
      lineHeight: "24px",
    },
  },
  Cell: {
    role: "gridcell",
    // textAlign left: catalog COMPONENT_RULES_TABLE.Cell.variants.default.textAlign 미러.
    // fontSize/lineHeight 16/24: Column 동형 — catalog Cell sizes 미러.
    style: {
      padding: 8,
      textAlign: "left",
      fontSize: 16,
      lineHeight: "24px",
    },
  },
};

/**
 * ADR-257 Phase 3 — a TableView Column · Cell's own text box from its record: the rule's S2
 * `align` · `showDivider` · `overflowMode` blocks (`containerVariants`) land in the record's
 * `visual`, which the Canvas reads too. (The RAC Table's parts take the whole record inline —
 * `domBinding` `authoredStyle`.)
 */
export function catalogTableViewCellTextStyle(node: {
  readonly visual: Readonly<Record<string, unknown>>;
}): React.CSSProperties {
  const visual = node.visual;
  const text = (key: string) =>
    typeof visual[key] === "string" ? String(visual[key]) : undefined;
  const divider = Number(visual.borderRightWidth ?? 0);
  return {
    ...(text("textAlign")
      ? { textAlign: text("textAlign") as React.CSSProperties["textAlign"] }
      : {}),
    ...(text("whiteSpace")
      ? { whiteSpace: text("whiteSpace") as React.CSSProperties["whiteSpace"] }
      : {}),
    ...(text("textOverflow") ? { textOverflow: text("textOverflow") } : {}),
    ...(text("overflow")
      ? { overflow: text("overflow") as React.CSSProperties["overflow"] }
      : {}),
    ...(divider > 0 && text("borderColor")
      ? {
          borderRightWidth: divider,
          borderRightStyle: "solid",
          borderRightColor: text("borderColor"),
        }
      : {}),
  };
}
