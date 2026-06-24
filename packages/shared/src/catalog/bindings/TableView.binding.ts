import type { PrimitiveBinding } from "../types";

/**
 * TableView — 강화된 Table 컨테이너 (정렬/리사이즈/밀도 조절, Table 자식 트리 묶음). composition
 * 자체 추상 + S2 참조(`react-spectrum.adobe.com/TableView`) — RAC/starter 에 `TableView` 없음
 * (S2 전용). factory(`DisplayComponents.ts::createTableViewDefinition`)가 Table 자식 트리를 자동 생성.
 *
 * **ADR-912 R7 G1-b (container shell catalog cutover + S2 variant 재설계, 2026-06-15)**:
 *   구 `TableView.spec.ts`(render.shapes: bg roundRect + border, skipCSSGeneration:false → 자체
 *   generated/TableView.css)는 `isQuiet` boolean 분기로 border on/off 를 제어했다 — S2 정본
 *   variant 모델(default/quiet)을 따르지 않은 자체 변형. generate-css virtual 전환으로 DOM CSS
 *   source 를 `COMPONENT_RULES_TABLE.TableView`(variants default/quiet, byte-identical diff 0)로
 *   이전했고, 본 catalog 등록에서 **isQuiet boolean → `variant:"quiet"` 흡수**(R6 Card 동형 —
 *   feedback-catalog-unrepresentable-is-nonstandard-variant). quiet variant 는 transparent base +
 *   transparent border 라 isQuiet=true 의 "border 없음"을 catalog rule 의 2축(variants×fill)으로
 *   확장 없이 재현. Skia catalog 경로(buildSpecNodeData:853 `props.variant ?? rule.defaultVariant`)도
 *   variant prop 으로 default/quiet 시각을 그려 DOM 과 대칭(구 isQuiet boolean 은 Skia 미해석 →
 *   비대칭이었음).
 *
 * **시각 = generic shell(자식 Table 트리가 내용 렌더) + catalog layout baseline**: TableView 는
 *   컨테이너이므로 buildCatalogShapes 가 `_hasChildren` shell(variant 별 bg+border)을 그리고 자식
 *   Table/Header/Row/Cell Element 가 표 내용을 담당한다. factory/default props 에 중복하던
 *   container layout(`display:flex` / `flexDirection:column` / `width`)은
 *   `COMPONENT_RULES_TABLE.TableView.containerStyles` 가 공급한다.
 *
 * **D2 BC (사용자 명시 승인 2026-06-15)**: `isQuiet` boolean → `variant: "quiet"` 정규화. factory
 *   기본값 isQuiet:false → variant:default 이므로 신규 TableView 영향 0. isQuiet:true 토글한 기존
 *   TableView 는 renderTableView/factory 정규화로 variant:quiet 매핑(시각 동일 — border none).
 *
 * D1: composition `<div>` (internal source, generic DOM). role="grid" 는 전용 renderTableView 부여.
 * D2: variant/density(appearance) + selectionMode/allowsSorting/allowsResizingColumns(state) surface.
 * D3: 시각(variant default: layer-1+border / quiet: transparent)은 theme rule
 *     (COMPONENT_RULES_TABLE.TableView). Skia generic box shell ↔ DOM `react-aria-TableView
 *     [data-variant]` 시각 대칭.
 */
export const tableViewBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "div",
  },
  props: {
    accepts: {
      // appearance — S2 variant 모델(구 isQuiet boolean 흡수: quiet=transparent+no border).
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
          { value: "spacious", label: "Spacious" },
        ],
      },
      // state / features
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      allowsSorting: {
        kind: "boolean",
        label: "Allow Sorting",
        section: "state",
      },
      allowsResizingColumns: {
        kind: "boolean",
        label: "Allow Resizing Columns",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
