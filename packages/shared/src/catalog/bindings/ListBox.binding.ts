/**
 * ADR-142 family ④(collections) — ListBox primitive 의 `PrimitiveBinding`.
 *
 * collection 컴포넌트는 RAC raw 가 아닌 **composition wrapper**(`ListBox.tsx`)가 D1 담당 —
 * wrapper 가 `useCollectionData`(dataBinding → items, ADR-132)로 데이터를 채우고 RAC ListBox +
 * ListBoxItem 을 합성한다. 따라서 `source.kind: "internal"`(RAC raw 우회, wrapper 직접 렌더).
 *
 * **DOM-only cutover (skiaLegacy:true, 사용자 결정 2026-05-31)**: DOM(Preview)/Inspector 는
 * catalog generic(wrapper 렌더 + useCollectionData), **Skia 만 legacy render.shapes 유지** —
 * Skia generic 렌더러가 items 배열 순회 multi-item 렌더를 아직 못 그린다(items generic 메커니즘은
 * 전 family 후 일괄). componentCatalog 의 skiaLegacy:true 로 Skia 게이트(isCatalogSkiaCutover) 제외.
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
  // collection items 순회 렌더 — Skia generic 미지원, skiaLegacy(render.shapes 유지).
};
