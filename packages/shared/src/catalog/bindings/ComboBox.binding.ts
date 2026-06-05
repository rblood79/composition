/**
 * ADR-142 family ④(collections) — ComboBox primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`ComboBox.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC ComboBox + Label/Input/Button/Popover/ListBox 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */

import type { PrimitiveBinding } from "../types";

export const comboBoxBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "combobox",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B Task 7: 정적 items[](StoredComboBoxItem[]) pass-through.
      //   collection cutover DOM 경로(toRacProps)는 accepts 선언 prop 만 통과시키므로,
      //   items 미선언 시 props.items 가 drop → wrapper 가 items=undefined 로 받아
      //   useResolvedCollectionItems 가 정적 source 를 못 봄(정적 옵션 소실). dataBinding 과
      //   동일 collection data source 라 kind:"binding"(Inspector no-op, toRacProps 통과 전용)로
      //   선언 — D2 의미 props 미오염. Select/ListBox/GridList/TagGroup/Menu binding items 패턴과 동형.
      items: { kind: "binding", label: "Items", section: "content" },
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      placeholder: {
        kind: "string",
        label: "Placeholder",
        section: "content",
      },
      iconName: { kind: "icon", label: "Icon", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
