/**
 * ADR-142 family ⑤(Tree·Table) — Table primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. DOM 은 `domRegistry.tsx` `CatalogTable` (RAC Table)
 * 이 노드 트리 (`TableHeader > Column…` + `TableBody > Row > Cell…`) 를 그린다 (ADR-256 Phase 5i).
 *
 * **Skia generic 전환 (skiaLegacy 제거, ADR-912 단계 4 C1 2026-06-03)**: DOM/Inspector·Skia 모두
 * catalog generic. 바인딩된 Table 은 TableBody 의 Row 템플릿 (`repeat` 표시 — ADR-310 Phase 4)
 * 을 데이터 행마다 반복한다 (resolver `boundTableRows` 가 정렬 · 고정 높이 자르기) — Canvas 와
 * Preview 가 같은 해석 결과를 그린다 (Preview 의 행 = `catalogBoundRows`).
 */

import type { PrimitiveBinding } from "../types";
import { LOADING_STATE_PROP } from "./loadingStateProps";

export const tableBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "table",
  },
  props: {
    accepts: {
      // ADR-308 Phase 1: the group's selection (S2 · RAC) — accepted; the panel offers it in Phase 2.
      selectedKeys: {
        editorHidden: true,
        kind: "selection-keys",
        label: "Selected items",
        section: "value",
      },
      // ADR-308 Phase 2: the group's selection — its items as a check list (사용자 결정 3).
      defaultSelectedKeys: {
        kind: "selection-keys",
        label: "Selected items",
        section: "value",
      },
      dataBinding: {
        kind: "binding",
        label: "Data source",
        section: "collection",
      },
      // S2 TableView `loadingState` (`useAsyncList.loadingState`) — derived, not authored.
      loadingState: LOADING_STATE_PROP,
      // (No `size`: S2 TableView has no size axis — its cells take `controlFont()` and the row
      //   height is `density`. ADR-295 후속 C1 (2026-10-31, 사용자 「Table S/M/L 크기 축 제거」)
      //   removed the S · M · L the Table carried.)
      // S2 1.8.0 Table `isQuiet` (2026-10-10): 바깥 틀 없음 — 배경 · 테두리 색을 지우고
      //   radius 0 (rule fill.quiet + containerVariants.quiet; DOM 은 Table.css [data-quiet]).
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      // S2 1.8.0 Table `density` (2026-10-10): 안의 Column · Cell 로 전파돼 (resolver
      //   `CATALOG_DENSITY_PROPAGATION`) 그들의 densities 채널이 paddingY 를 바꾼다
      //   (행 높이 compact 32 · regular 40 · spacious 48).
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
      // S2 TableView `disallowEmptySelection` (2026-10-28 — the other collections' binding has it;
      //   the design-data diff report found Table alone without). `CatalogTable` passes it to RAC's
      //   Table; the rules' `clearSelection` · `deselectItem` guard reads it (`constraints.ts`).
      disallowEmptySelection: {
        kind: "boolean",
        label: "Disallow Empty Selection",
        section: "state",
      },
      // ADR-257 Phase 3 — S2 `selectionStyle` (default checkbox): highlight selects a row by its
      //   background (RAC `selectionBehavior="replace"`) and the selection checkbox column is
      //   not there (`catalogTableSelectionPartHidden`).
      selectionStyle: {
        kind: "enum",
        label: "Selection Style",
        section: "state",
        default: "checkbox",
        options: [
          { value: "checkbox", label: "Checkbox" },
          { value: "highlight", label: "Highlight" },
        ],
      },
      // ADR-257 Phase 3 — S2 `overflowMode` (default truncate): the cells' text on one line with
      //   an ellipsis, or wrapped (the row grows). Carried to the Columns · Cells (resolver).
      overflowMode: {
        kind: "enum",
        label: "Overflow",
        section: "appearance",
        default: "truncate",
        options: [
          { value: "truncate", label: "Truncate" },
          { value: "wrap", label: "Wrap" },
        ],
      },
      // (No height props — 사용자 결정 2026-11-19: the Table's height is its Styles height, as S2
      //  takes it by `styles`. The `heightMode` · `height` props are gone: only "fixed" was ever
      //  read, and an authored Styles height already won over `height`. The origin template
      //  carries the default 400 — `component-table` `visual.height`.)
    },
    toRacProps: "default",
  },
};
