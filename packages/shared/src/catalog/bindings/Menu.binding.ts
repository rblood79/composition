/**
 * ADR-142 family ④(collections) — Menu primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Menu.tsx`/MenuButton)가 useCollectionData(dataBinding → items)로 채우고
 * RAC Menu + MenuItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */

import type { PrimitiveBinding } from "../types";

export const menuBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "menu",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B Task 3: 정적 items[] SSOT(RuntimeMenuItem[]) pass-through.
      //   collection cutover DOM 경로(toRacProps)는 accepts 선언 prop 만 통과시키므로,
      //   items 미선언 시 props.items 가 drop → MenuButton 이 items=undefined 로 받아
      //   static children placeholder 렌더. dataBinding 과 동일 collection data source 라
      //   kind:"binding"(Inspector no-op, toRacProps 통과 전용)로 선언 — D2 의미 props 미오염.
      items: { kind: "binding", label: "Items", section: "content" },
      label: { kind: "string", label: "Trigger Label", section: "content" },
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
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
