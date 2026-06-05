/**
 * ADR-142 family ④(collections) — GridList primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`GridList.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC GridList + GridListItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4 C1).
 */

import type { PrimitiveBinding } from "../types";

export const gridListBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "gridlist",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B Task 5: 정적 items[](StoredGridListItem[]) pass-through.
      //   collection cutover DOM 경로(toRacProps)는 accepts 선언 prop 만 통과시키므로,
      //   items 미선언 시 props.items 가 drop → wrapper 가 items=undefined 로 받아
      //   useResolvedCollectionItems 가 정적 source 를 못 봄(정적 카드 소실). dataBinding 과
      //   동일 collection data source 라 kind:"binding"(Inspector no-op, toRacProps 통과 전용)로
      //   선언 — D2 의미 props 미오염. ListBox/TagGroup/Menu binding items 패턴과 동형.
      items: { kind: "binding", label: "Items", section: "content" },
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
};
