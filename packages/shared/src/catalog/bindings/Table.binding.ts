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
      // ADR-315 사용자 결정 1 (2026-11-20 「표마다 켜는 스위치」 — default off): a published
      //   Table keeps what its user changed (the sort, and its columns' hiding · order · pinning ·
      //   widths as those arrive) in that browser — `catalogTableStateRemembered`. The Builder's
      //   Preview never keeps it. A composition extension (`d2Provenance.ts`).
      rememberState: {
        kind: "boolean",
        label: "Remember state",
        section: "state",
      },
      // ADR-315 Phase 2 — the Table's sort options (breakdown §6 「Sorting」; composition
      //   extensions — `d2Provenance.ts`; all off = the Table as it was). `allowsMultiSort`: a
      //   Shift press on a header adds that Column to the sort (TanStack `enableMultiSort`), up to
      //   `maxSortColumns` (`maxMultiSortColCount`; absent = any number). `allowsUnsorted`: a
      //   Column's press cycle ends at no sort (`enableSortingRemoval`; off = RAC's two states).
      //   A Table whose rows' request cannot carry a sort list stays at one sort
      //   (`catalogTableSliceServable`).
      allowsMultiSort: {
        kind: "boolean",
        label: "Multi-column sort",
        section: "state",
      },
      maxSortColumns: {
        kind: "number",
        label: "Max sort columns",
        section: "state",
        min: 1,
        step: 1,
        visibleWhen: { key: "allowsMultiSort", equals: true },
      },
      allowsUnsorted: {
        kind: "boolean",
        label: "Allow unsorted",
        section: "state",
      },
      // ADR-315 Phase 3 — the Table's search (breakdown §6 「Search」; composition extensions —
      //   `d2Provenance.ts`). `searchText`: the text its rows are searched by — every searchable
      //   Column's field (`allowsSearching`), TanStack `globalFilter`. The authored value is what
      //   the Table starts with; a rule's 「Search text」 Do (a SearchField's `onChange`) writes
      //   the Preview's — the Table state `search`, never the document. `searchMatch`: 「포함」 or
      //   graded fuzzy matches (사용자 결정 2 — 표마다 선택, `collections/view/fuzzy.ts`); a Table
      //   whose server answers its search is 「포함」 there.
      searchText: {
        kind: "string",
        label: "Search text",
        section: "state",
      },
      searchMatch: {
        kind: "enum",
        label: "Search match",
        section: "state",
        default: "contains",
        options: [
          { value: "contains", label: "Contains" },
          { value: "fuzzy", label: "Fuzzy" },
        ],
      },
      // ADR-315 Phase 4 — the end user may move columns (breakdown §6 「Columns」 — 「Reorder
      //   columns」, a composition extension, default off): every data Column's menu moves it
      //   left · right (사용자 결정 3 — and its header drags). The order is the Table state's
      //   `columnOrder`, never the document.
      allowsColumnReordering: {
        kind: "boolean",
        label: "Reorder columns",
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
