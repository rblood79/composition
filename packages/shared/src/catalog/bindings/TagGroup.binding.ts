/**
 * ADR-142 family ④(collections) — TagGroup primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`TagGroup.tsx`)가 useCollectionData(dataBinding → tag items)로 채우고
 * RAC TagGroup + Label/TagList/Tag 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */

import type { PrimitiveBinding } from "../types";

export const tagGroupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "taggroup",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B (A 후속, 2026-06-05): 정적 items[] SSOT(ADR-097 P2).
      //   toRacProps 가 props.items pass-through 를 보장(미선언 시 빈 TagList placeholder).
      //   kind:"items-manager" 는 비-DATA_ATTR_KIND → out[key]=value 통과 유지 +
      //   Inspector 정적 tag 추가/제거 UI(ItemsManager) 렌더(RSP Dynamic collections).
      //   Skia 경로는 appendTagRowProjection 이 canonical props.items 를 직접 읽어 무관.
      items: {
        kind: "items-manager",
        label: "Tags",
        section: "content",
        itemsManager: {
          itemsKey: "items",
          itemTypeName: "Tag",
          defaultItem: { id: "", label: "New Tag", isDisabled: false },
          itemSchema: [
            { key: "label", type: "string", label: "Label" },
            { key: "isDisabled", type: "boolean", label: "Disabled" },
            {
              key: "allowsRemoving",
              type: "boolean",
              label: "Allows Removing",
            },
          ],
          labelKey: "label",
        },
      },
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // orientation accepts 제거 (2026-07-01): RAC/RSP TagGroup 어디에도 없는 non-standard prop.
      //   DOM(RAC)은 무시하고 Skia 만 vertical 반영해 CSS↔Skia 비대칭 + Property 패널에 dead
      //   편집 UI 노출 → D2 위반. 그룹↔라벨 배치는 RSP 표준 labelPosition(top/side)이 담당.
      // labelPosition(그룹↔라벨 top/side): 렌더 인프라 이미 갖춰짐 —
      //   TagGroup.tsx wrapper 가 data-label-position emit / 수동 TagGroup.css
      //   [data-label-position="side"]{flex-direction:row} / catalog rule
      //   containerVariants["label-position"].side(Skia). (다른 field 와 표기 정합.)
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
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
      allowsRemoving: {
        kind: "boolean",
        label: "Allows Removing",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
