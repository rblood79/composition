/**
 * ADR-142 family ④(collections) — ListBox primitive 의 `PrimitiveBinding`.
 *
 * collection 컴포넌트는 RAC raw 가 아닌 **composition wrapper**(`ListBox.tsx`)가 D1 담당 —
 * wrapper 가 `useCollectionData`(dataBinding → items, ADR-132)로 데이터를 채우고 RAC ListBox +
 * ListBoxItem 을 합성한다. 따라서 `source.kind: "internal"`(RAC raw 우회, wrapper 직접 렌더).
 *
 * **Skia generic 발효 (skiaLegacy 미설정, ADR-912 선행 2026-06-03)**: DOM(Preview)/Inspector 는
 * catalog generic(wrapper 렌더 + useCollectionData), Skia 도 generic 발효 — ListBox render.shapes 는
 * container shell(bg+border)만 반환(ADR-146)하고 data row 는 row projection
 * (canvasSceneNode.appendListBoxRowProjection)이 독립 Skia 노드로 그린다. buildCatalogShapes 가
 * 동일 정본 table(componentRulesTable ListBox rule)의 variant fill + border 로 같은 shell 을 그려
 * 시각 동등. items 배열 순회가 render.shapes 안에 없어 generic 발효 가능(나머지 6 collection 은
 * items 순회 render.shapes 라 skiaLegacy:true 유지, ListBox proof 검증 후 동형 확장).
 */

import type { PrimitiveBinding } from "../types";

export const listBoxBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "listbox",
  },
  props: {
    accepts: {
      // collection items 데이터 — canonical 아닌 collections root(useCollectionData) 소유.
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
        default: "single",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  // shell 은 Skia generic(buildCatalogShapes), data row 는 row projection 별도 경로(ADR-912 선행).
};
