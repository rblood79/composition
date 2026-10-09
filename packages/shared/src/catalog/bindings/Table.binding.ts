/**
 * ADR-142 family ⑤(Tree·Table) — Table primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. DOM 은 `domRegistry.tsx` `CatalogTable` (RAC Table)
 * 이 노드 트리 (`TableHeader > Column…` + `TableBody > Row > Cell…`) 를 그린다 (ADR-256 Phase 5i).
 *
 * **Skia generic 전환 (skiaLegacy 제거, ADR-912 단계 4 C1 2026-06-03)**: DOM/Inspector·Skia 모두
 * catalog generic. 바인딩된 Table 의 데이터 행은 resolver `projectTableRows` 가 TableBody 아래
 * `Row` · `Cell` 로 만든다 — Canvas 와 Preview 가 같은 해석 결과를 그린다 (Preview 의 행 =
 * `catalogBoundRows`).
 */

import type { PrimitiveBinding } from "../types";

export const tableBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "table",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
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
      // ADR-923 r21m1 (2026-09-02) — 높이 축. `heightMode`(fixed/auto/viewport/full) × `height` 로
      //   Table 높이를 정한다 — DOM 은 `domRegistry.tsx` `CatalogTable`, Canvas 는 `compositionRoot.ts`
      //   `catalogTableHeight` 가 같은 두 prop 을 읽는다. 여기 선언이 없으면 렌더러(`renderCatalogDom`)가
      //   둘 다 전달하지 않는다 (r18m1 Disclosure title 과 같은 형태 — 선언 없는 prop 은 소비 경로가 없다).
      heightMode: {
        kind: "enum",
        label: "Height Mode",
        section: "appearance",
        default: "fixed",
        options: [
          { value: "fixed", label: "Fixed" },
          { value: "auto", label: "Auto" },
          { value: "viewport", label: "Viewport" },
          { value: "full", label: "Full" },
        ],
      },
      height: {
        kind: "number",
        label: "Height",
        section: "appearance",
        min: 0,
        default: 400,
      },
    },
    toRacProps: "default",
  },
};
